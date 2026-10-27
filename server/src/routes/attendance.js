import { Router } from 'express';
import { getPool, query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, parseId, parseISODate, required } from '../utils/http.js';
import { notifyUsers } from '../utils/notify.js';
import { todayISO } from '../utils/dates.js';

const router = Router();
const STATUSES = ['present', 'absent', 'late', 'excused'];

router.use(auth);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'student') {
      throw new HttpError(403, 'Student attendance is only available to student accounts');
    }
    const studentRows = await query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!studentRows.length) throw new HttpError(404, 'Student profile not found');
    const studentId = studentRows[0].id;

    const summaryRows = await query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(a.status = 'present'), 0) AS present,
              COALESCE(SUM(a.status = 'absent'), 0) AS absent,
              COALESCE(SUM(a.status = 'late'), 0) AS late,
              COALESCE(SUM(a.status = 'excused'), 0) AS excused,
              COALESCE(ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1), 0) AS rate
       FROM attendance a
       WHERE a.student_id = ?`,
      [studentId],
    );

    const courses = await query(
      `SELECT c.id, c.code, c.title,
              COUNT(a.id) AS total,
              COALESCE(SUM(a.status = 'present'), 0) AS present,
              COALESCE(SUM(a.status = 'absent'), 0) AS absent,
              COALESCE(SUM(a.status = 'late'), 0) AS late,
              COALESCE(SUM(a.status = 'excused'), 0) AS excused,
              COALESCE(ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(a.id), 0), 1), 0) AS rate
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN attendance a ON a.student_id = e.student_id AND a.course_id = e.course_id
       WHERE e.student_id = ? AND e.status <> 'dropped'
       GROUP BY c.id, c.code, c.title
       ORDER BY c.code`,
      [studentId],
    );

    const records = await query(
      `SELECT a.id, a.attendance_date AS date, a.status, a.remarks, c.code, c.title
       FROM attendance a
       JOIN courses c ON c.id = a.course_id
       WHERE a.student_id = ?
       ORDER BY a.attendance_date DESC, c.code
       LIMIT 60`,
      [studentId],
    );

    res.json({ summary: summaryRows[0], courses, records });
  }),
);

router.get(
  '/sheet',
  adminOnly,
  asyncHandler(async (req, res) => {
    const courseId = parseId(required(req.query.course_id, 'Course'), 'course id');
    const date = parseISODate(req.query.date || todayISO(), 'date');

    const courseRows = await query('SELECT id, code, title FROM courses WHERE id = ?', [courseId]);
    if (!courseRows.length) throw new HttpError(404, 'Course not found');

    const roster = await query(
      `SELECT s.id AS student_id, s.student_no,
              CONCAT(s.first_name, ' ', s.last_name) AS name,
              a.status, a.remarks
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN attendance a
         ON a.student_id = e.student_id AND a.course_id = e.course_id AND a.attendance_date = ?
       WHERE e.course_id = ? AND e.status <> 'dropped'
       ORDER BY s.last_name, s.first_name`,
      [date, courseId],
    );

    res.json({ course: courseRows[0], date, roster });
  }),
);

router.post(
  '/sheet',
  adminOnly,
  asyncHandler(async (req, res) => {
    const courseId = parseId(required(req.body?.course_id, 'Course'), 'course id');
    const date = parseISODate(required(req.body?.date, 'Date'), 'date');

    const records = Array.isArray(req.body?.records) ? req.body.records : [];
    if (!records.length) throw new HttpError(400, 'No attendance records submitted');

    const courseRows = await query('SELECT id, code, title FROM courses WHERE id = ?', [courseId]);
    if (!courseRows.length) throw new HttpError(404, 'Course not found');
    const course = courseRows[0];

    const roster = await query(
      `SELECT s.id AS student_id, s.user_id, CONCAT(s.first_name, ' ', s.last_name) AS name
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       WHERE e.course_id = ? AND e.status <> 'dropped'`,
      [courseId],
    );
    const rosterMap = new Map(roster.map((row) => [row.student_id, row]));

    const existing = await query(
      `SELECT student_id, status FROM attendance WHERE course_id = ? AND attendance_date = ?`,
      [courseId, date],
    );
    const previousStatus = new Map(existing.map((row) => [row.student_id, row.status]));

    const validRecords = records.filter((record) => {
      const studentId = Number(record.student_id);
      return rosterMap.has(studentId) && STATUSES.includes(record.status);
    });

    if (!validRecords.length) throw new HttpError(400, 'No valid attendance records submitted');

    const pool = await getPool();
    const connection = await pool.getConnection();
    const notifications = [];

    try {
      await connection.beginTransaction();

      for (const record of validRecords) {
        const studentId = Number(record.student_id);
        const remarks = record.remarks ? String(record.remarks).trim().slice(0, 255) : null;

        await connection.query(
          `INSERT INTO attendance (student_id, course_id, attendance_date, status, remarks)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = ?, remarks = ?`,
          [studentId, courseId, date, record.status, remarks, record.status, remarks],
        );

        if (
          ['absent', 'late'].includes(record.status) &&
          previousStatus.get(studentId) !== record.status
        ) {
          const student = rosterMap.get(studentId);
          notifications.push({
            userId: student.user_id,
            title:
              record.status === 'absent' ? 'Absence recorded' : 'Late arrival recorded',
            message: `You were marked ${record.status} in ${course.code} - ${course.title} on ${date}.`,
          });
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    for (const notification of notifications) {
      await notifyUsers([notification.userId], {
        title: notification.title,
        message: notification.message,
        type: 'attendance',
        channel: 'in_app,sms',
      });
    }

    res.json({
      message: 'Attendance saved',
      saved: validRecords.length,
      notified: notifications.length,
    });
  }),
);

export default router;
