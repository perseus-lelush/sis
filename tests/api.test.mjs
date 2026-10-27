import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

// Run against a throwaway embedded MySQL database so the suite never touches
// an external server or the developer's running app.
process.env.DB_MODE = 'embedded';
process.env.DB_AUTO_INIT = 'true';
process.env.JWT_SECRET = 'sis-test-secret';

const { default: app } = await import('../server/src/app.js');
const { initDb, closeDb } = await import('../server/src/db.js');

let server;
let base;

before(async () => {
  await initDb();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDb();
});

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(email, password) {
  const response = await call('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200, `login failed for ${email}`);
  return response.data.token;
}

const tokens = {};

test('health endpoint responds without authentication', async () => {
  const response = await call('/health');
  assert.equal(response.status, 200);
  assert.equal(response.data.status, 'ok');
});

test('authentication rejects missing fields and wrong passwords', async () => {
  const missing = await call('/auth/login', { method: 'POST', body: {} });
  assert.equal(missing.status, 400);

  const wrong = await call('/auth/login', {
    method: 'POST',
    body: { email: 'admin@school.edu', password: 'wrong-password' },
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.data.error, 'Invalid email or password');
});

test('demo accounts can sign in and receive the expected roles', async () => {
  tokens.admin = await login('admin@school.edu', 'admin123');
  tokens.student = await login('maria.santos@student.edu', 'student123');
  tokens.librarian = await login('librarian@school.edu', 'library123');

  const me = await call('/auth/me', { token: tokens.student });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.role, 'student');
  assert.ok(me.data.user.student_id);
});

test('role guards block cross-module access', async () => {
  assert.equal((await call('/students', { token: tokens.student })).status, 403);
  assert.equal((await call('/reports/overview', { token: tokens.student })).status, 403);
  assert.equal((await call('/students', { token: tokens.librarian })).status, 403);
  assert.equal((await call('/reports/overview', { token: tokens.librarian })).status, 403);
  assert.equal(
    (
      await call('/notifications/announce', {
        method: 'POST',
        token: tokens.student,
        body: { title: 'Nope', message: 'Not allowed' },
      })
    ).status,
    403,
  );
  assert.equal((await call('/dashboard')).status, 401);
});

test('student access is limited to their own records', async () => {
  const me = await call('/auth/me', { token: tokens.student });
  const ownId = me.data.user.student_id;

  const own = await call(`/students/${ownId}`, { token: tokens.student });
  assert.equal(own.status, 200);

  const other = await call(`/students/${ownId + 1}`, { token: tokens.student });
  assert.equal(other.status, 403);

  const invoices = await call('/billing/invoices', { token: tokens.student });
  assert.equal(invoices.status, 200);
  assert.ok(invoices.data.invoices.every((invoice) => invoice.student_id === ownId));
});

test('malformed identifiers return 400 instead of crashing MySQL', async () => {
  const endpoints = [
    ['/students/abc', 'GET', tokens.admin],
    ['/enrollments/abc', 'PATCH', tokens.admin, { status: 'enrolled' }],
    ['/enrollments?student_id=abc', 'GET', tokens.admin],
    ['/enrollments?course_id=abc', 'GET', tokens.admin],
    ['/grades?course_id=abc', 'GET', tokens.admin],
    ['/grades?student_id=abc', 'GET', tokens.admin],
    ['/attendance/sheet?course_id=abc&date=2026-10-27', 'GET', tokens.admin],
    ['/billing/invoices/abc/pay', 'POST', tokens.admin, { amount: 10 }],
    ['/notifications/abc/read', 'PATCH', tokens.student],
  ];

  for (const [path, method, token, body] of endpoints) {
    const response = await call(path, { method, token, body });
    assert.equal(response.status, 400, `${method} ${path} should be a 400`);
  }
});

test('invalid calendar dates are rejected with 400', async () => {
  const attendance = await call('/attendance/sheet', {
    method: 'POST',
    token: tokens.admin,
    body: { course_id: 1, date: '2026-02-31', records: [{ student_id: 1, status: 'present' }] },
  });
  assert.equal(attendance.status, 400);

  const invoice = await call('/billing/invoices', {
    method: 'POST',
    token: tokens.admin,
    body: {
      student_id: 1,
      description: 'Impossible date probe',
      amount: 100,
      due_date: '2026-02-31',
    },
  });
  assert.equal(invoice.status, 400);
});

test('attendance rejects statuses outside the allowed set', async () => {
  const response = await call('/attendance/sheet', {
    method: 'POST',
    token: tokens.admin,
    body: { course_id: 1, date: '2026-10-27', records: [{ student_id: 1, status: 'sleeping' }] },
  });
  assert.equal(response.status, 400);
});

test('grade scores cannot exceed the maximum score', async () => {
  const response = await call('/grades', {
    method: 'POST',
    token: tokens.admin,
    body: { student_id: 1, course_id: 1, assignment: 'Over max', score: 150, max_score: 100 },
  });
  assert.equal(response.status, 400);
  assert.match(response.data.error, /maximum score/i);
});

test('course units must be a whole number between 1 and 6', async () => {
  for (const units of [-5, 0, 7, 2.5, 'abc']) {
    const response = await call('/courses', {
      method: 'POST',
      token: tokens.admin,
      body: { code: `BAD${String(units).replace(/\W/g, '')}`, title: 'Bad units', units },
    });
    assert.equal(response.status, 400, `units ${units} should be rejected`);
  }

  const created = await call('/courses', {
    method: 'POST',
    token: tokens.admin,
    body: { code: 'TST100', title: 'Test Course', units: 3, program: 'General' },
  });
  assert.equal(created.status, 201);

  const removed = await call(`/courses/${created.data.id}`, {
    method: 'DELETE',
    token: tokens.admin,
  });
  assert.equal(removed.status, 200);
});

test('student creation validates input, provisions records, and can be deactivated', async () => {
  const badDob = await call('/students', {
    method: 'POST',
    token: tokens.admin,
    body: {
      first_name: 'Bad',
      last_name: 'Date',
      email: 'bad.date@student.edu',
      program: 'BS Information Technology',
      dob: '13/45/2020',
    },
  });
  assert.equal(badDob.status, 400);

  const created = await call('/students', {
    method: 'POST',
    token: tokens.admin,
    body: {
      first_name: 'Test',
      last_name: 'Learner',
      email: 'test.learner@student.edu',
      program: 'BS Information Technology',
      year_level: 1,
      password: 'learner123',
    },
  });
  assert.equal(created.status, 201);

  const studentId = created.data.id;
  const duplicate = await call('/students', {
    method: 'POST',
    token: tokens.admin,
    body: {
      first_name: 'Test',
      last_name: 'Learner',
      email: 'test.learner@student.edu',
      program: 'BS Information Technology',
    },
  });
  assert.equal(duplicate.status, 409);

  const detail = await call(`/students/${studentId}`, { token: tokens.admin });
  assert.equal(detail.status, 200);
  assert.ok(detail.data.enrollments.length > 0, 'expected pending enrollments');
  assert.ok(detail.data.invoices.length > 0, 'expected an enrollment invoice');
  assert.ok(
    detail.data.enrollments.every((enrollment) => enrollment.status === 'pending'),
    'new enrollments start pending',
  );

  tokens.probeStudent = await login('test.learner@student.edu', 'learner123');

  const deactivated = await call(`/students/${studentId}`, {
    method: 'PUT',
    token: tokens.admin,
    body: { status: 'inactive' },
  });
  assert.equal(deactivated.status, 200);

  const blocked = await call('/auth/login', {
    method: 'POST',
    body: { email: 'test.learner@student.edu', password: 'learner123' },
  });
  assert.equal(blocked.status, 401, 'an inactive student must not be able to sign in');

  const reactivated = await call(`/students/${studentId}`, {
    method: 'PUT',
    token: tokens.admin,
    body: { status: 'active' },
  });
  assert.equal(reactivated.status, 200);
  await login('test.learner@student.edu', 'learner123');

  const removed = await call(`/students/${studentId}`, { method: 'DELETE', token: tokens.admin });
  assert.equal(removed.status, 200);
});

test('settling every invoice activates pending enrollments', async () => {
  const created = await call('/students', {
    method: 'POST',
    token: tokens.admin,
    body: {
      first_name: 'Billing',
      last_name: 'Flow',
      email: 'billing.flow@student.edu',
      program: 'BS Information Technology',
      password: 'billing123',
    },
  });
  assert.equal(created.status, 201);
  const studentId = created.data.id;

  const detail = await call(`/students/${studentId}`, { token: tokens.admin });
  const invoice = detail.data.invoices[0];
  assert.ok(invoice, 'enrollment invoice missing');

  const partial = await call(`/billing/invoices/${invoice.id}/pay`, {
    method: 'POST',
    token: tokens.admin,
    body: { amount: 1000, method: 'cash' },
  });
  assert.equal(partial.status, 200);
  assert.equal(partial.data.status, 'partial');
  assert.equal(partial.data.activated, 0, 'partial payment must not activate classes');

  const remaining = Number(invoice.balance) - 1000;
  const paid = await call(`/billing/invoices/${invoice.id}/pay`, {
    method: 'POST',
    token: tokens.admin,
    body: { amount: remaining, method: 'cash' },
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.data.status, 'paid');
  assert.ok(paid.data.activated > 0, 'full payment should activate pending enrollments');

  const overpay = await call(`/billing/invoices/${invoice.id}/pay`, {
    method: 'POST',
    token: tokens.admin,
    body: { amount: 1 },
  });
  assert.equal(overpay.status, 400);

  await call(`/students/${studentId}`, { method: 'DELETE', token: tokens.admin });
});

test('library loans validate dates and ids, then return copies', async () => {
  const book = await call('/library/books', {
    method: 'POST',
    token: tokens.librarian,
    body: { isbn: '978-0000000001', title: 'Test Book', author: 'Tester', copies_total: 1 },
  });
  assert.equal(book.status, 201);

  const invalidDate = await call('/library/loans', {
    method: 'POST',
    token: tokens.librarian,
    body: { student_id: 1, book_id: book.data.id, due_date: 'not-a-date' },
  });
  assert.equal(invalidDate.status, 400);

  const pastDate = await call('/library/loans', {
    method: 'POST',
    token: tokens.librarian,
    body: { student_id: 1, book_id: book.data.id, due_date: '2020-01-01' },
  });
  assert.equal(pastDate.status, 400);

  const badBook = await call('/library/loans', {
    method: 'POST',
    token: tokens.librarian,
    body: { student_id: 1, book_id: 'abc' },
  });
  assert.equal(badBook.status, 400);

  const loan = await call('/library/loans', {
    method: 'POST',
    token: tokens.librarian,
    body: { student_id: 1, book_id: book.data.id, due_date: '2030-01-01' },
  });
  assert.equal(loan.status, 201);

  const returned = await call(`/library/loans/${loan.data.id}/return`, {
    method: 'PATCH',
    token: tokens.librarian,
  });
  assert.equal(returned.status, 200);

  const again = await call(`/library/loans/${loan.data.id}/return`, {
    method: 'PATCH',
    token: tokens.librarian,
  });
  assert.equal(again.status, 409);

  const shelf = await call('/library/books', { token: tokens.librarian });
  const stored = shelf.data.books.find((row) => row.id === book.data.id);
  assert.equal(stored.copies_available, 1);

  await call(`/library/books/${book.data.id}`, { method: 'DELETE', token: tokens.admin });
});

test('payment listing tolerates a non-numeric limit', async () => {
  const response = await call('/billing/payments?limit=abc', { token: tokens.admin });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.data.payments));
});

test('announcements validate the title length', async () => {
  const response = await call('/notifications/announce', {
    method: 'POST',
    token: tokens.admin,
    body: { title: 'x'.repeat(151), message: 'Too long', audience: 'students' },
  });
  assert.equal(response.status, 400);
});
