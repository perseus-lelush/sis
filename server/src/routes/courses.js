import { Router } from 'express';
import { getPool, query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, parseId, required } from '../utils/http.js';
import { notifyUsers } from '../utils/notify.js';

const router = Router();

router.use(auth);

const assertUnits = (units) => {
  if (!Number.isInteger(units) || units < 1 || units > 6) {
    throw new HttpError(400, 'Units must be a whole number between 1 and 6');
  }
};

const normalizeCourse = (body, existing = {}) => ({
  code: String(body.code ?? existing.code ?? '').trim().toUpperCase(),
  title: String(body.title ?? existing.title ?? '').trim(),
  instructor: body.instructor !== undefined ? String(body.instructor).trim() : existing.instructor,
  program:
    body.program !== undefined ? String(body.program).trim() : existing.program || 'General',
  units: Number(body.units ?? existing.units ?? 3),
  schedule: body.schedule !== undefined ? String(body.schedule).trim() : existing.schedule,
  room: body.room !== undefined ? String(body.room).trim() : existing.room,
  semester:
    body.semester !== undefined
      ? String(body.semester).trim()
      : existing.semester || 'First Semester 2026',
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'student') {
      const studentRows = await query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!studentRows.length) throw new HttpError(404, 'Student profile not found');
      const studentId = studentRows[0].id;

      const courses = await query(
        `SELECT c.id, c.code, c.title, c.instructor, c.program, c.units, c.schedule, c.room, c.semester, e.status,
                (SELECT ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
                 FROM attendance a
                 WHERE a.student_id = e.student_id AND a.course_id = c.id) AS attendance_rate,
                (SELECT ROUND(AVG(g.score / g.max_score * 100), 1)
                 FROM grades g
                 WHERE g.student_id = e.student_id AND g.course_id = c.id) AS avg_grade,
                (SELECT COUNT(*) FROM grades g
                 WHERE g.student_id = e.student_id AND g.course_id = c.id) AS grade_items
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         WHERE e.student_id = ? AND e.status <> 'dropped'
         ORDER BY c.code`,
        [studentId],
      );

      return res.json({ courses });
    }

    if (req.user.role !== 'admin') {
      throw new HttpError(403, 'Course management is only available to administrators');
    }

    const courses = await query(
      `SELECT c.id, c.code, c.title, c.instructor, c.program, c.units, c.schedule, c.room, c.semester,
              COUNT(e.id) AS enrolled_count,
              COALESCE((SELECT ROUND(AVG(g.score / g.max_score * 100), 1)
                FROM grades g WHERE g.course_id = c.id), 0) AS avg_grade
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.status <> 'dropped'
       GROUP BY c.id, c.code, c.title, c.instructor, c.program, c.units, c.schedule, c.room, c.semester
       ORDER BY c.code`,
    );

    res.json({ courses });
  }),
);

