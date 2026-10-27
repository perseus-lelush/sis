import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

const IGNORED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function auditTrail(req, res, next) {
  res.on('finish', () => {
    if (IGNORED_METHODS.has(req.method)) return;
    if (!String(req.originalUrl || '').startsWith('/api')) return;

    let userId = null;
    let actor = null;
    let role = null;

    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), config.jwtSecret);
        userId = payload.id ?? null;
        actor = payload.name ?? null;
        role = payload.role ?? null;
      } catch {
        /* invalid or expired token: still record the attempt */
      }
    }

    query(
      `INSERT INTO audit_logs (user_id, actor, role, method, path, status, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        actor,
        role,
        req.method,
        String(req.originalUrl || req.path).slice(0, 255),
        res.statusCode,
        String(req.ip || req.socket?.remoteAddress || '').slice(0, 64),
      ],
    ).catch(() => {
      /* audit failures must never break the request */
    });
  });

  next();
}
