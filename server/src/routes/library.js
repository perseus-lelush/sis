import { Router } from 'express';
import { getPool, query } from '../db.js';
import { allowRoles, auth } from '../middleware/auth.js';
import { asyncHandler, HttpError, parseId, parseISODate, required } from '../utils/http.js';
import { notifyUsers } from '../utils/notify.js';
import { addDaysISO, todayISO } from '../utils/dates.js';

const router = Router();

const staff = allowRoles('admin', 'librarian');

const LOAN_SELECT = `
  SELECT l.id, l.student_id, l.book_id, l.date_borrowed, l.due_date, l.returned_at,
         CASE WHEN l.status = 'borrowed' AND l.due_date < CURDATE() THEN 'overdue' ELSE l.status END AS status,
         s.student_no, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
         s.program, b.title, b.author, b.isbn
  FROM library_loans l
  JOIN students s ON s.id = l.student_id
  JOIN books b ON b.id = l.book_id
`;

const getStudentForUser = async (userId) => {
  const rows = await query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  if (!rows.length) throw new HttpError(404, 'Student profile not found');
  return rows[0];
};

router.use(auth);

router.get(
  '/students',
  staff,
  asyncHandler(async (req, res) => {
    const students = await query(
      `SELECT id, student_no, CONCAT(first_name, ' ', last_name) AS full_name, program, status
       FROM students
       WHERE status = 'active'
       ORDER BY last_name, first_name`,
    );
    res.json({ students });
  }),
);

router.get(
  '/books',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(title LIKE ? OR author LIKE ? OR isbn LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const books = await query(
      `SELECT id, isbn, title, author, category, copies_total, copies_available, created_at
       FROM books ${where}
       ORDER BY title`,
      params,
    );

    res.json({ books });
  }),
);

