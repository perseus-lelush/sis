import { Router } from 'express';
import { getPool, query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, parseId, parseISODate, required } from '../utils/http.js';
import { notifyUsers } from '../utils/notify.js';
import { currentSequence, nextSequence } from '../utils/sequence.js';

const router = Router();
const METHODS = ['cash', 'card', 'bank_transfer', 'online'];

router.use(auth);

const refreshOverdue = () =>
  query(`UPDATE invoices SET status = 'overdue' WHERE status = 'unpaid' AND due_date < CURDATE()`);

const invoiceQuery = `
  SELECT i.id, i.invoice_no, i.student_id, i.description, i.amount, i.due_date, i.status, i.created_at,
         s.student_no, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.program,
         COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid,
         (i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0)) AS balance
  FROM invoices i
  JOIN students s ON s.id = i.student_id
`;

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    await refreshOverdue();

    if (req.user.role === 'student') {
      const studentRows = await query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!studentRows.length) throw new HttpError(404, 'Student profile not found');
      const studentId = studentRows[0].id;

      const rows = await query(
        `SELECT
           COALESCE((SELECT SUM(amount) FROM invoices WHERE student_id = ?), 0) AS total_billed,
           COALESCE((SELECT SUM(p.amount) FROM payments p
             JOIN invoices i ON i.id = p.invoice_id WHERE i.student_id = ?), 0) AS paid,
           COALESCE((SELECT SUM(i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0))
             FROM invoices i WHERE i.student_id = ? AND i.status <> 'paid'), 0) AS outstanding,
           COALESCE((SELECT SUM(i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0))
             FROM invoices i WHERE i.student_id = ? AND i.status <> 'paid' AND i.due_date < CURDATE()), 0) AS overdue`,
        [studentId, studentId, studentId, studentId],
      );

      return res.json({ summary: rows[0] });
    }

    if (req.user.role !== 'admin') {
      throw new HttpError(403, 'Only administrators can view campus billing totals');
    }

    const rows = await query(
      `SELECT
         COALESCE((SELECT SUM(amount) FROM payments), 0) AS collected,
         COALESCE((SELECT SUM(amount) FROM invoices), 0) AS total_billed,
         COALESCE((SELECT SUM(i.amount - COALESCE(p.paid, 0))
           FROM invoices i
           LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) p
             ON p.invoice_id = i.id
           WHERE i.status <> 'paid'), 0) AS outstanding,
         COALESCE((SELECT SUM(i.amount - COALESCE(p.paid, 0))
           FROM invoices i
           LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) p
             ON p.invoice_id = i.id
           WHERE i.status <> 'paid' AND i.due_date < CURDATE()), 0) AS overdue,
         (SELECT COUNT(*) FROM invoices) AS invoice_count,
         (SELECT COUNT(*) FROM invoices WHERE status = 'paid') AS paid_count`,
    );

    res.json({ summary: rows[0] });
  }),
);

router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    await refreshOverdue();

    const conditions = [];
    const params = [];

    if (req.user.role === 'student') {
      const studentRows = await query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!studentRows.length) throw new HttpError(404, 'Student profile not found');
      conditions.push('i.student_id = ?');
      params.push(studentRows[0].id);
    } else if (req.user.role !== 'admin') {
      throw new HttpError(403, 'Only administrators can view campus invoices');
    } else if (req.query.student_id) {
      conditions.push('i.student_id = ?');
      params.push(parseId(req.query.student_id, 'student id'));
    }

    if (req.query.status && ['unpaid', 'partial', 'paid', 'overdue'].includes(req.query.status)) {
      conditions.push('i.status = ?');
      params.push(req.query.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const invoices = await query(
      `${invoiceQuery} ${where} ORDER BY i.due_date ASC, i.id DESC`,
      params,
    );

    res.json({ invoices });
  }),
);

