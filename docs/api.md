# API reference

REST API for SIS. All endpoints are mounted under `/api`.

- [Conventions](#conventions)
- [Permission matrix](#permission-matrix)
- [Auth](#auth)
- [Dashboard](#dashboard)
- [Students](#students)
- [Enrollments](#enrollments)
- [Attendance](#attendance)
- [Courses](#courses)
- [Grades](#grades)
- [Billing](#billing)
- [Library](#library)
- [Notifications](#notifications)
- [Reports](#reports)
- [Audit logs](#audit-logs)
- [Health](#health)

---

## Conventions

| Item | Rule |
| --- | --- |
| Base URL | `http://localhost:4000/api` (dev also via Vite proxy on `:5173/api`) |
| Auth | `Authorization: Bearer <jwt>` from `POST /auth/login` |
| Token | HS256, 7-day expiry, payload `{ id, role, name, email, iat, exp }` |
| Content type | `application/json` for requests with a body |
| Errors | `{ "error": "message" }` |
| Status codes | `200` ok, `201` created, `400` validation, `401` missing/invalid token, `403` wrong role or not your record, `404` missing, `409` conflict, `500` unexpected |
| Dates | `YYYY-MM-DD`; timestamps are `YYYY-MM-DD HH:mm:ss` strings |
| Money | Decimals (PHP), returned as JSON numbers |
| IDs | Positive integers. A non-numeric ID returns `400`, never a database error |

Validation rejects impossible calendar dates (for example `2026-02-31`), blank required fields,
out-of-range grades and units, and unknown enum values. When a rule applies only to one endpoint,
it is listed with that endpoint.

Questions about the data model: see [architecture.md](architecture.md#3-data-model).

---

## Permission matrix

| Resource | admin | librarian | student |
| --- | --- | --- | --- |
| `auth/*` | Yes | Yes | Yes |
| `dashboard` | Yes, campus | Yes, library | Yes, personal |
| `students` list/create/update/delete | Yes | No | No |
| `students/:id` | Yes, any | No | Own only |
| `students/:id/schedule` | Yes | Yes | Own only |
| `enrollments/*` | Yes | No | No |
| `attendance/me` | No | No | Yes |
| `attendance/sheet` (read/write) | Yes | No | No |
| `courses` read | Yes, all | No | Own |
| `courses` write | Yes | No | No |
| `grades` read | Yes, all | No | Own via `/grades/me` |
| `grades` write | Yes | No | No |
| `billing` read | Yes, campus | No | Own |
| `billing/invoices` create | Yes | No | No |
| `billing/invoices/:id/pay` | Yes, any | No | Own only |
| `library/books` read | Yes | Yes | Yes |
| `library/books` write | Yes | Yes | No |
| `library/books` delete | Yes | No | No |
| `library/loans` write | Yes | Yes | No |
| `library/loans` read | Yes, all | Yes, all | Own |
| `notifications` | Yes | Yes | Yes |
| `notifications/announce` | Yes | No | No |
| `reports/overview` | Yes | No | No |
| `audit-logs` | Yes | No | No |

---

## Auth

### `POST /auth/login`

Public. Body: `email`, `password`.

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@school.edu","password":"admin123"}'
```

```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "name": "Regina Cruz", "email": "admin@school.edu", "role": "admin", "student_id": null }
}
```

Errors: `400` missing field, `401` bad credentials or an inactive account. Deactivating a student
(`PUT /students/:id` with `status: "inactive"`) also sets `users.is_active = 0`, so the next login
is refused. An already-issued token stays valid until it expires.

### `GET /auth/me`

Any authenticated user. Returns the current account and, for students, `student_id`. An inactive
account returns `401`, which makes the SPA clear its stored session.

---

## Dashboard

### `GET /dashboard`

Payload depends on the caller's role.

**Admin**

```json
{
  "role": "admin",
  "stats": { "total_students": 8, "total_courses": 10, "attendance_rate": 93.5, "outstanding": 71000, "collected": 106000 },
  "enrollment_by_program": [{ "program": "BS Computer Science", "count": 3 }],
  "attendance_trend": [{ "date": "2026-10-20", "rate": 92.7, "total": 41 }],
  "recent_payments": [],
  "overdue_invoices": [],
  "notifications": []
}
```

**Librarian:** `stats` (`total_books`, `total_copies`, `available_copies`, `active_loans`, `overdue_loans`), `recent_loans`, `notifications`.

**Student:** `student`, `stats` (`attendance_rate`, `enrolled`, `avg_grade`, `outstanding`), `courses`, `recent_grades`, `next_invoice`, `notifications`.

---

## Students

### `GET /students` (admin)

Query: `search` (name, student no., email), `status` (`active`/`inactive`/`graduated`), `program`.

Returns `{ students: [...] }` with profile fields plus computed `attendance_rate`, `course_count`, `balance`.

### `POST /students` (admin)

| Field | Required | Notes |
| --- | --- | --- |
| `first_name`, `last_name` | Yes | Trimmed, non-empty |
| `email` | Yes | Must contain `@`, unique |
| `program` | Yes | Enrollments are created for matching courses and `General` |
| `password` | No | Defaults to `student123` |
| `dob` | No | Real calendar date, `YYYY-MM-DD`; invalid values return `400` |
| `year_level`, `section`, `gender`, `phone`, `address`, `guardian_name`, `guardian_phone`, `status` | No | Enumerated values fall back to safe defaults |

Side effects (one transaction): `users` row, `students` row with allocated `student_no`, `pending`
enrollments, one ₱5,000 enrollment invoice due in 14 days. Afterwards a welcome notification is written.

```bash
curl -s -X POST http://localhost:4000/api/students \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"first_name":"Test","last_name":"Learner","email":"test.learner@student.edu","program":"BS Computer Science"}'
# returns 201 {"id":9,"message":"Student account created"}
```

`409` if the email already exists.

### `GET /students/:id` (admin, or the student themselves)

Returns the profile, `enrollments` (with per-course average grade), `attendance_summary`, last 40
`attendance` records, all `grades`, and `invoices` with `paid`/`balance`.

### `GET /students/:id/schedule` (admin, librarian, or the student themselves)

Returns `{ student, schedule }` where schedule lists non-dropped enrollments with course details.

### `PUT /students/:id` (admin)

Partial update of the profile fields, plus optional `password` (re-hashed). Keeps the linked
`users` row in sync (name, email, active flag). Setting `status: "inactive"` blocks new logins;
`active` and `graduated` restore access. `400` for an invalid `dob`, `409` if the email belongs to
another account.

### `DELETE /students/:id` (admin)

Deletes the linked `users` row; cascades to the student, enrollments, attendance, grades, invoices,
payments and loans.

---

## Enrollments

All routes require **admin**.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/enrollments` | Filters: `student_id`, `course_id`, `status`; newest first, limit 300 |
| `POST` | `/enrollments` | `student_id`, `course_id`, optional `status` (default `enrolled`); `409` if already enrolled; notifies the student |
| `PATCH` | `/enrollments/:id` | `status` must be `pending`/`enrolled`/`completed`/`dropped`; notifies the student |
| `DELETE` | `/enrollments/:id` | Removes related attendance and grades in the same transaction |

Statuses: `pending`, `enrolled`, `completed`, `dropped`.

---

## Attendance

### `GET /attendance/me` (student)

```json
{
  "summary": { "total": 72, "present": 64, "absent": 2, "late": 4, "excused": 2, "rate": 94.4 },
  "courses": [{ "code": "IT101", "total": 18, "present": 16, "rate": 94.4 }],
  "records": [{ "id": 12, "date": "2026-10-26", "status": "present", "code": "IT101", "title": "..." }]
}
```

### `GET /attendance/sheet?course_id=<id>&date=YYYY-MM-DD` (admin)

Returns the roster for a course on a date, with existing status/remarks (`null` when unmarked) and
`{ course, date }`. Missing `date` defaults to today. Invalid IDs or dates return `400`.

### `POST /attendance/sheet` (admin)

```json
{
  "course_id": 6,
  "date": "2026-10-26",
  "records": [
    { "student_id": 1, "status": "present", "remarks": "" },
    { "student_id": 2, "status": "absent", "remarks": "No excuse filed" }
  ]
}
```

Upserts each record (`UNIQUE(student_id, course_id, attendance_date)`). Students are validated
against the course roster; unknown students or invalid statuses are discarded, and the request
returns `400` if nothing valid remains.

Returns `{ "message": "Attendance saved", "saved": 2, "notified": 1 }`. A notification is created
only when a student becomes `absent` or `late` (status changed).

---

## Courses

### `GET /courses`

- **Student:** own non-dropped courses with `status`, `attendance_rate`, `avg_grade`, `grade_items`.
- **Admin:** full catalog with `enrolled_count` and `avg_grade`.
- **Librarian:** `403`.

### `POST /courses` (admin)

`code` (uppercased, unique), `title`, optional `instructor`, `program`, `units` (default 3),
`schedule`, `room`, `semester`. `units` must be a whole number from 1 to 6. `409` on duplicate code.

### `GET /courses/:id` (admin)

`{ course, roster, recent_grades }`; roster rows include enrollment status, average grade and
attendance rate.

### `PUT /courses/:id` (admin)

Same fields as create; `404` if missing, `409` on duplicate code.

### `DELETE /courses/:id` (admin)

Cascades to enrollments, attendance and grades for that course.

### `POST /courses/:id/enroll` (admin)

`{ "student_id": 3 }` returns `201`, or `409` if the student is already enrolled. Notifies the student.

### `DELETE /courses/:id/students/:studentId` (admin)

Removes the enrollment plus that student's attendance and grades for the course.

---

## Grades

### `GET /grades/me` (student)

All posted grades for the caller, ordered by course then id.

### `GET /grades?course_id=&student_id=` (admin)

Latest 100 records with student and course labels. Invalid filter IDs return `400`.

### `POST /grades` (admin)

```json
{ "student_id": 1, "course_id": 4, "term": "Midterm", "assignment": "Quiz 1", "score": 18, "max_score": 20 }
```

Requires an existing enrollment. `score` must be at least 0 and cannot exceed `max_score`, which
must be greater than 0. Notifies the student.

### `DELETE /grades/:id` (admin)

Deletes a grade record.

---

## Billing

### `GET /billing/summary`

- **Admin:** `{ collected, total_billed, outstanding, overdue, invoice_count, paid_count }`
- **Student:** `{ total_billed, paid, outstanding, overdue }` for their own account
- **Librarian:** `403`

Refreshes `overdue` status first.

### `GET /billing/invoices?status=&student_id=`

- **Student:** own invoices only.
- **Admin:** all invoices, optional `status` and `student_id` filters.
- **Librarian:** `403`.

Each invoice includes `paid` (sum of payments) and `balance`.

### `POST /billing/invoices` (admin)

```json
{ "student_id": 1, "description": "Laboratory Fee", "amount": 1500, "due_date": "2026-11-15" }
```

`amount` must be greater than 0 and `due_date` must be a real calendar date. Allocates
`invoice_no`, inserts, and notifies the student.

### `POST /billing/invoices/:id/pay`

Admin, or the student who owns the invoice. Librarian returns `403`.

```json
{ "amount": 1000, "method": "cash", "reference": "OR-1042" }
```

- `amount` defaults to the full balance; it must be greater than 0 and at most the balance (`400` otherwise).
- `method` is one of `cash`, `card`, `bank_transfer`, `online` (default `online`).
- The invoice becomes `partial` or `paid`; paying an already paid invoice returns `400`.
- If the student has no remaining unpaid invoices, all their `pending` enrollments become `enrolled`.

Returns `{ "message": "Payment recorded", "status": "paid", "balance": 0, "activated": 5 }`.

### `GET /billing/payments?limit=50` (admin)

Latest payments with invoice, student and method. `limit` is clamped to 100; a non-numeric value
falls back to 50.

---

## Library

### `GET /library/books?search=&category=`

All roles. Search matches title, author or ISBN.

### `POST /library/books` (admin, librarian)

`isbn`, `title`, `author` required; `category` (default `General`), `copies_total` (default 1).
`409` on duplicate ISBN. New copies are all available.

### `PUT /library/books/:id` (admin, librarian)

Partial update. Returns `400` if `copies_total` would drop below the number currently on loan;
`copies_available` is recalculated.

### `DELETE /library/books/:id` (admin only)

`409` while any copy is still borrowed.

### `GET /library/loans?status=`

- Students see only their own loans; staff see all.
- `status` filters: `borrowed` (not yet due), `overdue`, `returned`. Omit for everything.
- Effective status is computed: borrowed plus a past due date becomes `overdue`.

### `POST /library/loans` (admin, librarian)

`student_id`, `book_id`, optional `due_date` (default today plus 14 days). The due date must be a
real date and cannot be in the past. `409` when no copy is available. Decrements
`copies_available` in the same transaction and notifies the student.

### `PATCH /library/loans/:id/return` (admin, librarian)

Marks the loan returned (`returned_at` = today) and increments availability. `409` if it was
already returned.

---

## Notifications

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| `GET` | `/notifications?type=&unread=true` | any | Latest 100 for the caller, plus `unread` count |
| `GET` | `/notifications/unread-count` | any | `{ "unread": 3 }` |
| `PATCH` | `/notifications/:id/read` | any | Only own notifications; `404` otherwise |
| `POST` | `/notifications/read-all` | any | Marks every notification of the caller read |
| `POST` | `/notifications/announce` | admin | See below |

Types: `announcement`, `grade`, `payment`, `attendance`, `enrollment`, `library`, `system`.

### `POST /notifications/announce`

```json
{
  "title": "Enrollment deadline",
  "message": "Please settle your balance before Friday.",
  "audience": "students",
  "channels": ["email", "sms"]
}
```

`audience` is one of `students`, `admins`, `all` (default `students`). `channels` may contain
`email` and/or `sms`; delivery is simulated and logged. `title` is limited to 150 characters.
Returns `{ message, sent, channels }`.

---

## Reports

### `GET /reports/overview` (admin)

Returns one payload for the reports screen:

| Key | Contents |
| --- | --- |
| `stats` | active students, attendance rate, collection rate, average grade, books, available copies, active/overdue loans |
| `enrollment_by_program` | active students grouped by program |
| `enrollment_list` | 8 most recent enrollments |
| `attendance_by_course` | records and rate per course |
| `grade_distribution` | counts for 90-100, 80-89, 70-79, 60-69, below 60 |
| `revenue_by_month` | last 6 months of payments |
| `at_risk` | active students with attendance below 85% or an unpaid balance (top 10) |
| `account_status` | invoice counts and balances by status |
| `library.recent_loans` | 8 most recent loans |
| `audit_logs` | 8 most recent audit entries |

---

## Audit logs

### `GET /audit-logs?limit=50` (admin)

`limit` is clamped to 1-200. Every non-GET request under `/api` writes a row after the response is
sent (including failed logins, with a null actor).

```json
{ "logs": [{ "id": 42, "actor": "Regina Cruz", "role": "admin", "method": "POST", "path": "/api/students", "status": 201, "ip": "::1", "created_at": "2026-10-26 21:45:10" }] }
```

---

## Health

### `GET /health`

Public. `{ "status": "ok", "time": "2026-10-26T13:53:15.089Z" }`.

---

## Quick examples

```bash
BASE=http://localhost:4000/api

# Sign in and keep the token
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@school.edu","password":"admin123"}' | jq -r .token)

# Campus invoices
curl -s $BASE/billing/invoices -H "Authorization: Bearer $TOKEN" | jq '.invoices | length'

# Record a roll call
curl -s -X POST $BASE/attendance/sheet \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"course_id":6,"date":"2026-10-26","records":[{"student_id":1,"status":"late","remarks":"Traffic"}]}'

# Lend a book
curl -s -X POST $BASE/library/loans \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"student_id":1,"book_id":3}'
```
