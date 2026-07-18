/**
 * WhatsApp Broadcast Routes — MongoDB version
 * Replaces the old MySQL-based whatsapp.js routes
 */
import { Router } from 'express';
import multer from 'multer';
import Contact from '../models/Contact.js';
import WhatsAppCampaign from '../models/WhatsAppCampaign.js';
import WhatsAppMessage from '../models/WhatsAppMessage.js';
import WhatsAppConversation from '../models/WhatsAppConversation.js';
import WhatsAppChatMessage from '../models/WhatsAppChatMessage.js';
import { sendTemplateMessage, sendBulkMessages, normalizePhone, uploadMediaForTemplate, createTemplate, editTemplate, fetchTemplates, deleteTemplate } from '../services/whatsapp.js';
import { auth } from '../middleware/auth.js';
import { loadSettings } from '../middleware/loadSettings.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Auth + load settings (provides req.tenant)
router.use(auth);
router.use(loadSettings);

// Admin-only check
router.use((req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required for WhatsApp features' });
    }
    next();
});

// WhatsApp configured check
router.use((req, res, next) => {
    if (!req.tenant?.whatsapp_configured) {
        return res.status(403).json({
            error: 'WhatsApp not configured. Add your Meta Business API credentials in Settings.',
            whatsapp_not_configured: true,
        });
    }
    next();
});

/**
 * GET /api/v1/whatsapp/recipients
 */
router.get('/recipients', async (req, res) => {
    try {
        const { label, search, location, min_ticket, max_ticket } = req.query;

        const filter = {
            phone: { $ne: null, $exists: true },
            whatsapp_consent: true,
        };

        if (label) {
            filter.labels = { $regex: new RegExp(label, 'i') };
        }
        if (location) {
            filter.location = { $regex: new RegExp(location, 'i') };
        }
        if (min_ticket) {
            filter.ticket_size = { ...(filter.ticket_size || {}), $gte: parseFloat(min_ticket) };
        }
        if (max_ticket) {
            filter.ticket_size = { ...(filter.ticket_size || {}), $lte: parseFloat(max_ticket) };
        }
        if (search) {
            const keywords = search.split(',').map(k => k.trim()).filter(k => k.length > 0);
            const searchConditions = keywords.map(keyword => ({
                $or: [
                    { name: { $regex: new RegExp(keyword, 'i') } },
                    { email: { $regex: new RegExp(keyword, 'i') } },
                    { phone: { $regex: new RegExp(keyword, 'i') } },
                    { location: { $regex: new RegExp(keyword, 'i') } },
                ]
            }));
            filter.$and = searchConditions;
        }

        const contacts = await Contact.find(filter).sort({ name: 1 }).lean();

        const withValid = contacts.map(c => ({
            id: c._id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            location: c.location,
            ticket_size: c.ticket_size,
            tags: Array.isArray(c.tags) ? c.tags : [],
            labels: c.labels,
            validPhone: !!normalizePhone(c.phone),
        }));

        res.json({
            contacts: withValid,
            counts: {
                total: contacts.length,
                withValidPhone: withValid.filter(c => c.validPhone).length,
            }
        });
    } catch (error) {
        console.error('WhatsApp recipients error:', error);
        res.status(500).json({ error: 'Failed to fetch recipients' });
    }
});

/**
 * POST /api/v1/whatsapp/send
 */
router.post('/send', async (req, res) => {
    try {
        const { phone, campaignName, templateParams = [], userName = '', languageCode } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });
        if (!campaignName) return res.status(400).json({ error: 'Campaign name is required' });

        const data = await sendTemplateMessage(phone, campaignName, templateParams, userName, languageCode, req.tenant);
        res.json({ success: true, message: 'Message sent', data });
    } catch (error) {
        console.error('WhatsApp send error:', error);
        res.status(500).json({ error: error.message || 'Failed to send message' });
    }
});

/**
 * POST /api/v1/whatsapp/broadcast
 */