router.post(
  '/books',
  staff,
  asyncHandler(async (req, res) => {
    const book = normalizeBook(req.body);
    const duplicate = await query('SELECT id FROM books WHERE isbn = ?', [book.isbn]);
    if (duplicate.length) throw new HttpError(409, 'A book with this ISBN already exists');

    const result = await query(
      `INSERT INTO books (isbn, title, author, category, copies_total, copies_available)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [book.isbn, book.title, book.author, book.category, book.copies_total, book.copies_total],
    );

    res.status(201).json({ id: result.insertId, message: 'Book added to the catalog' });
  }),
);

router.put(
  '/books/:id',
  staff,
  asyncHandler(async (req, res) => {
    const bookId = parseId(req.params.id, 'book id');
    const rows = await query('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!rows.length) throw new HttpError(404, 'Book not found');

    const book = normalizeBook(req.body, rows[0]);
    const onLoan = Number(rows[0].copies_total) - Number(rows[0].copies_available);
    if (book.copies_total < onLoan) {
      throw new HttpError(400, `At least ${onLoan} copies are currently on loan`);
    }

    const duplicate = await query('SELECT id FROM books WHERE isbn = ? AND id <> ?', [
      book.isbn,
      bookId,
    ]);
    if (duplicate.length) throw new HttpError(409, 'A book with this ISBN already exists');

    await query(
      `UPDATE books SET isbn = ?, title = ?, author = ?, category = ?,
              copies_total = ?, copies_available = ?
       WHERE id = ?`,
      [
        book.isbn,
        book.title,
        book.author,
        book.category,
        book.copies_total,
        book.copies_total - onLoan,
        bookId,
      ],
    );

    res.json({ message: 'Book updated' });
  }),
);

router.delete(
  '/books/:id',
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    const bookId = parseId(req.params.id, 'book id');
    const active = await query(
      `SELECT COUNT(*) AS count FROM library_loans
       WHERE book_id = ? AND status = 'borrowed'`,
      [bookId],
    );
    if (Number(active[0].count) > 0) {
      throw new HttpError(409, 'Return all borrowed copies before removing this book');
    }
    const result = await query('DELETE FROM books WHERE id = ?', [bookId]);
    if (!result.affectedRows) throw new HttpError(404, 'Book not found');
    res.json({ message: 'Book removed from the catalog' });
  }),
);

router.get(
  '/loans',
  asyncHandler(async (req, res) => {
    const conditions = [];
    const params = [];
    const status = String(req.query.status || '').trim();

    if (req.user.role === 'student') {
      const student = await getStudentForUser(req.user.id);
      conditions.push('l.student_id = ?');
      params.push(student.id);
    }
    if (status === 'borrowed') {
      conditions.push(`l.status = 'borrowed' AND l.due_date >= CURDATE()`);
    } else if (status === 'overdue') {
      conditions.push(`l.status = 'borrowed' AND l.due_date < CURDATE()`);
    } else if (status === 'returned') {
      conditions.push(`l.status = 'returned'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const loans = await query(
      `${LOAN_SELECT} ${where}
       ORDER BY (l.status = 'borrowed') DESC, l.due_date ASC, l.id DESC
       LIMIT 200`,
      params,
    );

    res.json({ loans });
  }),
);

router.post(
  '/loans',
  staff,
  asyncHandler(async (req, res) => {
    const studentId = parseId(required(req.body?.student_id, 'Student'), 'student id');
    const bookId = parseId(required(req.body?.book_id, 'Book'), 'book id');
    const dueDate = req.body?.due_date
      ? parseISODate(req.body.due_date, 'due date')
      : addDaysISO(14);
    if (dueDate < todayISO()) {
      throw new HttpError(400, 'Due date cannot be in the past');
    }

    const studentRows = await query('SELECT id, user_id FROM students WHERE id = ?', [studentId]);
    if (!studentRows.length) throw new HttpError(404, 'Student not found');
    const bookRows = await query('SELECT id, title, copies_available FROM books WHERE id = ?', [
      bookId,
    ]);
    if (!bookRows.length) throw new HttpError(404, 'Book not found');
    if (Number(bookRows[0].copies_available) < 1) {
      throw new HttpError(409, 'No copies of this book are available');
    }

    const pool = await getPool();
    const connection = await pool.getConnection();
    let loanId;
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `INSERT INTO library_loans (student_id, book_id, date_borrowed, due_date, status)
         VALUES (?, ?, ?, ?, 'borrowed')`,
        [studentId, bookId, todayISO(), dueDate],
      );
      loanId = result.insertId;
      await connection.query(
        'UPDATE books SET copies_available = copies_available - 1 WHERE id = ?',
        [bookId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await notifyUsers([studentRows[0].user_id], {
      title: `Book borrowed: ${bookRows[0].title}`,
      message: `You borrowed "${bookRows[0].title}". Please return it on or before ${dueDate} to avoid a library fine.`,
      type: 'library',
      channel: 'in_app,email',
    });

    res.status(201).json({ id: loanId, message: 'Book loan recorded' });
  }),
);

router.patch(
  '/loans/:id/return',
  staff,
  asyncHandler(async (req, res) => {
    const loanId = parseId(req.params.id, 'loan id');
    const rows = await query(
      'SELECT id, book_id, status FROM library_loans WHERE id = ?',
      [loanId],
    );
    if (!rows.length) throw new HttpError(404, 'Loan not found');
    if (rows[0].status === 'returned') throw new HttpError(409, 'This loan is already returned');

    const pool = await getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE library_loans SET status = 'returned', returned_at = ? WHERE id = ?`,
        [todayISO(), loanId],
      );
      await connection.query(
        'UPDATE books SET copies_available = copies_available + 1 WHERE id = ?',
        [rows[0].book_id],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.json({ message: 'Book marked as returned' });
  }),
);

function normalizeBook(body = {}, existing = {}) {
  const isbn = String(required(body.isbn ?? existing.isbn, 'ISBN')).trim();
  const title = String(required(body.title ?? existing.title, 'Title')).trim();
  const author = String(required(body.author ?? existing.author, 'Author')).trim();
  const category = String(body.category ?? existing.category ?? 'General').trim() || 'General';
  const copiesTotal = Math.max(1, Number(body.copies_total ?? existing.copies_total ?? 1) || 1);
  return { isbn, title, author, category, copies_total: copiesTotal };
}

export default router;
