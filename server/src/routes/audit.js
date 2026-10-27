import { Router } from 'express';
import { query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

router.use(auth, adminOnly);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const logs = await query(
      `SELECT id, user_id, actor, role, method, path, status, ip, created_at
       FROM audit_logs
       ORDER BY id DESC
       LIMIT ?`,
      [limit],
    );
    res.json({ logs });
  }),
);

export default router;
