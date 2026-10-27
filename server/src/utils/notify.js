import { query } from '../db.js';

export async function notifyUsers(userIds, { title, message, type = 'system', channel = 'in_app' }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return 0;
  const values = ids.map((id) => [id, title, message, type, channel]);
  await query(
    'INSERT INTO notifications (user_id, title, message, type, channel) VALUES ?',
    [values],
  );
  return ids.length;
}

export function simulateDelivery(channels, recipientCount, title) {
  if (channels.includes('email')) {
    console.log(`[EMAIL] "${title}" queued for ${recipientCount} recipient(s)`);
  }
  if (channels.includes('sms')) {
    console.log(`[SMS] "${title}" queued for ${recipientCount} recipient(s)`);
  }
}