router.post('/broadcast', async (req, res) => {
    try {
        const { campaignName, templateParams = [], recipientType, recipientFilter, recipientIds, languageCode } = req.body;
        if (!campaignName) return res.status(400).json({ error: 'Campaign name is required' });

        let recipients = [];
        
        let baseFilter = {
            phone: { $ne: null, $exists: true }
        };
        
        if (recipientType !== 'custom') {
            if (recipientFilter) {
                if (recipientFilter.location) baseFilter.location = { $regex: new RegExp(recipientFilter.location, 'i') };
                if (recipientFilter.min_ticket) baseFilter.ticket_size = { ...(baseFilter.ticket_size || {}), $gte: parseFloat(recipientFilter.min_ticket) };
                if (recipientFilter.max_ticket) baseFilter.ticket_size = { ...(baseFilter.ticket_size || {}), $lte: parseFloat(recipientFilter.max_ticket) };
                if (recipientFilter.search) {
                    const keywords = recipientFilter.search.split(',').map(k => k.trim()).filter(k => k.length > 0);
                    if (keywords.length > 0) {
                        const searchConditions = keywords.map(keyword => ({
                            $or: [
                                { name: { $regex: new RegExp(keyword, 'i') } },
                                { email: { $regex: new RegExp(keyword, 'i') } },
                                { phone: { $regex: new RegExp(keyword, 'i') } },
                                { location: { $regex: new RegExp(keyword, 'i') } },
                            ]
                        }));
                        baseFilter.$and = searchConditions;
                    }
                }
            }
        }

        if (recipientType === 'custom' && recipientIds && recipientIds.length > 0) {
            baseFilter._id = { $in: recipientIds };
            const contacts = await Contact.find(baseFilter).lean();
            recipients = contacts.map(c => ({ id: c._id, name: c.name, phone: c.phone }));

        } else if (recipientType === 'labeled' && recipientFilter?.label) {
            baseFilter.labels = { $regex: new RegExp(recipientFilter.label, 'i') };
            const contacts = await Contact.find(baseFilter).lean();
            recipients = contacts.map(c => ({ id: c._id, name: c.name, phone: c.phone }));

        } else {
            const contacts = await Contact.find(baseFilter).lean();
            recipients = contacts.map(c => ({ id: c._id, name: c.name, phone: c.phone }));
        }

        if (recipients.length === 0) {
            return res.status(400).json({ error: 'No valid recipients found' });
        }

        const campaign = await WhatsAppCampaign.create({
            name: `Broadcast ${new Date().toLocaleDateString('en-IN')}`,
            campaign_name: campaignName,
            recipient_type: recipientType || 'all',
            recipient_filter: recipientFilter || {},
            total_recipients: recipients.length,
            status: 'processing',
            sent_by: req.user.userId,
        });

        // Process in background
        processBroadcast(campaign._id, recipients, campaignName, templateParams, languageCode, req.tenant).catch(err => {
            console.error('Broadcast processing error:', err);
        });

        res.json({
            success: true,
            campaignId: campaign._id,
            totalRecipients: recipients.length,
            message: `Broadcasting to ${recipients.length} recipients.`,
        });
    } catch (error) {
        console.error('WhatsApp broadcast error:', error);
        res.status(500).json({ error: error.message || 'Failed to start broadcast' });
    }
});

async function processBroadcast(campaignId, recipients, campaignName, templateParams, languageCode, tenant) {
    try {
        console.log(`[Broadcast #${campaignId}] Sending ${recipients.length} messages (template: ${campaignName})...`);

        // Insert pending message records
        for (const r of recipients) {
            await WhatsAppMessage.create({
                campaign_id: campaignId,
                phone: normalizePhone(r.phone) || r.phone,
                recipient_name: r.name,
                recipient_id: r.id,
                status: 'pending',
            });
        }

        // Send messages via Meta API
        const results = await sendBulkMessages(recipients, campaignName, templateParams, 50, 1000, languageCode, tenant);
        console.log(`[Broadcast #${campaignId}] Done. Success: ${results.successful}, Failed: ${results.failed}`);

        // Update message statuses and sync with Chat Inbox
        const tenantId = tenant?._id ? tenant._id.toString() : '6a3a72a84065eb9ea35938db';
        const { resolveTemplateBody, getTemplatePlainText } = await import('./whatsapp-chat.js');
        const resolvedBody = await resolveTemplateBody(campaignName, templateParams, tenant);
        const plainTextBody = getTemplatePlainText(resolvedBody).substring(0, 100);

        for (const msg of results.messageIds) {
            await WhatsAppMessage.updateOne(
                { campaign_id: campaignId, phone: msg.phone },
                { status: 'sent', sent_at: new Date(), provider_message_id: msg.messageId }
            );

            try {
                let conversation = await WhatsAppConversation.findOne({ tenant_id: tenantId, phone: msg.phone });
                if (!conversation) {
                    const contact = await Contact.findOne({ phone: { $regex: new RegExp(`${msg.phone.slice(-10)}$`) }, tenant_id: tenantId });
                    conversation = await WhatsAppConversation.create({
                        tenant_id: tenantId,
                        phone: msg.phone,
                        contact_name: msg.name || contact?.name || msg.phone,
                        contact_id: contact?._id || null,
                        last_message_text: plainTextBody,
                        last_message_at: new Date(),
                        window_expires_at: null
                    });
                } else {
                    if (msg.name && !conversation.contact_name) conversation.contact_name = msg.name;
                    conversation.last_message_text = plainTextBody;
                    conversation.last_message_at = new Date();
                    await conversation.save();
                }

                await WhatsAppChatMessage.create({
                    tenant_id: tenantId,
                    conversation_id: conversation._id,
                    direction: 'outbound',
                    message_type: 'template',
                    body: resolvedBody,
                    provider_message_id: msg.messageId,
                    status: 'sent',
                    sent_by: 'admin-user-id'
                });
            } catch (chatErr) {
                console.error(`[Broadcast #${campaignId}] Error syncing chat inbox for ${msg.phone}:`, chatErr.message);
            }
        }
        for (const err of results.errors) {
            const normalized = normalizePhone(err.phone) || err.phone;
            await WhatsAppMessage.updateOne(
                { campaign_id: campaignId, phone: normalized },
                { status: 'failed', error_message: err.error }
            );
        }

        // Mark campaign completed
        await WhatsAppCampaign.updateOne(
            { _id: campaignId },
            {
                status: 'completed',
                successful_count: results.successful,
                failed_count: results.failed,
                completed_at: new Date(),
                error_log: results.errors.length > 0 ? JSON.stringify(results.errors.slice(0, 50)) : null,
            }
        );
    } catch (error) {
        console.error(`[Broadcast #${campaignId}] FATAL ERROR:`, error.message);
        try {
            await WhatsAppCampaign.updateOne(
                { _id: campaignId },
                { status: 'failed', error_log: error.message }
            );
        } catch (dbErr) {
            console.error(`[Broadcast #${campaignId}] Failed to update campaign status:`, dbErr.message);
        }
    }
}

