import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  formatCompactMoney,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMonth,
  percent,
} from '../lib/api.js';
import {
  EmptyState,
  Loading,
  PageHeader,
  Progress,
  StatCard,
  StatusBadge,
} from '../components/ui.jsx';
import {
  AlertIcon,
  BookIcon,
  CalendarIcon,
  ChartIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
} from '../components/Icons.jsx';

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reports/overview');
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading label="Building your reports..." />;
  if (error || !data) {
    return (
      <EmptyState
        title="Could not load reports"
        message={error}
        action={
          <button type="button" className="btn btn-primary" onClick={load}>
            Try again
          </button>
        }
      />
    );
  }

  const {
    stats,
    enrollment_by_program: programs,
    enrollment_list: enrollmentList,
    attendance_by_course: attendance,
    grade_distribution: gradeBuckets,
    revenue_by_month: revenue,
    at_risk: atRisk,
    account_status: accountStatus,
    library,
    audit_logs: auditLogs,
  } = data;

  const maxProgram = Math.max(...programs.map((row) => Number(row.count)), 1);
  const maxGrade = Math.max(...gradeBuckets.map((row) => row.count), 1);
  const maxRevenue = Math.max(...revenue.map((row) => Number(row.total)), 1);
  const outstanding = accountStatus.reduce((total, row) => total + Number(row.balance), 0);

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        subtitle="Institution-wide enrollment, attendance, academic, and collection insights."
        actions={
          <button type="button" className="btn btn-ghost" onClick={load}>
            <ChartIcon size={16} />
            Refresh data
          </button>
        }
      />

      <div className="stat-grid">
        <StatCard
          icon={<UsersIcon size={22} />}
          label="Active students"
          value={Number(stats.total_students).toLocaleString('en-US')}
          hint="Enrolled this semester"
          tone="indigo"
        />
        <StatCard
          icon={<CalendarIcon size={22} />}
          label="Attendance rate"
          value={percent(stats.attendance_rate, 1)}
          hint="All recorded roll calls"
          tone="emerald"
        />
        <StatCard
          icon={<WalletIcon size={22} />}
          label="Collection rate"
          value={percent(stats.collection_rate, 1)}
          hint="Paid against total billed"
          tone="amber"
        />
        <StatCard
          icon={<TrendUpIcon size={22} />}
          label="Average grade"
          value={percent(stats.avg_grade, 1)}
          hint="All graded assessments"
          tone="sky"
        />
      </div>

      <div className="stat-grid">
        <StatCard
          icon={<BookIcon size={22} />}
          label="Library titles"
          value={Number(stats.total_books).toLocaleString('en-US')}
          hint={`${Number(stats.available_copies).toLocaleString('en-US')} copies available`}
          tone="indigo"
        />
        <StatCard
          icon={<UsersIcon size={22} />}
          label="Active loans"
          value={Number(stats.active_loans).toLocaleString('en-US')}
          hint="Books currently borrowed"
          tone="sky"
        />
        <StatCard
          icon={<AlertIcon size={22} />}
          label="Overdue loans"
          value={Number(stats.overdue_loans).toLocaleString('en-US')}
          hint="Past their due date"
          tone="amber"
        />
        <StatCard
          icon={<WalletIcon size={22} />}
          label="Outstanding balance"
          value={formatCompactMoney(outstanding)}
          hint="Unsettled invoice balances"
          tone="emerald"
        />
      </div>

      <div className="split-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Enrollment by program</h2>
              <p className="card-sub">Active students per degree program</p>
            </div>
          </div>
          <div className="hbar-list">
            {programs.map((row, index) => (
              <div className="hbar-row" key={row.program}>
                <div className="hbar-head">
                  <span>{row.program}</span>
                  <strong>{row.count}</strong>
                </div>
                <div className="hbar-track">
                  <div
                    className={`hbar-fill bar-color-${index % 5}`}
                    style={{ width: `${(Number(row.count) / maxProgram) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Grade distribution</h2>
              <p className="card-sub">Assessments grouped by percentage band</p>
            </div>
          </div>
          <div className="vbars">
            {gradeBuckets.map((row) => (
              <div className="vbar-col" key={row.bucket}>
                <span className="vbar-value">{row.count}</span>
                <div className="vbar-track">
                  <div
                    className="vbar-fill bar-color-3"
                    style={{ height: `${(row.count / maxGrade) * 100}%` }}
                  />
                </div>
                <span className="vbar-label">{row.bucket}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="split-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Attendance by course</h2>
              <p className="card-sub">Present and late percentage per subject</p>
            </div>
          </div>
          <div className="hbar-list">
            {attendance.map((row) => (
              <div className="hbar-row" key={row.id}>
                <div className="hbar-head">
                  <span>
                    <span className="code-pill">{row.code}</span> {row.title}
                  </span>
                  <strong>{percent(row.rate, 1)}</strong>
                </div>
                <div className="hbar-track">
                  <div
                    className={`hbar-fill ${Number(row.rate) >= 85 ? 'bar-green' : 'bar-amber'}`}
                    style={{ width: `${Number(row.rate)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Revenue collected</h2>
              <p className="card-sub">Payments received over the last 6 months</p>
            </div>
          </div>
          <div className="vbars revenue-bars">
            {revenue.map((row) => (
              <div className="vbar-col" key={row.month}>
                <span className="vbar-value">{formatCompactMoney(row.total)}</span>
                <div className="vbar-track">
                  <div
                    className="vbar-fill bar-color-2"
                    style={{ height: `${(Number(row.total) / maxRevenue) * 100}%` }}
                  />
                </div>
                <span className="vbar-label">{formatMonth(row.month)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Students needing support</h2>
            <p className="card-sub">
              Attendance below 85% or with an outstanding balance
            </p>
          </div>
          <Link to="/students" className="text-link">
            View all students
          </Link>
        </div>

        {atRisk.length === 0 ? (
          <EmptyState
            icon={<BookIcon size={24} />}
            title="Everyone is on track"
            message="No students currently fall below the support thresholds."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Program</th>
                  <th>Attendance</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="stacked-cell">
                        <strong>{student.name}</strong>
                        <span>{student.student_no}</span>
                      </div>
                    </td>
                    <td>{student.program}</td>
                    <td>
                      <div className="attendance-cell wide">
                        <Progress
                          value={student.attendance_rate}
                          tone={Number(student.attendance_rate) >= 85 ? 'emerald' : 'amber'}
                        />
                        <span>{percent(student.attendance_rate, 1)}</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <span
                        className={
                          Number(student.balance) > 0 ? 'amount-due' : 'amount-clear'
                        }
                      >
                        {formatMoney(student.balance)}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link to={`/students/${student.id}`} className="text-link">
                        Review profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="split-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Borrowed books</h2>
              <p className="card-sub">Latest library circulation records</p>
            </div>
            <Link to="/library" className="text-link">
              Open library
            </Link>
          </div>

          {library.recent_loans.length === 0 ? (
            <EmptyState
              icon={<BookIcon size={24} />}
              title="No library activity"
              message="Recorded loans and returns will appear here."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Due date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {library.recent_loans.map((loan) => (
                    <tr key={loan.id}>
                      <td>
                        <div className="stacked-cell">
                          <strong>{loan.student_name}</strong>
                          <span>{loan.student_no}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{loan.title}</strong>
                          <span>{loan.author}</span>
                        </div>
                      </td>
                      <td className="mono">{formatDate(loan.due_date)}</td>
                      <td>
                        <StatusBadge status={loan.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Account status summary</h2>
              <p className="card-sub">Invoices grouped by payment status</p>
            </div>
          </div>
          <div className="status-summary">
            {accountStatus.map((row) => (
              <div className="status-summary-row" key={row.status}>
                <div>
                  <StatusBadge status={row.status} />
                  <span>
                    {row.count} invoice{Number(row.count) === 1 ? '' : 's'}
                  </span>
                </div>
                <strong>{formatMoney(row.balance)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Recent enrollment records</h2>
            <p className="card-sub">Enrollment list across all programs</p>
          </div>
          <Link to="/courses" className="text-link">
            Manage enrollment
          </Link>
        </div>

        {enrollmentList.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={24} />}
            title="No enrollment records"
            message="New enrollment records will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {enrollmentList.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="stacked-cell">
                        <strong>{row.student_name}</strong>
                        <span>{row.student_no}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{row.code}</strong>
                        <span>{row.title}</span>
                      </div>
                    </td>
                    <td className="mono">{formatDate(row.enrolled_at)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Audit trail</h2>
            <p className="card-sub">
              The latest mutating API requests - who changed what and when
            </p>
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <EmptyState
            icon={<ChartIcon size={24} />}
            title="No audit entries yet"
            message="Create, update, or return a record to generate an audit entry."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Request</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.actor || 'Anonymous'}</td>
                    <td className="muted">{log.role || 'N/A'}</td>
                    <td>
                      <span className={`method method-${String(log.method).toLowerCase()}`}>
                        {log.method}
                      </span>
                      <code className="audit-path">{log.path}</code>
                    </td>
                    <td>{log.status}</td>
                    <td className="mono">{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