router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const code = String(required(req.body?.code, 'Course code')).trim().toUpperCase();
    const title = String(required(req.body?.title, 'Course title')).trim();
    const data = normalizeCourse({ ...req.body, code, title });
    assertUnits(data.units);

    const duplicate = await query('SELECT id FROM courses WHERE code = ?', [code]);
    if (duplicate.length) throw new HttpError(409, 'A course with this code already exists');

    const result = await query(
      `INSERT INTO courses (code, title, instructor, program, units, schedule, room, semester)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.code,
        data.title,
        data.instructor || null,
        data.program,
        data.units,
        data.schedule || null,
        data.room || null,
        data.semester,
      ],
    );

    res.status(201).json({ id: result.insertId, message: 'Course created' });
  }),
);

router.get(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const courseId = parseId(req.params.id, 'course id');
    const courseRows = await query('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!courseRows.length) throw new HttpError(404, 'Course not found');

    const roster = await query(
      `SELECT e.id AS enrollment_id, e.status, s.id AS student_id, s.student_no,
              CONCAT(s.first_name, ' ', s.last_name) AS name, s.program, s.year_level,
              (SELECT ROUND(AVG(g.score / g.max_score * 100), 1)
               FROM grades g WHERE g.student_id = s.id AND g.course_id = e.course_id) AS avg_grade,
              (SELECT ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
               FROM attendance a WHERE a.student_id = s.id AND a.course_id = e.course_id) AS attendance_rate
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       WHERE e.course_id = ?
       ORDER BY s.last_name, s.first_name`,
      [courseId],
    );

    const recentGrades = await query(
      `SELECT g.id, g.assignment, g.term, g.score, g.max_score, g.graded_at,
              s.student_no, CONCAT(s.first_name, ' ', s.last_name) AS student_name
       FROM grades g
       JOIN students s ON s.id = g.student_id
       WHERE g.course_id = ?
       ORDER BY g.id DESC
       LIMIT 20`,
      [courseId],
    );

    res.json({ course: courseRows[0], roster, recent_grades: recentGrades });
  }),
);

router.put(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const courseId = parseId(req.params.id, 'course id');
    const rows = await query('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!rows.length) throw new HttpError(404, 'Course not found');

    const data = normalizeCourse(req.body || {}, rows[0]);
    if (!data.code || !data.title) throw new HttpError(400, 'Course code and title are required');
    assertUnits(data.units);

    const duplicate = await query('SELECT id FROM courses WHERE code = ? AND id <> ?', [
      data.code,
      courseId,
    ]);
    if (duplicate.length) throw new HttpError(409, 'A course with this code already exists');

    await query(
      `UPDATE courses SET code = ?, title = ?, instructor = ?, program = ?, units = ?,
              schedule = ?, room = ?, semester = ?
       WHERE id = ?`,
      [
        data.code,
        data.title,
        data.instructor || null,
        data.program,
        data.units,
        data.schedule || null,
        data.room || null,
        data.semester,
        courseId,
      ],
    );

    res.json({ message: 'Course updated' });
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const courseId = parseId(req.params.id, 'course id');
    const rows = await query('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!rows.length) throw new HttpError(404, 'Course not found');
    await query('DELETE FROM courses WHERE id = ?', [courseId]);
    res.json({ message: 'Course removed' });
  }),
);

router.post(
  '/:id/enroll',
  adminOnly,
  asyncHandler(async (req, res) => {
    const courseId = parseId(req.params.id, 'course id');
    const studentId = parseId(required(req.body?.student_id, 'Student'), 'student id');

    const courseRows = await query('SELECT code, title FROM courses WHERE id = ?', [courseId]);
    if (!courseRows.length) throw new HttpError(404, 'Course not found');

    const studentRows = await query(
      'SELECT id, user_id FROM students WHERE id = ?',
      [studentId],
    );
    if (!studentRows.length) throw new HttpError(404, 'Student not found');

    const existing = await query(
      'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
      [studentId, courseId],
    );
    if (existing.length) throw new HttpError(409, 'Student is already enrolled in this course');

    await query(
      `INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'enrolled')`,
      [studentId, courseId],
    );

    await notifyUsers([studentRows[0].user_id], {
      title: `Enrolled in ${courseRows[0].code}`,
      message: `You have been enrolled in ${courseRows[0].code} - ${courseRows[0].title}.`,
      type: 'enrollment',
      channel: 'in_app,email',
    });

    res.status(201).json({ message: 'Student enrolled' });
  }),
);

router.delete(
  '/:id/students/:studentId',
  adminOnly,
  asyncHandler(async (req, res) => {
    const courseId = parseId(req.params.id, 'course id');
    const studentId = parseId(req.params.studentId, 'student id');

    const existing = await query(
      'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?',
      [studentId, courseId],
    );
    if (!existing.length) throw new HttpError(404, 'Enrollment not found');

    const pool = await getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM attendance WHERE student_id = ? AND course_id = ?', [
        studentId,
        courseId,
      ]);
      await connection.query('DELETE FROM grades WHERE student_id = ? AND course_id = ?', [
        studentId,
        courseId,
      ]);
      await connection.query('DELETE FROM enrollments WHERE student_id = ? AND course_id = ?', [
        studentId,
        courseId,
      ]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.json({ message: 'Student removed from course' });
  }),
);

export default router;
