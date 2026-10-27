import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/http.js';

const router = Router();

const getStudentForUser = async (userId) => {
  const rows = await query(
    `SELECT s.*, CONCAT(s.first_name, ' ', s.last_name) AS full_name
     FROM students s
     WHERE s.user_id = ?
     LIMIT 1`,
    [userId],
  );
  if (!rows.length) throw new HttpError(404, 'Student profile not found');
  return rows[0];
};

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const statsRows = await query(
        `SELECT
           (SELECT COUNT(*) FROM students WHERE status = 'active') AS total_students,
           (SELECT COUNT(*) FROM courses) AS total_courses,
           COALESCE((SELECT ROUND(100 * SUM(status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
             FROM attendance
             WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)), 0) AS attendance_rate,
           COALESCE((SELECT SUM(i.amount - COALESCE(p.paid, 0))
             FROM invoices i
             LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) p
               ON p.invoice_id = i.id
             WHERE i.status <> 'paid'), 0) AS outstanding,
           COALESCE((SELECT SUM(amount) FROM payments), 0) AS collected`,
      );

      const enrollmentByProgram = await query(
        `SELECT program, COUNT(*) AS count
         FROM students
         WHERE status = 'active'
         GROUP BY program
         ORDER BY count DESC`,
      );

      const attendanceTrend = await query(
        `SELECT DATE_FORMAT(attendance_date, '%Y-%m-%d') AS date,
                ROUND(100 * SUM(status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1) AS rate,
                COUNT(*) AS total
         FROM attendance
         WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY attendance_date
         ORDER BY attendance_date`,
      );

      const recentPayments = await query(
        `SELECT p.id, p.amount, p.method, p.paid_at, i.invoice_no,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.student_no
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         JOIN students s ON s.id = i.student_id
         ORDER BY p.paid_at DESC, p.id DESC
         LIMIT 5`,
      );

      const overdueInvoices = await query(
        `SELECT i.id, i.invoice_no, i.description, i.amount, i.due_date, i.status,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.student_no,
                (i.amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id), 0)) AS balance
         FROM invoices i
         JOIN students s ON s.id = i.student_id
         WHERE i.status <> 'paid' AND i.due_date < CURDATE()
         ORDER BY i.due_date ASC
         LIMIT 5`,
      );

      const notifications = await query(
        `SELECT id, title, message, type, channel, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 5`,
        [req.user.id],
      );

      return res.json({
        role: 'admin',
        stats: statsRows[0],
        enrollment_by_program: enrollmentByProgram,
        attendance_trend: attendanceTrend,
        recent_payments: recentPayments,
        overdue_invoices: overdueInvoices,
        notifications,
      });
    }

    if (req.user.role === 'librarian') {
      const statsRows = await query(
        `SELECT
           (SELECT COUNT(*) FROM books) AS total_books,
           (SELECT COALESCE(SUM(copies_total), 0) FROM books) AS total_copies,
           (SELECT COALESCE(SUM(copies_available), 0) FROM books) AS available_copies,
           (SELECT COUNT(*) FROM library_loans WHERE status = 'borrowed') AS active_loans,
           (SELECT COUNT(*) FROM library_loans
             WHERE status = 'borrowed' AND due_date < CURDATE()) AS overdue_loans`,
      );

      const recentLoans = await query(
        `SELECT l.id, l.date_borrowed, l.due_date, l.returned_at,
                CASE WHEN l.status = 'borrowed' AND l.due_date < CURDATE() THEN 'overdue' ELSE l.status END AS status,
                s.student_no, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                b.title, b.author
         FROM library_loans l
         JOIN students s ON s.id = l.student_id
         JOIN books b ON b.id = l.book_id
         ORDER BY l.id DESC
         LIMIT 6`,
      );

      const notifications = await query(
        `SELECT id, title, message, type, channel, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 5`,
        [req.user.id],
      );

      return res.json({
        role: 'librarian',
        stats: statsRows[0],
        recent_loans: recentLoans,
        notifications,
      });
    }

    const student = await getStudentForUser(req.user.id);

    const statsRows = await query(
      `SELECT
         COALESCE((SELECT ROUND(100 * SUM(status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
           FROM attendance WHERE student_id = ?), 0) AS attendance_rate,
         (SELECT COUNT(*) FROM enrollments WHERE student_id = ? AND status <> 'dropped') AS enrolled,
         COALESCE((SELECT ROUND(AVG(score / max_score * 100), 1)
           FROM grades WHERE student_id = ?), 0) AS avg_grade,
         COALESCE((SELECT SUM(i.amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id), 0))
           FROM invoices i WHERE i.student_id = ? AND i.status <> 'paid'), 0) AS outstanding`,
      [student.id, student.id, student.id, student.id],
    );

    const courses = await query(
      `SELECT c.id, c.code, c.title, c.instructor, c.units, c.schedule, c.room, e.status,
              (SELECT ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
               FROM attendance a
               WHERE a.student_id = e.student_id AND a.course_id = c.id) AS attendance_rate,
              (SELECT ROUND(AVG(g.score / g.max_score * 100), 1)
               FROM grades g
               WHERE g.student_id = e.student_id AND g.course_id = c.id) AS avg_grade
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ? AND e.status <> 'dropped'
       ORDER BY c.code`,
      [student.id],
    );

    const recentGrades = await query(
      `SELECT g.id, g.assignment, g.term, g.score, g.max_score, g.graded_at, c.code, c.title
       FROM grades g
       JOIN courses c ON c.id = g.course_id
       WHERE g.student_id = ?
       ORDER BY g.id DESC
       LIMIT 5`,
      [student.id],
    );

    const invoiceRows = await query(
      `SELECT i.*, (i.amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id), 0)) AS balance
       FROM invoices i
       WHERE i.student_id = ? AND i.status <> 'paid'
       ORDER BY i.due_date ASC
       LIMIT 1`,
      [student.id],
    );

    const notifications = await query(
      `SELECT id, title, message, type, channel, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 5`,
      [req.user.id],
    );

    res.json({
      role: 'student',
      student,
      stats: statsRows[0],
      courses,
      recent_grades: recentGrades,
      next_invoice: invoiceRows[0] || null,
      notifications,
    });
  }),
);

export default router;
