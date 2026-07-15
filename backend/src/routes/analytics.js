import { Router } from 'express';
import Contact from '../models/Contact.js';
import Order from '../models/Order.js';
import WhatsAppCampaign from '../models/WhatsAppCampaign.js';
import WhatsAppConversation from '../models/WhatsAppConversation.js';
import WhatsAppChatMessage from '../models/WhatsAppChatMessage.js';

const router = Router();

async function getDashboardData(req, res) {
    try {
        const totalContacts = await Contact.countDocuments();
        const totalOrders = await Order.countDocuments();
        
        const revenueResult = await Order.aggregate([
            { $match: { payment_status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]);
        const totalRevenue = revenueResult[0] ? parseFloat(revenueResult[0].total || 0) : 0;

        const totalCampaigns = await WhatsAppCampaign.countDocuments();
        const totalConversations = await WhatsAppConversation.countDocuments();

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Revenue Over Time (Last 30 Days)
        const revenueAgg = await Order.aggregate([
            { $match: { payment_status: 'paid', created_at: { $gte: thirtyDaysAgo } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                revenue: { $sum: "$total_amount" },
                orders: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]);
        const revenueOverTime = revenueAgg.map(r => ({
            date: r._id,
            revenue: parseFloat(r.revenue || 0),
            orders: r.orders
        }));

        // Messages Over Time (Last 30 Days)
        const messagesAgg = await WhatsAppChatMessage.aggregate([
            { $match: { created_at: { $gte: thirtyDaysAgo } } },
            { $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    direction: "$direction"
                },
                count: { $sum: 1 }
            }},
            { $sort: { "_id.date": 1 } }
        ]);
        const messagesByDay = {};
        for (const row of messagesAgg) {
            const dateStr = row._id.date;
            if (!messagesByDay[dateStr]) {
                messagesByDay[dateStr] = { date: dateStr, inbound: 0, outbound: 0 };
            }
            if (row._id.direction === 'inbound') {
                messagesByDay[dateStr].inbound = row.count;
            } else {
                messagesByDay[dateStr].outbound = row.count;
            }
        }
        const messagesOverTime = Object.values(messagesByDay);

        // Campaign Stats
        const campaignAgg = await WhatsAppCampaign.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
        const campaignStats = campaignAgg.reduce((acc, row) => {
            if (row._id) acc[row._id] = row.count;
            return acc;
        }, {});

        // Order Status Breakdown
        const statusAgg = await Order.aggregate([
            { $group: { _id: "$payment_status", count: { $sum: 1 } } }
        ]);
        const ordersByStatus = statusAgg.reduce((acc, row) => {
            if (row._id) acc[row._id] = row.count;
            return acc;
        }, {});

        // Recent Orders
        const recentOrdersRows = await Order.find()
            .populate('contact_id', 'name email phone')
            .sort({ created_at: -1 })
            .limit(5);

        const recentOrders = recentOrdersRows.map(r => ({
            id: r._id,
            phone: r.phone || (r.contact_id ? r.contact_id.phone : ''),
            total_amount: r.total_amount,
            currency: r.currency || 'INR',
            payment_status: r.payment_status,
            fulfillment_status: r.fulfillment_status,
            created_at: r.created_at
        }));

        res.json({
            metrics: {
                totalContacts,
                totalOrders,
                totalRevenue,
                totalCampaigns,
                totalConversations
            },
            revenueOverTime,
            messagesOverTime,
            campaignStats,
            ordersByStatus,
            recentOrders
        });
    } catch (error) {
        console.error('[Analytics] Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics dashboard' });
    }
}

router.get('/dashboard', getDashboardData);
router.get('/', getDashboardData);

export default router;
