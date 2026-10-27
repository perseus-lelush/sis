import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  api,
  formatCompactMoney,
  formatDate,
  formatMoney,
  gradeTone,
  percent,
  timeAgo,
} from '../lib/api.js';
import {
  EmptyState,
  Loading,
  PageHeader,
  Progress,
  StatCard,
  StatusBadge,
  Avatar,
} from '../components/ui.jsx';
import NotificationIcon from '../components/NotificationIcon.jsx';
import {
  ArrowRightIcon,
  BellIcon,
  BookIcon,
  CalendarIcon,
  ChartIcon,
  PlusIcon,
  SendIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
} from '../components/Icons.jsx';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function TrendChart({ data }) {
  const width = 640;
  const height = 240;
  const padding = { top: 22, right: 20, bottom: 36, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = data.map((item, index) => {
    const x = padding.left + (index * plotWidth) / Math.max(data.length - 1, 1);
    const y = padding.top + ((100 - Number(item.rate || 0)) / 100) * plotHeight;
    return { ...item, x, y };
  });

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const area = points.length
    ? `${line} L ${points[points.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${points[0].x.toFixed(1)} ${height - padding.bottom} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label="Attendance trend">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b7cf0" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2b7cf0" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = padding.top + ((100 - tick) / 100) * plotHeight;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray={tick === 0 ? '0' : '4 6'}
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
              {tick}
            </text>
          </g>
        );
      })}
      {area && <path d={area} fill="url(#trendFill)" />}
      {line && (
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {points.map((point) => (
        <g key={point.date}>
          <circle cx={point.x} cy={point.y} r="4.5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.4" />
          <text x={point.x} y={height - 12} textAnchor="middle" className="chart-axis-label">
            {new Date(`${point.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}
          </text>
        </g>
      ))}
      {points.length === 0 && (
        <text x={width / 2} y={height / 2} textAnchor="middle" className="chart-axis-label">
          No attendance records yet
        </text>
      )}
    </svg>
  );
}

