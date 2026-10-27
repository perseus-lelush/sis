import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';
import { auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, required } from '../utils/http.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(required(req.body?.email, 'Email')).trim().toLowerCase();
    const password = String(required(req.body?.password, 'Password'));

    const rows = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_active, s.id AS student_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email],
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email },
      config.jwtSecret,
      { expiresIn: '7d' },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student_id: user.student_id || null,
      },
    });
  }),
);

router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, s.id AS student_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id],
    );
    if (!rows.length || !rows[0].is_active) throw new HttpError(401, 'Account not found');
    res.json({ user: rows[0] });
  }),
);

export default router;