/**
 * GET /api/v1/whatsapp/campaigns
 */
router.get('/campaigns', async (req, res) => {
    try {
        const campaigns = await WhatsAppCampaign.find()
            .sort({ created_at: -1 })
            .limit(50)
            .lean();
        
        res.json(campaigns.map(c => ({ ...c, id: c._id })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

/**
 * GET /api/v1/whatsapp/campaigns/:id
 */
router.get('/campaigns/:id', async (req, res) => {
    try {
        const campaign = await WhatsAppCampaign.findById(req.params.id).lean();
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const messages = await WhatsAppMessage.find({ campaign_id: campaign._id })
            .sort({ _id: 1 })
            .lean();

        res.json({
            ...campaign,
            id: campaign._id,
            messages: messages.map(m => ({ ...m, id: m._id })),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaign details' });
    }
});

/**
 * POST /api/v1/whatsapp/templates/upload-image
 */
router.post('/templates/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        const headerHandle = await uploadMediaForTemplate(req.file.buffer, req.file.mimetype, req.file.originalname, req.tenant);
        res.json({ success: true, headerHandle });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to upload image' });
    }
});

/**
 * POST /api/v1/whatsapp/templates
 */
router.post('/templates', async (req, res) => {
    try {
        const { name, category, language, bodyText, headerImageHandle, footerText, buttons } = req.body;
        if (!name) return res.status(400).json({ error: 'Template name is required' });
        if (!bodyText) return res.status(400).json({ error: 'Body text is required' });

        const result = await createTemplate({
            name, category: category || 'MARKETING', language: language || 'en',
            bodyText, headerImageHandle: headerImageHandle || null,
            footerText: footerText || null, buttons: buttons || [],
        }, req.tenant);

        res.json({ success: true, template: result });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create template' });
    }
});

/**
 * PUT /api/v1/whatsapp/templates/:id
 */
router.put('/templates/:id', async (req, res) => {
    try {
        const { bodyText, headerImageHandle, footerText, buttons } = req.body;
        if (!bodyText) return res.status(400).json({ error: 'Body text is required' });

        const result = await editTemplate(req.params.id, {
            bodyText,
            headerImageHandle: headerImageHandle || null,
            footerText: footerText || null,
            buttons: buttons || [],
        }, req.tenant);

        res.json({ success: true, template: result });
    } catch (error) {
        console.error('Template edit error:', error);
        res.status(500).json({ error: error.message || 'Failed to edit template' });
    }
});

/**
 * GET /api/v1/whatsapp/templates
 */
router.get('/templates', async (req, res) => {
    try {
        const templates = await fetchTemplates(req.tenant);
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch templates' });
    }
});

/**
 * DELETE /api/v1/whatsapp/templates/:name
 */
router.delete('/templates/:name', async (req, res) => {
    try {
        await deleteTemplate(req.params.name, req.tenant);
        res.json({ success: true, message: `Template "${req.params.name}" deleted` });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete template' });
    }
});

export default router;
