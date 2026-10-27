import { Router } from 'express';
import { getPool, query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, parseId, required } from '../utils/http.js';
import { notifyUsers } from '../utils/notify.js';

const router = Router();

const STATUSES = ['pending', 'enrolled', 'completed', 'dropped'];

router.use(auth, adminOnly);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conditions = [];
    const params = [];

    if (req.query.student_id) {
      conditions.push('e.student_id = ?');
      params.push(parseId(req.query.student_id, 'student id'));
    }
    if (req.query.course_id) {
      conditions.push('e.course_id = ?');
      params.push(parseId(req.query.course_id, 'course id'));
    }
    if (req.query.status && STATUSES.includes(req.query.status)) {
      conditions.push('e.status = ?');
      params.push(req.query.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const enrollments = await query(
      `SELECT e.id, e.student_id, e.course_id, e.status, e.enrolled_at,
              s.student_no, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.program,
              c.code, c.title, c.semester, c.schedule, c.room
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN courses c ON c.id = e.course_id
       ${where}
       ORDER BY e.enrolled_at DESC, e.id DESC
       LIMIT 300`,
      params,
    );

    res.json({ enrollments });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const studentId = parseId(required(req.body?.student_id, 'Student'), 'student id');
    const courseId = parseId(required(req.body?.course_id, 'Course'), 'course id');
    const status = STATUSES.includes(req.body?.status) ? req.body.status : 'enrolled';

    const studentRows = await query('SELECT id, user_id FROM students WHERE id = ?', [studentId]);
    if (!studentRows.length) throw new HttpError(404, 'Student not found');
    const courseRows = await query('SELECT id, code, title FROM courses WHERE id = ?', [courseId]);
    if (!courseRows.length) throw new HttpError(404, 'Course not found');

    const existing = await query(
      'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
      [studentId, courseId],
    );
    if (existing.length) throw new HttpError(409, 'This student is already enrolled in the course');

    const result = await query(
      'INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, ?)',
      [studentId, courseId, status],
    );

    await notifyUsers([studentRows[0].user_id], {
      title: `Enrollment update: ${courseRows[0].code}`,
      message: `Your enrollment record for ${courseRows[0].code} - ${courseRows[0].title} is now ${status}.`,
      type: 'enrollment',
      channel: 'in_app,email',
    });

    res.status(201).json({
      id: result.insertId,
      message: 'Enrollment record created',
    });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const enrollmentId = parseId(req.params.id, 'enrollment id');
    const status = String(required(req.body?.status, 'Status'));
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid enrollment status');

    const rows = await query(
      `SELECT e.id, e.student_id, c.code, c.title, s.user_id
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN courses c ON c.id = e.course_id
       WHERE e.id = ?`,
      [enrollmentId],
    );
    if (!rows.length) throw new HttpError(404, 'Enrollment not found');

    await query('UPDATE enrollments SET status = ? WHERE id = ?', [status, enrollmentId]);

    await notifyUsers([rows[0].user_id], {
      title: `Enrollment status updated: ${rows[0].code}`,
      message: `Your enrollment status for ${rows[0].code} - ${rows[0].title} is now ${status}.`,
      type: 'enrollment',
    });

    res.json({ message: 'Enrollment updated' });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const enrollmentId = parseId(req.params.id, 'enrollment id');
    const rows = await query(
      'SELECT student_id, course_id FROM enrollments WHERE id = ?',
      [enrollmentId],
    );
    if (!rows.length) throw new HttpError(404, 'Enrollment not found');

    const pool = await getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM attendance WHERE student_id = ? AND course_id = ?', [
        rows[0].student_id,
        rows[0].course_id,
      ]);
      await connection.query('DELETE FROM grades WHERE student_id = ? AND course_id = ?', [
        rows[0].student_id,
        rows[0].course_id,
      ]);
      await connection.query('DELETE FROM enrollments WHERE id = ?', [enrollmentId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.json({ message: 'Enrollment removed' });
  }),
);

export default router;
