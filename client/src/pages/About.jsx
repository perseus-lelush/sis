import { PageHeader } from '../components/ui.jsx';
import ArchitectureFlow from '../components/ArchitectureFlow.jsx';
import {
  BookIcon,
  ChartIcon,
  DatabaseIcon,
  LayersIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
} from '../components/Icons.jsx';

const ROLES = [
  {
    role: 'Student',
    icon: UserIcon,
    description:
      'Views their profile, class schedule, attendance, grades, billing status, and library loans.',
  },
  {
    role: 'Registrar / Administrator',
    icon: UsersIcon,
    description:
      'Maintains student records, courses, enrollment, billing, reports, and system configuration.',
  },
  {
    role: 'Librarian',
    icon: BookIcon,
    description:
      'Manages the book catalog, records loans and returns, and follows up on overdue items.',
  },
];

const ENTITIES = [
  ['users', 'id (PK)', 'Authentication, role, and account status'],
  ['students', 'id (PK), user_id (FK)', 'Profile linked one-to-one with a user account'],
  ['courses', 'id (PK)', 'Class offering, schedule, room, and instructor'],
  ['enrollments', 'id (PK), student_id (FK), course_id (FK)', 'Many-to-many link with status'],
  ['attendance', 'id (PK), student_id (FK), course_id (FK)', 'Daily roll call per class'],
  ['grades', 'id (PK), student_id (FK), course_id (FK)', 'Assessment scores per student'],
  ['invoices', 'id (PK), student_id (FK)', 'Tuition and fee obligations'],
  ['payments', 'id (PK), invoice_id (FK)', 'Payments applied against invoices'],
  ['books', 'id (PK), isbn (UNIQUE)', 'Library catalog and copy availability'],
  ['library_loans', 'id (PK), student_id (FK), book_id (FK)', 'Borrowed, overdue, and returned books'],
  ['notifications', 'id (PK), user_id (FK)', 'In-app, email, and SMS alerts'],
  ['audit_logs', 'id (PK), user_id', 'Who changed what, when, and from where'],
  ['counters', 'name (PK)', 'Atomic allocation of student and invoice numbers'],
];

const ROADMAP = [
  ['Phase 1', 'Requirements', 'Interview campus staff and list system needs.'],
  ['Phase 2', 'Design', 'Create the ERD, data dictionary, and architecture diagram.'],
  ['Phase 3', 'Build', 'Create relational tables and implement CRUD functions.'],
  ['Phase 4', 'Integrate', 'Connect modules through APIs and test cross-module workflows.'],
  ['Phase 5', 'Secure', 'Add authentication, RBAC, validation, and audit logging.'],
  ['Phase 6', 'Evaluate', 'Run test cases, document results, and roll out improvements.'],
];

export default function About() {
  return (
    <div className="page">
      <PageHeader
        title="About SIS"
        subtitle="The unified platform for student records, enrollment, attendance, and campus services."
      />

      <section className="card about-hero">
        <span className="eyebrow">Unified campus records platform</span>
        <h2>One connected source of truth for the student journey.</h2>
        <p>
          Campus offices often keep student records, class schedules, library loans, and fee
          tracking in separate tools. Staff re-enter the same information, duplicate records
          spread, and students see outdated data. SIS connects these services through a shared
          relational database and secure APIs so every module works from the same record.
        </p>
        <div className="about-metrics">
          <div>
            <strong>13</strong>
            <span>relational tables</span>
          </div>
          <div>
            <strong>3</strong>
            <span>access roles</span>
          </div>
          <div>
            <strong>5</strong>
            <span>service domains</span>
          </div>
          <div>
            <strong>30+</strong>
            <span>API endpoints</span>
          </div>
        </div>
      </section>

      <div className="split-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Project overview</h2>
              <p className="card-sub">What problem does SIS solve?</p>
            </div>
          </div>
          <ul className="info-list">
            <li>A campus uses separate tools for student records, schedules, library loans, and fees.</li>
            <li>Staff re-enter the same student information, causing duplicate records and delays.</li>
            <li>SIS connects these services through a shared database and secure APIs.</li>
            <li>SIS brings database design and service architecture together behind a single record.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Goals &amp; scope</h2>
              <p className="card-sub">Scope and objectives</p>
            </div>
          </div>
          <ul className="info-list">
            <li>Centralize core student and enrollment information.</li>
            <li>Integrate academic, library, and payment-status services.</li>
            <li>Provide role-based access for students, administrators, and librarians.</li>
            <li>Generate enrollment lists, borrowed-book reports, and account-status summaries.</li>
            <li>Sandbox environment: all records are sample data and no live payments are processed.</li>
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Users &amp; system requirements</h2>
            <p className="card-sub">Who uses the system?</p>
          </div>
        </div>
        <div className="role-grid">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div className="role-card" key={role.role}>
                <span className="role-icon">
                  <Icon size={19} />
                </span>
                <div>
                  <h3>{role.role}</h3>
                  <p>{role.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">High-level system architecture</h2>
            <p className="card-sub">Layered architecture with API-based integration</p>
          </div>
          <span className="card-icon">
            <LayersIcon size={18} />
          </span>
        </div>
        <ArchitectureFlow />
        <p className="integration-note">
          Requests flow through the gateway; services only access data through controlled
          interfaces. The reporting service is read-only.
        </p>
      </section>

      <div className="split-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Security &amp; data integrity</h2>
              <p className="card-sub">Protect information and prevent inconsistent records</p>
            </div>
            <span className="card-icon">
              <ShieldIcon size={18} />
            </span>
          </div>
          <ul className="info-list">
            <li>Authentication: JWT sessions verify identity before access.</li>
            <li>Role-based access control limits functions to authorized roles.</li>
            <li>Validation rejects missing, malformed, and duplicate values.</li>
            <li>Database constraints enforce primary keys, foreign keys, UNIQUE, and NOT NULL.</li>
            <li>Audit logs record who changed important records, when, and from where.</li>
            <li>Privacy: only necessary data is collected and stored records are anonymized.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Data model</h2>
              <p className="card-sub">Core entities and relationships</p>
            </div>
            <span className="card-icon">
              <DatabaseIcon size={18} />
            </span>
          </div>
          <div className="data-model">
            {ENTITIES.map(([table, key, description]) => (
              <div className="data-model-row" key={table}>
                <code>{table}</code>
                <div>
                  <strong>{key}</strong>
                  <span>{description}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Implementation roadmap</h2>
            <p className="card-sub">Delivery phases</p>
          </div>
          <span className="card-icon">
            <ChartIcon size={18} />
          </span>
        </div>
        <div className="roadmap">
          {ROADMAP.map(([phase, title, description]) => (
            <div className="roadmap-step" key={phase}>
              <span className="roadmap-phase">{phase}</span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="about-foot">
        SIS keeps the registrar, library, and bursar on one shared record, a single source of truth for the whole student journey.
      </p>
    </div>
  );
}
