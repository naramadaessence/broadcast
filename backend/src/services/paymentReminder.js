import { query, run, getTenantById } from '../database.js';
import { sendInteractiveMessage } from './whatsapp.js';

export const startPaymentReminderCron = () => {
    // Check every minute
    setInterval(async () => {
        try {
            // Find orders where payment is pending, not cancelled, has a payment link, and 15 mins have passed since the last reminder.
            const pendingOrders = await query(`
                SELECT id, tenant_id, phone, total_amount, currency, payment_link 
                FROM orders 
                WHERE payment_status = 'pending' 
                AND fulfillment_status != 'cancelled'
                AND payment_link IS NOT NULL 
                AND last_reminder_at <= NOW() - INTERVAL 15 MINUTE
            `);

            for (const order of pendingOrders) {
                const tenant = await getTenantById(order.tenant_id);
                if (!tenant) continue;

                const replyText = `⏳ *Payment Reminder*\n\nYour payment of ${order.currency || 'INR'} ${order.total_amount} is still pending for Order #${order.id}.\n\nPlease complete your payment here to confirm your order:\n${order.payment_link}`;
                
                const interactiveOptions = {
                    type: "button",
                    body: { text: replyText },
                    action: {
                        buttons: [
                            { type: "reply", reply: { id: `cancel_order_${order.id}`, title: "Cancel Order" } }
                        ]
                    }
                };

                const result = await sendInteractiveMessage(order.phone, interactiveOptions, tenant);

                if (result && result.messageId) {
                    const outNow = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    
                    // Update last_reminder_at so it waits another 15 mins
                    await run(`UPDATE orders SET last_reminder_at = ? WHERE id = ?`, [outNow, order.id]);
                    
                    const convs = await query(`SELECT id FROM whatsapp_conversations WHERE tenant_id = ? AND phone = ? LIMIT 1`, [order.tenant_id, order.phone]);
                    if (convs && convs.length > 0) {
                        const conversationId = convs[0].id;
                        await run(
                            `INSERT INTO whatsapp_chat_messages (tenant_id, conversation_id, direction, message_type, body, provider_message_id, status) VALUES (?, ?, 'outbound', 'text', ?, ?, 'sent')`,
                            [order.tenant_id, conversationId, replyText, result.messageId]
                        );
                        await run(`UPDATE whatsapp_conversations SET last_message_text = ?, last_message_at = ?, unread_count = 0 WHERE id = ?`, [replyText.substring(0, 100), outNow, conversationId]);
                    }
                    console.log(`[Cron] Sent 15-min payment reminder for Order #${order.id} to ${order.phone}`);
                }
            }
        } catch (error) {
            console.error('[Cron] Payment reminder error:', error.message);
        }
    }, 60 * 1000); // 1 minute
};
