import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool, query } from '../db.js';
import { adminOnly, auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, parseId, parseISODate, required } from '../utils/http.js';
import { notifyUsers, simulateDelivery } from '../utils/notify.js';
import { currentSequence, nextSequence } from '../utils/sequence.js';
import { addDaysISO } from '../utils/dates.js';

const router = Router();

const studentFields = [
  'first_name',
  'last_name',
  'dob',
  'gender',
  'email',
  'phone',
  'address',
  'program',
  'year_level',
  'section',
  'guardian_name',
  'guardian_phone',
  'status',
];

const normalizeStudentInput = (body) => {
  const data = {};
  for (const field of studentFields) {
    if (body[field] !== undefined) {
      data[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
    }
  }
  if (data.email !== undefined) data.email = data.email.toLowerCase();
  if (data.dob !== undefined) {
    data.dob = data.dob === '' || data.dob === null ? null : parseISODate(data.dob, 'date of birth');
  }
  if (data.gender === '') data.gender = null;
  if (data.gender && !['Male', 'Female', 'Other'].includes(data.gender)) data.gender = null;
  if (data.year_level !== undefined) data.year_level = Number(data.year_level) || 1;
  if (data.status && !['active', 'inactive', 'graduated'].includes(data.status)) {
    data.status = 'active';
  }
  return data;
};

router.use(auth);

router.get(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const program = String(req.query.program || '').trim();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(
        `(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_no LIKE ? OR s.email LIKE ?)`,
      );
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }
    if (program) {
      conditions.push('s.program = ?');
      params.push(program);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const students = await query(
      `SELECT s.id, s.user_id, s.student_no, s.first_name, s.last_name,
              CONCAT(s.first_name, ' ', s.last_name) AS full_name,
              s.email, s.phone, s.program, s.year_level, s.section, s.status, s.created_at,
              s.dob, s.gender, s.address, s.guardian_name, s.guardian_phone,
              u.is_active,
              (SELECT ROUND(100 * SUM(a.status IN ('present', 'late')) / NULLIF(COUNT(*), 0), 1)
               FROM attendance a WHERE a.student_id = s.id) AS attendance_rate,
              (SELECT COUNT(*) FROM enrollments e
               WHERE e.student_id = s.id AND e.status <> 'dropped') AS course_count,
              COALESCE((SELECT SUM(i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0))
               FROM invoices i WHERE i.student_id = s.id AND i.status <> 'paid'), 0) AS balance
       FROM students s
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.last_name, s.first_name`,
      params,
    );

    res.json({ students });
  }),
);

