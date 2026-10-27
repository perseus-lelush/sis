import { Router } from 'express';
import { query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const pad = (value) => String(value).padStart(2, '0');

router.use(auth, adminOnly);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const statsRows = await query(
      `SELECT
         (SELECT COUNT(*) FROM students WHERE status = 'active') AS total_students,
         COALESCE((SELECT ROUND(100 * SUM(status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
           FROM attendance), 0) AS attendance_rate,
         COALESCE((SELECT ROUND(100 * SUM(amount) / NULLIF((SELECT SUM(amount) FROM invoices), 0), 1)
           FROM payments), 0) AS collection_rate,
         COALESCE((SELECT ROUND(AVG(score / max_score * 100), 1) FROM grades), 0) AS avg_grade,
         (SELECT COUNT(*) FROM books) AS total_books,
         (SELECT COALESCE(SUM(copies_available), 0) FROM books) AS available_copies,
         (SELECT COUNT(*) FROM library_loans WHERE status = 'borrowed') AS active_loans,
         (SELECT COUNT(*) FROM library_loans
           WHERE status = 'borrowed' AND due_date < CURDATE()) AS overdue_loans`,
    );

    const enrollmentByProgram = await query(
      `SELECT program, COUNT(*) AS count
       FROM students
       WHERE status = 'active'
       GROUP BY program
       ORDER BY count DESC`,
    );

    const attendanceByCourse = await query(
      `SELECT c.id, c.code, c.title,
              COUNT(a.id) AS records,
              COALESCE(ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(a.id), 0), 1), 0) AS rate
       FROM courses c
       LEFT JOIN attendance a ON a.course_id = c.id
       GROUP BY c.id, c.code, c.title
       ORDER BY rate DESC`,
    );

    const gradeRows = await query(
      `SELECT CASE
                WHEN score / max_score * 100 >= 90 THEN '90-100'
                WHEN score / max_score * 100 >= 80 THEN '80-89'
                WHEN score / max_score * 100 >= 70 THEN '70-79'
                WHEN score / max_score * 100 >= 60 THEN '60-69'
                ELSE 'Below 60'
              END AS bucket,
              COUNT(*) AS count
       FROM grades
       GROUP BY bucket`,
    );
    const gradeDistribution = ['90-100', '80-89', '70-79', '60-69', 'Below 60'].map((bucket) => ({
      bucket,
      count: Number(gradeRows.find((row) => row.bucket === bucket)?.count || 0),
    }));

    const revenueRows = await query(
      `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(amount) AS total
       FROM payments
       WHERE paid_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month
       ORDER BY month`,
    );

    const months = [];
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - index);
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      const match = revenueRows.find((row) => row.month === key);
      months.push({ month: key, total: Number(match?.total || 0) });
    }

    const atRisk = await query(
      `SELECT s.id, s.student_no, CONCAT(s.first_name, ' ', s.last_name) AS name, s.program,
              COALESCE((SELECT ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
                FROM attendance a WHERE a.student_id = s.id), 0) AS attendance_rate,
              COALESCE((SELECT SUM(i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0))
                FROM invoices i WHERE i.student_id = s.id AND i.status <> 'paid'), 0) AS balance
       FROM students s
       WHERE s.status = 'active'
       HAVING attendance_rate < 85 OR balance > 0
       ORDER BY attendance_rate ASC, balance DESC
       LIMIT 10`,
    );

    const accountStatusRows = await query(
      `SELECT i.status, COUNT(*) AS count,
              COALESCE(SUM(i.amount - COALESCE(
                (SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0)), 0) AS balance
       FROM invoices i
       GROUP BY i.status`,
    );
    const accountStatus = ['paid', 'partial', 'unpaid', 'overdue'].map((status) => {
      const row = accountStatusRows.find((item) => item.status === status);
      return {
        status,
        count: Number(row?.count || 0),
        balance: Number(row?.balance || 0),
      };
    });

    const recentEnrollments = await query(
      `SELECT e.id, e.status, e.enrolled_at, s.student_no,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              c.code, c.title
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN courses c ON c.id = e.course_id
       ORDER BY e.enrolled_at DESC, e.id DESC
       LIMIT 8`,
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
       LIMIT 8`,
    );

    const auditLogs = await query(
      `SELECT id, actor, role, method, path, status, created_at
       FROM audit_logs
       ORDER BY id DESC
       LIMIT 8`,
    );

    res.json({
      stats: statsRows[0],
      enrollment_by_program: enrollmentByProgram,
      enrollment_list: recentEnrollments,
      attendance_by_course: attendanceByCourse,
      grade_distribution: gradeDistribution,
      revenue_by_month: months,
      at_risk: atRisk,
      account_status: accountStatus,
      library: {
        recent_loans: recentLoans,
      },
      audit_logs: auditLogs,
    });
  }),
);

export default router;
