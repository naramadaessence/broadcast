import { Router } from 'express';

const router = Router();

router.get('/tenants', (req, res) => {
    res.json({ tenants: [] });
});

router.get('/users', (req, res) => {
    res.json({ users: [] });
});

export default router;
