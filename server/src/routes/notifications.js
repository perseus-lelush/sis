import { Router } from 'express';
import { query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, parseId, required } from '../utils/http.js';
import { notifyUsers, simulateDelivery } from '../utils/notify.js';

const router = Router();

router.use(auth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conditions = ['user_id = ?'];
    const params = [req.user.id];

    if (req.query.type && ['announcement', 'grade', 'payment', 'attendance', 'enrollment', 'library', 'system'].includes(req.query.type)) {
      conditions.push('type = ?');
      params.push(req.query.type);
    }
    if (req.query.unread === 'true') {
      conditions.push('is_read = 0');
    }

    const notifications = await query(
      `SELECT id, title, message, type, channel, is_read, created_at
       FROM notifications
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      params,
    );

    const unreadRows = await query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id],
    );

    res.json({ notifications, unread: Number(unreadRows[0].unread) });
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const rows = await query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id],
    );
    res.json({ unread: Number(rows[0].unread) });
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'notification id');
    const result = await query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, req.user.id],
    );
    if (!result.affectedRows) throw new HttpError(404, 'Notification not found');
    res.json({ message: 'Notification marked as read' });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  }),
);

router.post(
  '/announce',
  adminOnly,
  asyncHandler(async (req, res) => {
    const title = String(required(req.body?.title, 'Title')).trim();
    const message = String(required(req.body?.message, 'Message')).trim();
    if (title.length > 150) {
      throw new HttpError(400, 'Title must be 150 characters or fewer');
    }
    const audience = ['students', 'admins', 'all'].includes(req.body?.audience)
      ? req.body.audience
      : 'students';
    const channels = Array.isArray(req.body?.channels)
      ? req.body.channels.filter((channel) => ['email', 'sms'].includes(channel))
      : [];

    let roleCondition = '';
    if (audience === 'students') roleCondition = `AND role = 'student'`;
    if (audience === 'admins') roleCondition = `AND role = 'admin'`;

    const recipients = await query(
      `SELECT id FROM users WHERE is_active = 1 ${roleCondition}`,
    );

    const sent = await notifyUsers(
      recipients.map((row) => row.id),
      {
        title,
        message,
        type: 'announcement',
        channel: ['in_app', ...channels].join(','),
      },
    );

    simulateDelivery(channels, sent, title);

    res.status(201).json({
      message: `Announcement sent to ${sent} recipient(s)`,
      sent,
      channels: ['in_app', ...channels],
    });
  }),
);

export default router;