function NotificationList({ notifications }) {
  if (!notifications?.length) {
    return (
      <EmptyState
        icon={<BellIcon size={24} />}
        title="No notifications"
        message="You are all caught up."
      />
    );
  }

  return (
    <div className="notif-mini-list">
      {notifications.map((notification) => (
        <div className="notif-mini" key={notification.id}>
          <NotificationIcon type={notification.type} />
          <div>
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
          </div>
          <span className="notif-time">{timeAgo(notification.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/dashboard');
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

  if (loading) return <Loading label="Preparing your dashboard..." />;

  if (error) {
    return (
      <EmptyState
        title="Could not load the dashboard"
        message={error}
        action={
          <button type="button" className="btn btn-primary" onClick={load}>
            Try again
          </button>
        }
      />
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (data?.role === 'student') {
    const { student, stats, courses, recent_grades: grades, next_invoice: invoice, notifications } = data;

    return (
      <div className="page">
        <PageHeader title={`${greeting()}, ${firstName}`} subtitle={today} />

        <section className="student-hero">
          <div className="student-hero-main">
            <Avatar name={student.full_name} size={68} />
            <div>
              <span className="eyebrow light">Student portal</span>
              <h2>{student.full_name}</h2>
              <p>
                {student.program} &middot; Year {student.year_level}
                {student.section ? ` \u00B7 Section ${student.section}` : ''}
              </p>
              <span className="hero-id">{student.student_no}</span>
            </div>
          </div>
          <div className="student-hero-side">
            <StatusBadge status={student.status} />
            <Link to="/profile" className="btn btn-light">
              View profile
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </section>

        <div className="stat-grid">
          <StatCard
            icon={<CalendarIcon size={22} />}
            label="Attendance rate"
            value={percent(stats.attendance_rate, 1)}
            hint="Present and late records"
            tone="indigo"
          />
          <StatCard
            icon={<BookIcon size={22} />}
            label="Enrolled courses"
            value={stats.enrolled}
            hint="Current semester"
            tone="sky"
          />
          <StatCard
            icon={<TrendUpIcon size={22} />}
            label="Average grade"
            value={percent(stats.avg_grade, 1)}
            hint="Across all graded work"
            tone="emerald"
          />
          <StatCard
            icon={<WalletIcon size={22} />}
            label="Outstanding balance"
            value={formatCompactMoney(stats.outstanding)}
            hint={Number(stats.outstanding) > 0 ? 'Payment required' : 'All settled'}
            tone="amber"
          />
        </div>

        <div className="split-grid">
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">My courses</h2>
                <p className="card-sub">Attendance and standing per subject</p>
              </div>
              <Link to="/courses" className="text-link">
                View all
              </Link>
            </div>
            {courses.length === 0 ? (
              <EmptyState title="No courses yet" message="Your enrolled courses will appear here." />
            ) : (
              <div className="course-progress-list">
                {courses.map((course) => (
                  <div className="course-progress" key={course.id}>
                    <div className="course-progress-head">
                      <div>
                        <span className="code-pill">{course.code}</span>
                        <strong>{course.title}</strong>
                        <p>{course.instructor}</p>
                      </div>
                      <div className="course-progress-grade">
                        <span>Average</span>
                        <strong>{course.avg_grade != null ? percent(course.avg_grade, 1) : 'N/A'}</strong>
                      </div>
                    </div>
                    <Progress
                      value={course.attendance_rate}
                      tone={Number(course.attendance_rate) >= 85 ? 'emerald' : 'amber'}
                      label="Attendance"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Recent grades</h2>
                <p className="card-sub">Latest results posted in your LMS</p>
              </div>
            </div>
            {grades.length === 0 ? (
              <EmptyState title="No grades yet" message="Grades will show up once your instructors post them." />
            ) : (
              <div className="grade-mini-list">
                {grades.map((grade) => (
                  <div className="grade-mini" key={grade.id}>
                    <div>
                      <strong>{grade.assignment}</strong>
                      <p>
                        {grade.code} &middot; {grade.term}
                      </p>
                    </div>
                    <div className="grade-score">
                      <strong className={`text-${gradeTone((grade.score / grade.max_score) * 100)}`}>
                        {Number(grade.score)}/{Number(grade.max_score)}
                      </strong>
                      <span>{percent((grade.score / grade.max_score) * 100, 1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="split-grid">
          <section className="card invoice-spotlight">
            <div className="card-head">
              <div>
                <h2 className="card-title">Billing snapshot</h2>
                <p className="card-sub">Your next payment at a glance</p>
              </div>
              <Link to="/billing" className="text-link">
                Open billing
              </Link>
            </div>
            {invoice ? (
              <div className="invoice-spotlight-body">
                <div>
                  <p className="helper">Outstanding balance</p>
                  <p className="big-amount">{formatMoney(invoice.balance)}</p>
                  <p className="helper">
                    {invoice.description} &middot; due {formatDate(invoice.due_date)}
                  </p>
                </div>
                <div className="invoice-spotlight-actions">
                  <StatusBadge status={invoice.status} />
                  <Link to="/billing" className="btn btn-primary">
                    Pay now
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<WalletIcon size={24} />}
                title="No outstanding balance"
                message="Your account is fully settled."
              />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Notifications</h2>
                <p className="card-sub">Latest updates from the campus</p>
              </div>
              <Link to="/notifications" className="text-link">
                See all
              </Link>
            </div>
            <NotificationList notifications={notifications} />
          </section>
        </div>
      </div>
    );
  }

  const { stats, enrollment_by_program: programs, attendance_trend: trend, recent_payments: payments, overdue_invoices: overdue, notifications } = data;
  const maxProgram = Math.max(...programs.map((row) => Number(row.count)), 1);

  return (
    <div className="page">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={today}
        actions={
          <Link to="/reports" className="btn btn-ghost">
            <ChartIcon size={17} />
            View reports
          </Link>
        }
      />

      <div className="stat-grid">
        <StatCard
          icon={<UsersIcon size={22} />}
          label="Total students"
          value={Number(stats.total_students).toLocaleString('en-US')}
          hint={`${Number(stats.total_courses)} active courses`}
          tone="indigo"
        />
        <StatCard
          icon={<CalendarIcon size={22} />}
          label="Attendance rate"
          value={percent(stats.attendance_rate, 1)}
          hint="Last 7 days"
          tone="emerald"
        />
        <StatCard
          icon={<WalletIcon size={22} />}
          label="Outstanding balance"
          value={formatCompactMoney(stats.outstanding)}
          hint="Across unpaid invoices"
          tone="amber"
        />
        <StatCard
          icon={<TrendUpIcon size={22} />}
          label="Total collected"
          value={formatCompactMoney(stats.collected)}
          hint="Payments recorded to date"
          tone="sky"
        />
      </div>

      <div className="split-grid wide-left">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Attendance trend</h2>
              <p className="card-sub">Present and late records over the last 7 days</p>
            </div>
            <span className="chip-soft">Live</span>
          </div>
          <TrendChart data={trend} />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Enrollment by program</h2>
              <p className="card-sub">Active students this semester</p>
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
          <div className="card-foot-note">
            <span>{Number(stats.total_students)} active students</span>
            <Link to="/students" className="text-link">
              Manage students
            </Link>
          </div>
        </section>
      </div>

      <div className="split-grid wide-left">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Recent payments</h2>
              <p className="card-sub">Latest transactions across all student accounts</p>
            </div>
            <Link to="/billing" className="text-link">
              Open billing
            </Link>
          </div>
          {payments.length === 0 ? (
            <EmptyState title="No payments yet" message="Recorded payments will appear here." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Invoice</th>
                    <th>Method</th>
                    <th>Date</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="person-cell">
                          <Avatar name={payment.student_name} size={32} />
                          <div>
                            <strong>{payment.student_name}</strong>
                            <span>{payment.student_no}</span>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{payment.invoice_no}</td>
                      <td>
                        <span className="method-tag">
                          {payment.method.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{formatDate(payment.paid_at)}</td>
                      <td className="text-right amount-cell">{formatMoney(payment.amount)}</td>
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
              <h2 className="card-title">Needs attention</h2>
              <p className="card-sub">Overdue invoices past their due date</p>
            </div>
            <Link to="/billing" className="text-link">
              Review
            </Link>
          </div>
          {overdue.length === 0 ? (
            <EmptyState
              icon={<TrendUpIcon size={24} />}
              title="All clear"
              message="No overdue invoices right now."
            />
          ) : (
            <div className="attention-list">
              {overdue.map((invoice) => (
                <div className="attention-row" key={invoice.id}>
                  <div>
                    <strong>{invoice.student_name}</strong>
                    <p>
                      {invoice.description} &middot; due {formatDate(invoice.due_date)}
                    </p>
                  </div>
                  <div className="attention-amount">
                    <strong>{formatMoney(invoice.balance)}</strong>
                    <StatusBadge status={invoice.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="split-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Notifications</h2>
              <p className="card-sub">Recent activity for your admin account</p>
            </div>
            <Link to="/notifications" className="text-link">
              See all
            </Link>
          </div>
          <NotificationList notifications={notifications} />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Quick actions</h2>
              <p className="card-sub">Jump straight into daily tasks</p>
            </div>
          </div>
          <div className="quick-grid">
            <Link to="/students?new=1" className="quick-action">
              <span className="quick-icon tone-indigo">
                <PlusIcon size={18} />
              </span>
              <span>
                <strong>Add student</strong>
                <small>Create a student account</small>
              </span>
            </Link>
            <Link to="/attendance" className="quick-action">
              <span className="quick-icon tone-emerald">
                <CalendarIcon size={18} />
              </span>
              <span>
                <strong>Record attendance</strong>
                <small>Mark today&apos;s roll call</small>
              </span>
            </Link>
            <Link to="/billing?new=1" className="quick-action">
              <span className="quick-icon tone-amber">
                <WalletIcon size={18} />
              </span>
              <span>
                <strong>Create invoice</strong>
                <small>Bill a student account</small>
              </span>
            </Link>
            <Link to="/notifications?announce=1" className="quick-action">
              <span className="quick-icon tone-sky">
                <SendIcon size={18} />
              </span>
              <span>
                <strong>Send announcement</strong>
                <small>Email and SMS students</small>
              </span>
            </Link>
          </div>
          <div className="sync-note">
            <span className="sync-dot" />
            <div>
              <strong>Integration is live</strong>
              <p>
                New enrollments create LMS accounts, attendance updates profiles, and paid
                invoices activate classes automatically.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