router.post(
  '/invoices',
  adminOnly,
  asyncHandler(async (req, res) => {
    const studentId = parseId(required(req.body?.student_id, 'Student'), 'student id');
    const description = String(required(req.body?.description, 'Description')).trim();
    const amount = Number(required(req.body?.amount, 'Amount'));
    const dueDate = parseISODate(required(req.body?.due_date, 'Due date'), 'due date');

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, 'Amount must be greater than zero');
    }

    const studentRows = await query(
      "SELECT s.user_id, CONCAT(s.first_name, ' ', s.last_name) AS name FROM students s WHERE s.id = ?",
      [studentId],
    );
    if (!studentRows.length) throw new HttpError(404, 'Student not found');

    const pool = await getPool();
    const year = new Date().getFullYear();
    const connection = await pool.getConnection();
    let invoiceNo;
    let result;

    try {
      await connection.beginTransaction();
      invoiceNo = await nextSequence(connection, {
        counter: `invoices:${year}`,
        prefix: `INV-${year}-`,
        seed: await currentSequence(connection, 'invoices', 'invoice_no', `INV-${year}-`),
      });
      [result] = await connection.query(
        `INSERT INTO invoices (invoice_no, student_id, description, amount, due_date, status)
         VALUES (?, ?, ?, ?, ?, 'unpaid')`,
        [invoiceNo, studentId, description, amount, dueDate],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await notifyUsers([studentRows[0].user_id], {
      title: 'New invoice posted',
      message: `Invoice ${invoiceNo} for "${description}" has been posted. Amount due: PHP ${amount.toLocaleString('en-US')}, due on ${dueDate}.`,
      type: 'payment',
      channel: 'in_app,email',
    });

    res.status(201).json({ id: result.insertId, invoice_no: invoiceNo, message: 'Invoice created' });
  }),
);

router.post(
  '/invoices/:id/pay',
  asyncHandler(async (req, res) => {
    const invoiceId = parseId(req.params.id, 'invoice id');
    const rows = await query(
      `SELECT i.*, s.user_id, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid
       FROM invoices i
       JOIN students s ON s.id = i.student_id
       WHERE i.id = ?`,
      [invoiceId],
    );

    const invoice = rows[0];
    if (!invoice) throw new HttpError(404, 'Invoice not found');
    if (req.user.role === 'student') {
      if (invoice.user_id !== req.user.id) {
        throw new HttpError(403, 'You can only pay your own invoices');
      }
    } else if (req.user.role !== 'admin') {
      throw new HttpError(403, 'Only administrators can record payments for other students');
    }
    if (invoice.status === 'paid') throw new HttpError(400, 'This invoice is already paid');

    const balance = Number(invoice.amount) - Number(invoice.paid);
    const amount = Number(req.body?.amount ?? balance);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, 'Payment amount must be greater than zero');
    }
    if (amount - balance > 0.005) {
      throw new HttpError(400, 'Payment exceeds the remaining balance');
    }

    const method = METHODS.includes(req.body?.method) ? req.body.method : 'online';
    const reference = req.body?.reference ? String(req.body.reference).trim().slice(0, 60) : null;

    await query(
      `INSERT INTO payments (invoice_id, amount, method, reference) VALUES (?, ?, ?, ?)`,
      [invoiceId, amount, method, reference],
    );

    const newPaid = Number(invoice.paid) + amount;
    const status = newPaid >= Number(invoice.amount) - 0.005 ? 'paid' : 'partial';
    await query('UPDATE invoices SET status = ? WHERE id = ?', [status, invoiceId]);

    const outstandingRows = await query(
      `SELECT COUNT(*) AS count FROM invoices WHERE student_id = ? AND status <> 'paid'`,
      [invoice.student_id],
    );
    let activated = 0;
    if (Number(outstandingRows[0].count) === 0) {
      const result = await query(
        `UPDATE enrollments SET status = 'enrolled' WHERE student_id = ? AND status = 'pending'`,
        [invoice.student_id],
      );
      activated = result.affectedRows || 0;
    }

    const activationNote =
      activated > 0
        ? ' Your pending enrollments are now activated.'
        : '';
    await notifyUsers([invoice.user_id], {
      title: status === 'paid' ? 'Payment received - invoice paid' : 'Partial payment received',
      message: `We received PHP ${amount.toLocaleString('en-US')} for invoice ${invoice.invoice_no}. Remaining balance: PHP ${Math.max(0, balance - amount).toLocaleString('en-US')}.${activationNote}`,
      type: 'payment',
      channel: 'in_app,email,sms',
    });

    res.json({
      message: 'Payment recorded',
      status,
      balance: Math.max(0, balance - amount),
      activated,
    });
  }),
);

router.get(
  '/payments',
  adminOnly,
  asyncHandler(async (req, res) => {
    const parsedLimit = Number(req.query.limit);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
    const payments = await query(
      `SELECT p.id, p.amount, p.method, p.reference, p.paid_at,
              i.invoice_no, i.description,
              s.student_no, CONCAT(s.first_name, ' ', s.last_name) AS student_name
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN students s ON s.id = i.student_id
       ORDER BY p.paid_at DESC, p.id DESC
       LIMIT ?`,
      [limit],
    );
    res.json({ payments });
  }),
);

export default router;
