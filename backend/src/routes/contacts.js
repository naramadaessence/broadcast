import { Router } from 'express';

import Contact from '../models/Contact.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

/**
 * GET /api/v1/contacts
 * Get paginated list of contacts
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const tag = req.query.tag || '';
        const location = req.query.location || '';
        const sortBy = req.query.sort_by || 'created_at';
        const sortOrder = req.query.sort_order === 'asc' ? 1 : -1;
        
        const skip = (page - 1) * limit;
        
        let query = {};
        let andConditions = [];
        
        if (search) {
            andConditions.push({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } }
                ]
            });
        }
        
        if (tag) {
            andConditions.push({
                $or: [
                    { tags: tag },
                    { labels: tag }
                ]
            });
        }
        
        if (location) {
            query.location = location;
        }

        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        const sortObj = {};
        sortObj[sortBy] = sortOrder;

        const total = await Contact.countDocuments(query);
        const contacts = await Contact.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(limit);

        res.json({
            contacts: contacts.map(c => {
                const doc = c.toObject();
                doc.id = doc._id;
                return doc;
            }),
            total,
            page,
            total_pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('List contacts error:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

/**
 * GET /api/v1/contacts/tags/list
 */
router.get('/tags/list', async (req, res) => {
    try {
        const tags = await Contact.distinct('tags');
        const labels = await Contact.distinct('labels');
        const allTags = [...new Set([...tags, ...labels])].filter(t => t);
        res.json(allTags);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/v1/contacts/locations/list
 */
router.get('/locations/list', async (req, res) => {
    try {
        const locations = await Contact.distinct('location');
        res.json(locations.filter(l => l));
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/v1/contacts
 */
router.post('/', async (req, res) => {
    try {
        const { name, phone, email, location, ticket_size, tags, labels, notes } = req.body;
        if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

        const existing = await Contact.findOne({ phone });
        if (existing) return res.status(400).json({ error: 'Phone number already exists' });

        const contact = new Contact({
            name, phone, email, location, ticket_size, tags: tags || [], labels: labels || [], notes, source: 'manual'
        });
        await contact.save();
        res.status(201).json({ id: contact._id });
    } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
    }
});

/**
 * GET /api/v1/contacts/export
 * Export contacts to CSV
 */
router.get('/export', async (req, res) => {
    try {
        const search = req.query.search || '';
        const tag = req.query.tag || '';
        const location = req.query.location || '';
        
        let query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (tag) {
            query.tags = tag;
        }
        
        if (location) {
            query.location = location;
        }

        const contacts = await Contact.find(query).sort({ created_at: -1 });
        
        const headers = ['Name', 'Phone', 'Email', 'Location', 'Ticket Size', 'Tags', 'Labels', 'Notes', 'Source', 'Created At'];
        const csvRows = [headers.join(',')];
        
        for (const c of contacts) {
            const row = [
                `"${c.name || ''}"`,
                `"${c.phone || ''}"`,
                `"${c.email || ''}"`,
                `"${c.location || ''}"`,
                c.ticket_size || '',
                `"${(c.tags || []).join(';')}"`,
                `"${(c.labels || []).join(';')}"`,
                `"${(c.notes || '').replace(/"/g, '""')}"`,
                `"${c.source || ''}"`,
                `"${c.created_at ? new Date(c.created_at).toISOString() : ''}"`
            ];
            csvRows.push(row.join(','));
        }
        
        res.header('Content-Type', 'text/csv');
        res.attachment('contacts.csv');
        res.send(csvRows.join('\n'));
    } catch (error) {
        console.error('Export contacts error:', error);
        res.status(500).json({ error: 'Failed to export contacts' });
    }
});

/**
 * POST /api/v1/contacts/import
 */
router.post('/import', async (req, res) => {
    try {
        const { contacts } = req.body;
        if (!Array.isArray(contacts)) return res.status(400).json({ error: 'Invalid input format' });

        let imported = 0;
        let skipped = 0;

        for (const c of contacts) {
            if (!c.name || !c.phone) {
                skipped++;
                continue;
            }

            try {
                let tags = [];
                if (Array.isArray(c.tags)) {
                    tags = c.tags;
                } else if (typeof c.tags === 'string') {
                    tags = c.tags.split(',').map(t => t.trim()).filter(Boolean);
                }

                let labels = [];
                if (Array.isArray(c.labels)) {
                    labels = c.labels;
                } else if (typeof c.labels === 'string') {
                    labels = c.labels.split(',').map(t => t.trim()).filter(Boolean);
                }

                await Contact.findOneAndUpdate(
                    { phone: c.phone },
                    {
                        name: c.name,
                        email: c.email || '',
                        location: c.location || '',
                        ticket_size: c.ticket_size ? parseFloat(c.ticket_size) : 0,
                        $addToSet: { tags: { $each: tags }, labels: { $each: labels } },
                        notes: c.notes || '',
                        source: 'import'
                    },
                    { upsert: true, new: true }
                );
                imported++;
            } catch (err) {
                skipped++;
            }
        }

        res.json({ imported, skipped });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import contacts' });
    }
});

/**
 * GET /api/v1/contacts/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ error: 'Contact not found' });
        res.json(contact);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch contact' });
    }
});

/**
 * PUT /api/v1/contacts/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { name, phone, email, location, ticket_size, tags, labels, notes } = req.body;
        
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ error: 'Contact not found' });

        if (phone && phone !== contact.phone) {
            const existing = await Contact.findOne({ phone });
            if (existing) return res.status(400).json({ error: 'Phone number already used' });
        }

        Object.assign(contact, { name, phone, email, location, ticket_size, tags, labels, notes });
        await contact.save();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update contact' });
    }
});

/**
 * DELETE /api/v1/contacts/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

/**
 * POST /api/v1/contacts/bulk/delete
 */
router.post('/bulk/delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs array required' });
        
        const result = await Contact.deleteMany({ _id: { $in: ids } });
        res.json({ success: true, deleted: result.deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete contacts' });
    }
});

export default router;
