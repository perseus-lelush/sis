import { Router } from 'express';
import { query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, parseId, required } from '../utils/http.js';
import { notifyUsers } from '../utils/notify.js';

const router = Router();

router.use(auth);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'student') {
      throw new HttpError(403, 'Student grades are only available to student accounts');
    }
    const studentRows = await query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!studentRows.length) throw new HttpError(404, 'Student profile not found');

    const grades = await query(
      `SELECT g.id, g.term, g.assignment, g.score, g.max_score, g.graded_at,
              c.id AS course_id, c.code, c.title
       FROM grades g
       JOIN courses c ON c.id = g.course_id
       WHERE g.student_id = ?
       ORDER BY c.code, g.id`,
      [studentRows[0].id],
    );

    res.json({ grades });
  }),
);

router.get(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const conditions = [];
    const params = [];
    if (req.query.course_id) {
      conditions.push('g.course_id = ?');
      params.push(parseId(req.query.course_id, 'course id'));
    }
    if (req.query.student_id) {
      conditions.push('g.student_id = ?');
      params.push(parseId(req.query.student_id, 'student id'));
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const grades = await query(
      `SELECT g.id, g.term, g.assignment, g.score, g.max_score, g.graded_at,
              c.code, c.title, s.student_no,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name
       FROM grades g
       JOIN courses c ON c.id = g.course_id
       JOIN students s ON s.id = g.student_id
       ${where}
       ORDER BY g.id DESC
       LIMIT 100`,
      params,
    );

    res.json({ grades });
  }),
);

router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const studentId = parseId(required(req.body?.student_id, 'Student'), 'student id');
    const courseId = parseId(required(req.body?.course_id, 'Course'), 'course id');
    const assignment = String(required(req.body?.assignment, 'Assignment')).trim();
    const term = String(req.body?.term || 'Midterm').trim();
    const score = Number(required(req.body?.score, 'Score'));
    const maxScore = Number(req.body?.max_score || 100);

    if (!Number.isFinite(score) || score < 0) throw new HttpError(400, 'Score must be a positive number');
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      throw new HttpError(400, 'Maximum score must be greater than zero');
    }
    if (score > maxScore) {
      throw new HttpError(400, 'Score cannot be greater than the maximum score');
    }

    const enrollment = await query(
      'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
      [studentId, courseId],
    );
    if (!enrollment.length) {
      throw new HttpError(400, 'Student is not enrolled in this course');
    }

    const courseRows = await query('SELECT code, title FROM courses WHERE id = ?', [courseId]);
    if (!courseRows.length) throw new HttpError(404, 'Course not found');

    const studentRows = await query('SELECT user_id FROM students WHERE id = ?', [studentId]);
    if (!studentRows.length) throw new HttpError(404, 'Student not found');

    const result = await query(
      `INSERT INTO grades (student_id, course_id, term, assignment, score, max_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [studentId, courseId, term, assignment, score, maxScore],
    );

    await notifyUsers([studentRows[0].user_id], {
      title: `New grade posted in ${courseRows[0].code}`,
      message: `${assignment} (${term}) has been posted: ${score}/${maxScore}. Open the LMS module to view your grades.`,
      type: 'grade',
      channel: 'in_app,email',
    });

    res.status(201).json({ id: result.insertId, message: 'Grade recorded' });
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const gradeId = parseId(req.params.id, 'grade id');
    const rows = await query('SELECT id FROM grades WHERE id = ?', [gradeId]);
    if (!rows.length) throw new HttpError(404, 'Grade not found');
    await query('DELETE FROM grades WHERE id = ?', [gradeId]);
    res.json({ message: 'Grade removed' });
  }),
);

export default router;
