import WhatsAppCampaign from '../models/WhatsAppCampaign.js';
import WhatsAppMessage from '../models/WhatsAppMessage.js';
import Contact from '../models/Contact.js';
import Setting from '../models/Setting.js';
import JobQueue from '../models/JobQueue.js';
import { normalizePhone, sendTemplateMessage } from './whatsapp.js';

function parseErrorCode(error) {
    return error?.code || error?.errorCode || error?.response?.status || null;
}

function errorPayload(error) {
    const payload = {
        message: error?.message || 'Unknown send failure',
        code: parseErrorCode(error),
    };
    if (error?.response?.data) payload.response = error.response.data;
    return payload;
}

function parseTemplateParams(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function campaignState(campaignId) {
    return WhatsAppCampaign.findById(campaignId);
}

export async function refreshCampaignLedgerCounts(tenantId, campaignId) {
    const countsResult = await WhatsAppMessage.aggregate([
        { $match: { campaign_id: campaignId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const counts = Object.fromEntries(countsResult.map(row => [row._id, row.count || 0]));
    const successful = (counts.sent || 0) + (counts.delivered || 0) + (counts.read || 0);
    const failed = counts.failed || 0;
    const pending = counts.pending || 0;

    await WhatsAppCampaign.findByIdAndUpdate(campaignId, {
        $set: { successful_count: successful, failed_count: failed },
        $max: { total_recipients: successful + failed + pending }
    });

    return { successful, failed, pending };
}

async function markCampaignTerminal(tenantId, campaignId) {
    const counts = await refreshCampaignLedgerCounts(tenantId, campaignId);
    if (counts.pending > 0) return counts;

    await WhatsAppCampaign.findOneAndUpdate(
        { _id: campaignId, status: { $nin: ['cancelled', 'failed'] } },
        { $set: { status: 'completed', completed_at: new Date() } }
    );
    return counts;
}

export async function processCampaignSendJob(job) {
    const payload = job.payload || {};
    const campaignId = payload.campaignId;
    const tenantId = job.tenant_id || payload.tenantId || 'single-tenant';
    if (!campaignId) throw new Error('campaign.send job is missing campaignId');

    let campaign = await campaignState(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    if (campaign.status === 'cancelled') {
        await refreshCampaignLedgerCounts(tenantId, campaignId);
        return;
    }
    if (campaign.status === 'paused') {
        await JobQueue.findByIdAndUpdate(job.id, {
            $set: { status: 'queued', run_after: new Date(Date.now() + 60000), locked_at: null, locked_by: null }
        });
        return;
    }

    const tenant = await Setting.findOne();
    if (!tenant?.whatsapp_access_token || !tenant?.whatsapp_phone_number_id) {
        await WhatsAppCampaign.findByIdAndUpdate(campaignId, {
            $set: { status: 'failed', error_log: 'WhatsApp credentials missing. Please reconfigure in Settings.' }
        });
        throw new Error('WhatsApp credentials missing. Please reconfigure in Settings.');
    }

    await WhatsAppCampaign.findOneAndUpdate(
        { _id: campaignId, status: { $in: ['queued', 'processing'] } },
        { $set: { status: 'processing' } }
    );

    const messages = await WhatsAppMessage.find({
        campaign_id: campaignId,
        status: 'pending'
    }).limit(100);

    if (!messages.length) {
        await markCampaignTerminal(tenantId, campaignId);
        return;
    }

    for (const message of messages) {
        campaign = await campaignState(campaignId);
        if (campaign?.status === 'cancelled') {
            await WhatsAppMessage.findOneAndUpdate(
                { _id: message._id, status: 'pending' },
                { $set: { status: 'failed', error_message: 'Campaign cancelled before send', provider_error_code: 'CAMPAIGN_CANCELLED' } }
            );
            continue;
        }
        if (campaign?.status === 'paused') {
            await refreshCampaignLedgerCounts(tenantId, campaignId);
            await JobQueue.findByIdAndUpdate(job.id, {
                $set: { status: 'queued', run_after: new Date(Date.now() + 60000), locked_at: null, locked_by: null }
            });
            return;
        }

        if (message.recipient_id) {
            const contact = await Contact.findById(message.recipient_id);
            if (contact && contact.whatsapp_consent === false) {
                await WhatsAppMessage.findByIdAndUpdate(message._id, {
                    $set: { status: 'failed', error_message: 'Recipient opted out before send', provider_error_code: 'OPTED_OUT' }
                });
                continue;
            }
        }

        const phone = normalizePhone(message.phone);
        if (!phone) {
            await WhatsAppMessage.findByIdAndUpdate(message._id, {
                $set: { status: 'failed', error_message: 'Invalid phone number', provider_error_code: 'INVALID_PHONE' }
            });
            continue;
        }

        await WhatsAppMessage.findByIdAndUpdate(message._id, {
            $inc: { attempt_count: 1 },
            $set: { last_attempt_at: new Date() }
        });

        try {
            const result = await sendTemplateMessage(
                phone,
                payload.campaignName || campaign.campaign_name,
                payload.templateParams || parseTemplateParams(campaign.template_params),
                message.recipient_name || '',
                payload.languageCode || campaign.language_code,
                tenant
            );
            await WhatsAppMessage.findByIdAndUpdate(message._id, {
                $set: { status: 'sent', sent_at: new Date(), provider_message_id: result?.messageId || null, error_message: null, provider_error_code: null, provider_error_payload: null }
            });
        } catch (error) {
            await WhatsAppMessage.findByIdAndUpdate(message._id, {
                $set: {
                    status: 'failed',
                    error_message: error?.message || 'Failed to send message',
                    provider_error_code: parseErrorCode(error),
                    provider_error_payload: errorPayload(error)
                }
            });
        }
    }

    const counts = await refreshCampaignLedgerCounts(tenantId, campaignId);
    if (counts.pending > 0) {
        await JobQueue.findByIdAndUpdate(job.id, {
            $set: { status: 'queued', run_after: new Date(Date.now() + 2000), locked_at: null, locked_by: null }
        });
        return;
    }
    await markCampaignTerminal(tenantId, campaignId);
}
