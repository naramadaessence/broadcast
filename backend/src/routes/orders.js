import express from 'express';

import Order from '../models/Order.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;

        const { payment_status, fulfillment_status, search, date_from, date_to } = req.query;
        let query = {};

        if (payment_status) query.payment_status = payment_status;
        if (fulfillment_status) query.fulfillment_status = fulfillment_status;
        
        if (search) {
            query.$or = [
                { phone: { $regex: search, $options: 'i' } },
                { shipping_address: { $regex: search, $options: 'i' } }
            ];
        }

        if (date_from || date_to) {
            query.created_at = {};
            if (date_from) query.created_at.$gte = new Date(date_from);
            if (date_to) query.created_at.$lte = new Date(date_to + 'T23:59:59.999Z');
        }

        const allowedSortFields = ['created_at', 'total_amount', 'payment_status', 'fulfillment_status'];
        const sortBy = allowedSortFields.includes(req.query.sort_by) ? req.query.sort_by : 'created_at';
        const sortOrder = req.query.sort_order === 'asc' ? 1 : -1;

        const total = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate('contact_id', 'name email phone')
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit);

        res.json({
            orders: orders.map(o => {
                const doc = o.toObject();
                doc.id = doc._id;
                doc.contact_name = doc.contact_id ? doc.contact_id.name : null;
                doc.contact_email = doc.contact_id ? doc.contact_id.email : null;
                return doc;
            }),
            total,
            page,
            limit
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        
        const revenueAgg = await Order.aggregate([
            { $match: { payment_status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$total_amount' }, avg: { $avg: '$total_amount' } } }
        ]);

        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        const todayEnd = new Date();
        todayEnd.setHours(23,59,59,999);
        
        const ordersToday = await Order.countDocuments({ created_at: { $gte: todayStart, $lte: todayEnd } });
        const pendingPayments = await Order.countDocuments({ payment_status: 'pending' });

        res.json({
            totalOrders,
            totalRevenue: revenueAgg[0] ? revenueAgg[0].total : 0,
            ordersToday,
            pendingPayments,
            avgOrderValue: revenueAgg[0] ? revenueAgg[0].avg : 0,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order stats' });
    }
});

router.get('/export', async (req, res) => {
    try {
        const { payment_status, fulfillment_status, search, date_from, date_to } = req.query;
        let query = {};

        if (payment_status) query.payment_status = payment_status;
        if (fulfillment_status) query.fulfillment_status = fulfillment_status;
        
        if (search) {
            query.$or = [
                { phone: { $regex: search, $options: 'i' } },
                { shipping_address: { $regex: search, $options: 'i' } }
            ];
        }

        if (date_from || date_to) {
            query.created_at = {};
            if (date_from) query.created_at.$gte = new Date(date_from);
            if (date_to) query.created_at.$lte = new Date(date_to + 'T23:59:59.999Z');
        }

        const orders = await Order.find(query).populate('contact_id', 'name email').sort({ created_at: -1 }).limit(5000);

        const headers = ['Order ID', 'Customer Name', 'Phone', 'Email', 'Amount', 'Currency', 'Payment Status', 'Fulfillment Status', 'Shipping Address', 'Notes', 'Date'];
        const csvRows = [headers.join(',')];
        
        for (const o of orders) {
            const doc = o.toObject();
            csvRows.push([
                doc._id,
                `"${(doc.contact_id?.name || '').replace(/"/g, '""')}"`,
                doc.phone,
                doc.contact_id?.email || '',
                doc.total_amount,
                doc.currency,
                doc.payment_status,
                doc.fulfillment_status,
                `"${(doc.shipping_address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                `"${(doc.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                doc.created_at,
            ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=orders-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvRows.join('\n'));
    } catch (error) {
        res.status(500).json({ error: 'Failed to export orders' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('contact_id', 'name email phone');
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        const doc = order.toObject();
        doc.id = doc._id;
        doc.contact_name = doc.contact_id?.name;
        doc.contact_email = doc.contact_id?.email;
        doc.contact_phone = doc.contact_id?.phone;
        res.json(doc);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});

router.patch('/bulk/status', async (req, res) => {
    try {
        const { orderIds, payment_status, fulfillment_status } = req.body;
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ error: 'No order IDs provided' });
        }

        let updates = {};
        if (payment_status) updates.payment_status = payment_status;
        if (fulfillment_status) updates.fulfillment_status = fulfillment_status;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid status provided' });
        }

        await Order.updateMany({ _id: { $in: orderIds } }, { $set: updates });
        res.json({ success: true, message: `${orderIds.length} orders updated` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update orders' });
    }
});

router.patch('/:id/status', async (req, res) => {
    try {
        const { payment_status, fulfillment_status, notes } = req.body;

        let updates = {};
        if (payment_status) updates.payment_status = payment_status;
        if (fulfillment_status) updates.fulfillment_status = fulfillment_status;
        if (notes !== undefined) updates.notes = notes;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields provided' });
        }

        const order = await Order.findByIdAndUpdate(req.params.id, { $set: updates });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        res.json({ success: true, message: 'Order updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

router.post('/remind', async (req, res) => {
    try {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        // Find orders needing reminder
        const orders = await Order.find({
            checkout_status: 'ordered',
            payment_status: 'pending',
            fulfillment_status: { $ne: 'cancelled' },
            $or: [
                { last_reminder_at: { $lte: thirtyMinsAgo } },
                { last_reminder_at: null, updated_at: { $lte: thirtyMinsAgo } }
            ]
        });

        if (!orders.length) return res.json({ success: true, message: 'No orders need reminding' });

        const { default: Setting } = await import('../models/Setting.js');
        const { default: WhatsAppConversation } = await import('../models/WhatsAppConversation.js');
        const { default: WhatsAppChatMessage } = await import('../models/WhatsAppChatMessage.js');
        const { sendInteractiveMessage } = await import('../services/whatsapp.js');
        const Razorpay = (await import('razorpay')).default;

        let setting = await Setting.findOne({ singletonId: 'admin_settings' });
        if (!setting) setting = await Setting.findOne();
        if (!setting) return res.status(500).json({ error: 'Settings not found' });

        const keyId = setting.razorpay_key_id || process.env.RAZORPAY_KEY_ID;
        const keySecret = setting.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET;
        
        if (!keyId || !keySecret) {
            return res.status(500).json({ error: 'Razorpay keys not configured' });
        }

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

        let remindedCount = 0;

        for (const order of orders) {
            try {
                // Generate a new link
                const rzpLink = await razorpay.paymentLink.create({
                    amount: Math.round(order.total_amount * 100),
                    currency: 'INR',
                    description: `Order #${order._id} (Reminder)`,
                    customer: { contact: order.phone, name: order.customer_name || 'Customer' },
                    notify: { sms: true },
                    notes: { order_id: order._id.toString() }
                });

                order.payment_link = rzpLink.short_url;
                order.payment_link_id = rzpLink.id;
                order.last_reminder_at = new Date();
                await order.save();

                const paymentText = `🔔 *Payment Reminder*\n\nYour order #${order._id.toString().slice(-6)} is pending payment.\nPlease complete your payment securely using this new Razorpay link:\n${rzpLink.short_url}`;

                const interactivePayload = {
                    type: "button",
                    body: { text: paymentText },
                    action: {
                        buttons: [
                            {
                                type: "reply",
                                reply: { id: `cancel_order_${order._id}`, title: "Cancel Order 🛑" }
                            }
                        ]
                    }
                };

                const result = await sendInteractiveMessage(order.phone, interactivePayload, setting);
                
                if (result && result.messageId) {
                    const conversation = await WhatsAppConversation.findOne({ phone: order.phone, tenant_id: order.tenant_id });
                    if (conversation) {
                        await WhatsAppChatMessage.create({
                            tenant_id: order.tenant_id,
                            conversation_id: conversation._id,
                            direction: 'outbound',
                            message_type: 'interactive',
                            body: paymentText,
                            provider_message_id: result.messageId,
                            status: 'sent'
                        });
                        conversation.last_message_text = paymentText.substring(0, 100);
                        conversation.last_message_at = new Date();
                        await conversation.save();
                    }
                }
                remindedCount++;
            } catch (err) {
                console.error(`Failed to send reminder for order ${order._id}:`, err);
            }
        }

        res.json({ success: true, message: `Reminded ${remindedCount} orders` });
    } catch (error) {
        console.error('Reminder error:', error);
        res.status(500).json({ error: 'Failed to process reminders' });
    }
});

export default router;