router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const firstName = String(required(body.first_name, 'First name')).trim();
    const lastName = String(required(body.last_name, 'Last name')).trim();
    const email = String(required(body.email, 'Email')).trim().toLowerCase();
    const program = String(required(body.program, 'Program')).trim();

    if (!email.includes('@')) throw new HttpError(400, 'Please enter a valid email address');

    const data = normalizeStudentInput({
      ...body,
      first_name: firstName,
      last_name: lastName,
      email,
      program,
    });

    const pool = await getPool();
    const connection = await pool.getConnection();
    let studentId;

    try {
      await connection.beginTransaction();

      const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length) {
        throw new HttpError(409, 'An account with this email already exists');
      }

      const password = String(body.password || 'student123');
      const passwordHash = await bcrypt.hash(password, 10);
      const fullName = `${firstName} ${lastName}`;

      const [userResult] = await connection.query(
        'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
        [email, passwordHash, 'student', fullName],
      );

      const year = new Date().getFullYear();
      const studentNo = await nextSequence(connection, {
        counter: `students:${year}`,
        prefix: `${year}-`,
        seed: await currentSequence(connection, 'students', 'student_no', `${year}-`),
      });

      const [studentResult] = await connection.query(
        `INSERT INTO students
          (user_id, student_no, first_name, last_name, dob, gender, email, phone, address,
           program, year_level, section, guardian_name, guardian_phone, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userResult.insertId,
          studentNo,
          firstName,
          lastName,
          data.dob || null,
          data.gender || null,
          email,
          data.phone || null,
          data.address || null,
          program,
          data.year_level || 1,
          data.section || null,
          data.guardian_name || null,
          data.guardian_phone || null,
          data.status || 'active',
        ],
      );
      studentId = studentResult.insertId;

      await connection.query(
        `INSERT INTO enrollments (student_id, course_id, status)
         SELECT ?, id, 'pending' FROM courses WHERE program = ? OR program = 'General'`,
        [studentId, program],
      );

      const invoiceNo = await nextSequence(connection, {
        counter: `invoices:${year}`,
        prefix: `INV-${year}-`,
        seed: await currentSequence(connection, 'invoices', 'invoice_no', `INV-${year}-`),
      });
      await connection.query(
        `INSERT INTO invoices (invoice_no, student_id, description, amount, due_date, status)
         VALUES (?, ?, ?, ?, ?, 'unpaid')`,
        [
          invoiceNo,
          studentId,
          `Enrollment Fee - First Semester ${year}`,
          5000,
          addDaysISO(14),
        ],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const title = 'Welcome to the SIS student portal';
    const message =
      'Your student account has been created and your LMS courses are pending activation. Review and settle your enrollment fee in the Billing module to activate your classes.';
    await notifyUsers([await getUserIdForStudent(studentId)], {
      title,
      message,
      type: 'enrollment',
      channel: 'in_app,email',
    });
    simulateDelivery(['email'], 1, title);

    res.status(201).json({ id: studentId, message: 'Student account created' });
  }),
);

router.get(
  '/:id/schedule',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'student id');
    if (req.user.role === 'student') {
      const own = await query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!own.length || Number(own[0].id) !== id) {
        throw new HttpError(403, 'You can only view your own schedule');
      }
    }

    const studentRows = await query(
      `SELECT id, student_no, CONCAT(first_name, ' ', last_name) AS full_name, program
       FROM students WHERE id = ?`,
      [id],
    );
    if (!studentRows.length) throw new HttpError(404, 'Student not found');

    const schedule = await query(
      `SELECT c.id AS course_id, c.code, c.title, c.instructor, c.units, c.schedule, c.room,
              c.semester, e.status
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ? AND e.status <> 'dropped'
       ORDER BY c.code`,
      [id],
    );

    res.json({ student: studentRows[0], schedule });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'student id');

    if (req.user.role === 'student') {
      const own = await query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!own.length || Number(own[0].id) !== id) {
        throw new HttpError(403, 'You can only view your own profile');
      }
    } else if (req.user.role !== 'admin') {
      throw new HttpError(403, 'Not authorized');
    }

    const rows = await query(
      `SELECT s.*, CONCAT(s.first_name, ' ', s.last_name) AS full_name,
              u.email AS account_email, u.is_active, u.created_at AS account_created_at
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
      [id],
    );
    const student = rows[0];
    if (!student) throw new HttpError(404, 'Student not found');

    const enrollments = await query(
      `SELECT e.id, e.status, e.enrolled_at, c.id AS course_id, c.code, c.title, c.instructor,
              c.units, c.schedule, c.room,
              (SELECT ROUND(AVG(g.score / g.max_score * 100), 1)
               FROM grades g WHERE g.student_id = e.student_id AND g.course_id = c.id) AS avg_grade
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ?
       ORDER BY c.code`,
      [id],
    );

    const attendanceSummary = await query(
      `SELECT c.id AS course_id, c.code, c.title,
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
      [id],
    );

    const attendance = await query(
      `SELECT a.id, a.attendance_date AS date, a.status, a.remarks, c.code, c.title
       FROM attendance a
       JOIN courses c ON c.id = a.course_id
       WHERE a.student_id = ?
       ORDER BY a.attendance_date DESC, c.code
       LIMIT 40`,
      [id],
    );

    const grades = await query(
      `SELECT g.id, g.term, g.assignment, g.score, g.max_score, g.graded_at, c.code, c.title
       FROM grades g
       JOIN courses c ON c.id = g.course_id
       WHERE g.student_id = ?
       ORDER BY g.id DESC`,
      [id],
    );

    const invoices = await query(
      `SELECT i.*,
              COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid,
              (i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0)) AS balance
       FROM invoices i
       WHERE i.student_id = ?
       ORDER BY i.due_date DESC, i.id DESC`,
      [id],
    );

    res.json({ student, enrollments, attendance_summary: attendanceSummary, attendance, grades, invoices });
  }),
);

router.put(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'student id');
    const rows = await query(
      `SELECT s.*, u.id AS account_id FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [id],
    );
    const existing = rows[0];
    if (!existing) throw new HttpError(404, 'Student not found');

    const body = req.body || {};
    const data = normalizeStudentInput(body);
    const email = data.email || existing.email;
    if (!email.includes('@')) throw new HttpError(400, 'Please enter a valid email address');

    const pool = await getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [duplicate] = await connection.query(
        'SELECT id FROM users WHERE email = ? AND id <> ?',
        [email, existing.account_id],
      );
      if (duplicate.length) throw new HttpError(409, 'Another account already uses this email');

      const firstName = data.first_name || existing.first_name;
      const lastName = data.last_name || existing.last_name;
      const fullName = `${firstName} ${lastName}`;
      const status = data.status || existing.status;

      // Keep the login flag in sync with the student record: an inactive
      // student must not be able to sign in, and reactivating restores access.
      await connection.query('UPDATE users SET name = ?, email = ?, is_active = ? WHERE id = ?', [
        fullName,
        email,
        status === 'inactive' ? 0 : 1,
        existing.account_id,
      ]);

      if (body.password) {
        const passwordHash = await bcrypt.hash(String(body.password), 10);
        await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [
          passwordHash,
          existing.account_id,
        ]);
      }

      const next = {
        first_name: firstName,
        last_name: lastName,
        dob: data.dob !== undefined ? data.dob : existing.dob,
        gender: data.gender !== undefined ? data.gender : existing.gender,
        email,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        address: data.address !== undefined ? data.address : existing.address,
        program: data.program || existing.program,
        year_level: data.year_level !== undefined ? data.year_level : existing.year_level,
        section: data.section !== undefined ? data.section : existing.section,
        guardian_name:
          data.guardian_name !== undefined ? data.guardian_name : existing.guardian_name,
        guardian_phone:
          data.guardian_phone !== undefined ? data.guardian_phone : existing.guardian_phone,
        status,
      };

      await connection.query(
        `UPDATE students SET
          first_name = ?, last_name = ?, dob = ?, gender = ?, email = ?, phone = ?, address = ?,
          program = ?, year_level = ?, section = ?, guardian_name = ?, guardian_phone = ?, status = ?
         WHERE id = ?`,
        [
          next.first_name,
          next.last_name,
          next.dob,
          next.gender,
          next.email,
          next.phone,
          next.address,
          next.program,
          next.year_level,
          next.section,
          next.guardian_name,
          next.guardian_phone,
          next.status,
          id,
        ],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.json({ message: 'Student updated' });
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'student id');
    const rows = await query('SELECT user_id FROM students WHERE id = ?', [id]);
    if (!rows.length) throw new HttpError(404, 'Student not found');
    await query('DELETE FROM users WHERE id = ?', [rows[0].user_id]);
    res.json({ message: 'Student removed' });
  }),
);

async function getUserIdForStudent(studentId) {
  const rows = await query('SELECT user_id FROM students WHERE id = ?', [studentId]);
  return rows[0]?.user_id;
}

export default router;
