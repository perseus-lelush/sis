# SIS: Student Information System

A single-campus student information system that lets independent campus offices (registrar,
library, and bursar) work from one relational database and a shared set of APIs instead of
re-entering the same information.

- **Frontend:** React 19 + Vite SPA, role-aware navigation, blue design system with a dark theme
- **Device support:** desktop browsers only — phones, tablets (including Android) and touch-only devices, or any window narrower than 1024px, get a "Desktop only" gate instead of the app
- **Backend:** Express 5 REST API over MySQL 8
- **Database:** 13 tables (12 domain tables plus a sequence counter table), foreign keys throughout
- **Zero-setup database:** an embedded MySQL server is downloaded and started automatically on first run
- **Tests:** Node's built-in test runner against a throwaway embedded database

> Not yet hardened for production records use. See [Known limitations](#known-limitations).

---

## Demo accounts

| Role | Email | Password | Lands on |
| --- | --- | --- | --- |
| Administrator | `admin@school.edu` | `admin123` | Dashboard |
| Librarian | `librarian@school.edu` | `library123` | Library Loans |
| Student | `maria.santos@student.edu` | `student123` | Student dashboard |

The login screen lists these accounts and autofills them on click.

---

## What it does

| Module | Capabilities |
| --- | --- |
| **Dashboard** | Role-specific overview: campus stats, attendance trend, enrollment by program, recent payments, overdue invoices, notifications (admin); attendance/grades/balance snapshot (student) |
| **Students** | Search, filter, create, edit and delete student records; creating a student provisions a portal login, course enrollments and an enrollment invoice |
| **Enrollment** | Manage the student-course join records and their status (`pending`, `enrolled`, `completed`, `dropped`) |
| **Courses (LMS)** | Course catalog, class rosters, enrollment from the course side, grade entry |
| **Attendance** | Daily roll call per course with present/late/absent/excused, remarks, and automatic absence alerts |
| **Library** | Catalog management, loan and return recording, availability tracking, overdue detection |
| **Billing** | Invoices, partial and full payments, outstanding/overdue totals, automatic activation of pending enrollments once an account is settled |
| **Notifications** | Per-user inbox, unread badges, announcements to students/admins/admin+students with simulated email/SMS delivery |
| **Reports** | Institution-wide stats, attendance by course, grade distribution, 6-month revenue, at-risk students, account status, recent activity and audit trail |
| **Settings** | Light and dark appearance, applied before first paint and remembered per browser |
| **Integration / About** | Documentation of the layered architecture, API surface and the project brief |

### The integration story

The modules are wired together, not just co-located:

1. **Registrar to everything.** Creating a student writes `users`, `students`, `enrollments` (pending for the program's courses) and `invoices` in one transaction, then sends a welcome notification.
2. **Bursar to registrar.** Settling every outstanding invoice flips that student's `pending` enrollments to `enrolled`, and the payment notification says so.
3. **Attendance to student records.** Saving a roll call updates the student's attendance rate everywhere it is displayed and notifies them when they are marked absent or late (only on a status change).
4. **Library to student portal.** Recording a loan decrements availability, sets the due date, and notifies the borrower; returning it restores availability.
5. **Everywhere to audit trail.** Every non-GET API call is recorded with actor, role, method, path, status and IP.

---

## Roles and access

| Area | Administrator | Librarian | Student |
| --- | --- | --- | --- |
| Dashboard | Yes, campus | No (redirected to library) | Yes, personal |
| Students / Student detail | Yes, manage | No | Own profile only |
| Enrollment | Yes | No | No |
| Courses / grades | Yes | No | Own courses and grades |
| Attendance | Yes, roll call | No | Own records |
| Library | Yes | Yes (catalog delete is admin-only) | Own loans and catalog |
| Billing | Yes | No | Own invoices, pay own |
| Reports / audit logs | Yes | No | No |
| Notifications | Yes, plus announcements | Yes | Yes |

Enforced in two places: the React router redirects users away from routes their role cannot use,
and every API route re-checks the role server-side.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, React Router 7, hand-written CSS (no UI framework) |
| Build | Vite 7 |
| API | Node.js, Express 5, `asyncHandler` + typed `HttpError` helpers |
| Database | MySQL 8.4 via `mysql2/promise` (pool, transactions, FK constraints) |
| Local DB | `mysql-memory-server`, which downloads and runs MySQL without installing it |
| Auth | JWT (HS256, 7-day expiry) + `bcryptjs` password hashes |
| Notifications | In-app rows; email/SMS are logged, not sent |
| Tests | `node:test` + `fetch` against an in-process Express server |

---

## Getting started

### Prerequisites

- Node.js **20.19+** (22.12+ or newer recommended; developed on Node 26)
- npm 10+
- Internet access on the first run (the embedded MySQL binary is downloaded once)

### Install and run

```bash
npm install          # installs the root, server and client workspaces
npm run dev          # API on :4000, Vite dev server on :5173
```

Open **http://localhost:5173** and sign in with a demo account.

On the first start the API downloads MySQL 8.4, initializes a temporary data directory, applies
`server/src/sql/schema.sql`, and seeds demo data. This can take a minute; subsequent starts are
quicker but still re-create the database (see [Known limitations](#known-limitations)).

### Production-style run

```bash
npm run build        # builds client/dist
npm start            # Express serves the API and the built SPA on :4000
```

The server mounts `client/dist` and falls back to `index.html` for client-side routes, so deep
links such as `/students/3` work.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API (`node --watch`) and Vite together |
| `npm run dev:server` / `npm run dev:client` | Run one side only |
| `npm run build` | Build the client into `client/dist` |
| `npm start` | Start the API in production mode (serves the built SPA) |
| `npm run db:init` | Apply the schema and seed without starting the server |
| `npm run seed` | Re-seed the database |
| `npm test` | Run the unit and API test suite |

---

## Configuration

Copy `server/.env.example` to `server/.env` and adjust as needed.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `SIS_JWT_SECRET` | — | Token signing secret. Preferred name (Vercel reserves `JWT_`). `JWT_SECRET` also works where allowed. Change before sharing |
| `DB_MODE` | `embedded` | `embedded` (auto MySQL) or `external` |
| `DB_AUTO_INIT` | `true` | Apply schema and seed on every start |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `127.0.0.1` / `3306` / `root` / *(empty)* / `sis_db` | External MySQL connection |
| `MYSQL_VERSION` | `8.4.x` | Version downloaded by the embedded server |

The Vite dev server proxies `/api` to `http://localhost:4000` (`client/vite.config.js`).

---

## Project structure

```
.
├── client/                 React SPA
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx         routes + role guards
│       ├── main.jsx        providers (Router, Theme, Auth, Toast)
│       ├── components/     Layout, UI primitives, icons, logo, charts
│       ├── context/        AuthContext, ToastContext, ThemeContext
│       ├── lib/            API client, formatters, constants
│       ├── pages/          one file per screen
│       └── styles.css      design tokens, light/dark themes, components
├── server/                 Express API
│   ├── src/
│   │   ├── app.js          middleware, routers, static SPA fallback
│   │   ├── config.js       env-driven configuration
│   │   ├── db.js           embedded/external MySQL pool + auto-init
│   │   ├── index.js        startup and graceful shutdown
│   │   ├── middleware/     auth (JWT, roles), audit trail
│   │   ├── routes/         auth, dashboard, students, enrollments, attendance,
│   │   │                   courses, grades, billing, library, notifications,
│   │   │                   reports, audit
│   │   ├── scripts/        init-db, seed
│   │   ├── seed-data.js    demo dataset
│   │   ├── sql/schema.sql  tables, constraints, counters
│   │   └── utils/          HttpError/asyncHandler, validation, dates, notify, sequence
│   └── .env.example
├── tests/                  node:test suites (helpers + API integration)
└── docs/
    ├── architecture.md     runtime design, data model, workflows
    ├── api.md              endpoint reference
    └── sis_documentation.pdf
```

---

## End-to-end walkthrough

A five-minute pass that touches every module:

1. **Sign in as admin.** The Dashboard shows campus totals and the attendance trend.
2. **Students, then Add student.** Fill in a name, email and program; leave the password blank to use `student123`. The summary strip notes the side effects.
3. **Open the new student.** Note the `pending` enrollments and the ₱5,000 enrollment invoice created automatically.
4. **Billing, then New invoice** for that student (for example "Laboratory Fee", ₱1,500).
5. **Record payment** on the enrollment invoice: pay part of it first (status becomes `partial`), then the remainder. The response reports how many enrollments were activated.
6. **Attendance:** pick a course and today's date, mark a student absent, save. Sign in as that student to see the notification and updated attendance rate.
7. **Library, then Record loan** for the new student, then mark it returned and watch availability change.
8. **Notifications, then Send announcement** to students with email and SMS checked. The API logs the simulated deliveries.
9. **Reports:** check attendance, grade distribution, revenue and the audit table.
10. **Sign in as the new student.** Verify you only see your own records, and that `/students` and `/reports` redirect away.

Reset by restarting the API (`Ctrl+C` and `npm run dev`).

---

## Design system

The UI is built on CSS custom properties in `client/src/styles.css`; changing the tokens reskins
the whole app.

| Token | Light value | Use |
| --- | --- | --- |
| `--bg` | `#eef5ff` | Page background (with a soft blue radial glow) |
| `--surface` / `--surface-2` / `--surface-3` | `#ffffff` / `#f6faff` / `#e8f2fe` | Cards, subtle fills, table headers |
| `--border` / `--border-strong` | `#dbe7f8` / `#c3daf2` | Dividers and inputs |
| `--primary` / `--primary-dark` / `--primary-soft` | `#1d6fe0` / `#1456b4` / `#e8f2ff` | Buttons, links, active nav, accents |
| `--text` / `--text-soft` / `--muted` | `#0b2545` / `#3c5675` / `#6b83a3` | Type hierarchy |
| Semantic | green / amber / red / info blue | Status badges and totals |

The sidebar is a light blue gradient with white active pills; the app background is a very light
blue; the login and student hero panels use a saturated blue gradient for contrast; charts use
the primary blue.

**Dark theme.** `[data-theme='dark']` overrides the same tokens with a deep navy palette, and a
small script in `index.html` applies the saved theme before React renders so there is no flash of
the wrong theme. The choice lives in `localStorage` (`sis-theme`) and is exposed on
**Settings, Appearance**.

**Brand mark.** The logo is the geometric white "S" ribbon monogram in
[Logo.jsx](client/src/components/Logo.jsx): two filled crescent ribbons that form the letter and
blend into the blue gradient brand tiles and the sign-in hero. The browser favicon uses the same
artwork on a blue rounded tile.

**Profile photos.** Avatars are neutral placeholders, not initials: [ui.jsx](client/src/components/ui.jsx)
draws a person silhouette on a light blue tile, with an `aria-label` naming the person and noting
that no photo is on file. Swapping in real photos later only touches that one component.

---

## Testing

```bash
npm test
```

The suite uses Node's built-in test runner and needs no extra packages or services:

- `tests/helpers.test.mjs` covers the shared validators (`parseId`, `parseISODate`, `required`),
  date helpers, and the client formatters (money, dates, percentages, status tones, relative time).
- `tests/api.test.mjs` starts the Express app on an ephemeral port with its own embedded MySQL
  database, then exercises authentication, role guards, student onboarding, invoice settlement,
  library loans and the input validation rules.

Because it launches an isolated embedded database, the suite never touches a running development
server or an external MySQL instance. The first run of the day may take a few extra seconds while
the MySQL binary starts.

---

## Known limitations

- **The database is ephemeral.** With `DB_MODE=embedded`, MySQL runs from a temporary data directory and is re-seeded on every start. Great for demos, wrong for anything persistent. Use `DB_MODE=external` if you need durability.
- **Email and SMS are simulated.** `channel` values are stored and logged; nothing leaves the machine.
- **Payments are recorded, not processed.** There is no gateway: a student can settle their own invoice with any method/reference. Treat "paid" as a bookkeeping action, not proof of payment.
- **Auth is demo-grade.** The JWT is stored in `localStorage`; roles are trusted for the token's 7-day lifetime, so a role change or deactivation only applies to an existing session after it expires (new logins are blocked immediately); there is no login rate limiting; and new students get the default password `student123`.
- **Session restore is strict.** If `GET /auth/me` cannot be reached, for example while the API is restarting, the stored token is cleared, so you may need to sign in again.
- **No linter.** Automated tests cover the API, but there is no ESLint or Prettier configuration yet.
- **Dates are local-time.** The server and browser are assumed to be in the same time zone.

---

## Documentation

- [docs/architecture.md](docs/architecture.md): runtime topology, request lifecycle, ERD, module design, integration workflows
- [docs/api.md](docs/api.md): every endpoint with roles, payloads, responses and curl examples
- [docs/sis_documentation.pdf](docs/sis_documentation.pdf): printable system documentation
