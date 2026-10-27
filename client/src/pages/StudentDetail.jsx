import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  formatDate,
  formatDateTime,
  formatMoney,
  gradeTone,
  percent,
} from '../lib/api.js';
import {
  Avatar,
  EmptyState,
  Loading,
  Progress,
  StatusBadge,
} from '../components/ui.jsx';
import { ArrowLeftIcon, CalendarIcon, WalletIcon, BookIcon, TrendUpIcon } from '../components/Icons.jsx';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'courses', label: 'Courses & grades' },
  { id: 'billing', label: 'Billing' },
];

function InfoItem({ label, value }) {
  return (
    <div className="info-item">
      <span>{label}</span>
      <strong>{value || 'N/A'}</strong>
    </div>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/students/${id}`);
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <Loading label="Loading student profile..." />;
  if (error || !data) {
    return (
      <EmptyState
        title="Could not load this student"
        message={error || 'Student not found.'}
        action={
          <Link to="/students" className="btn btn-primary">
            Back to students
          </Link>
        }
      />
    );
  }

  const { student, enrollments, attendance_summary: summaries, attendance, grades, invoices } = data;

  const totalAttendance = summaries.reduce((accumulator, row) => accumulator + Number(row.total), 0);
  const attendedAttendance = summaries.reduce(
    (accumulator, row) => accumulator + Number(row.present) + Number(row.late),
    0,
  );
  const overallRate = totalAttendance ? (attendedAttendance / totalAttendance) * 100 : 0;

  const gradedCourses = enrollments.filter((course) => course.avg_grade != null);
  const averageGrade = gradedCourses.length
    ? gradedCourses.reduce((accumulator, course) => accumulator + Number(course.avg_grade), 0) /
      gradedCourses.length
    : 0;

  const balance = invoices.reduce((accumulator, invoice) => accumulator + Number(invoice.balance), 0);
  const courseCount = enrollments.filter((course) => course.status !== 'dropped').length;

  return (
    <div className="page">
      <div className="back-row">
        <Link to="/students" className="back-link">
          <ArrowLeftIcon size={16} />
          Back to students
        </Link>
      </div>

      <section className="profile-hero">
        <div className="profile-hero-main">
          <Avatar name={student.full_name} size={82} />
          <div>
            <div className="profile-title-row">
              <h1>{student.full_name}</h1>
              <StatusBadge status={student.status} />
            </div>
            <p className="profile-sub">
              {student.program} &middot; Year {student.year_level}
              {student.section ? ` \u00B7 Section ${student.section}` : ''}
            </p>
            <div className="profile-tags">
              <span className="tag">{student.student_no}</span>
              <span className="tag">{student.email}</span>
              <span className="tag">Joined {formatDate(student.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="profile-hero-actions">
          <Link to="/attendance" className="btn btn-ghost">
            <CalendarIcon size={16} />
            Attendance
          </Link>
          <Link to="/billing" className="btn btn-primary">
            <WalletIcon size={16} />
            Billing
          </Link>
        </div>
      </section>

      <div className="stat-grid compact">
        <div className="stat-card small">
          <div className="stat-icon tone-emerald">
            <CalendarIcon size={20} />
          </div>
          <div className="stat-body">
            <p className="stat-label">Attendance</p>
            <p className="stat-value">{percent(overallRate, 1)}</p>
          </div>
        </div>
        <div className="stat-card small">
          <div className="stat-icon tone-sky">
            <BookIcon size={20} />
          </div>
          <div className="stat-body">
            <p className="stat-label">Courses</p>
            <p className="stat-value">{courseCount}</p>
          </div>
        </div>
        <div className="stat-card small">
          <div className="stat-icon tone-indigo">
            <TrendUpIcon size={20} />
          </div>
          <div className="stat-body">
            <p className="stat-label">Average grade</p>
            <p className="stat-value">{percent(averageGrade, 1)}</p>
          </div>
        </div>
        <div className="stat-card small">
          <div className="stat-icon tone-amber">
            <WalletIcon size={20} />
          </div>
          <div className="stat-body">
            <p className="stat-label">Balance</p>
            <p className="stat-value">{formatMoney(balance)}</p>
          </div>
        </div>
      </div>

      <div className="card tabs-card">
        <div className="tabs">
          {TABS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`tab ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="tab-panel">
            <div className="info-grid">
              <InfoItem label="Email address" value={student.email} />
              <InfoItem label="Phone" value={student.phone} />
              <InfoItem label="Date of birth" value={formatDate(student.dob)} />
              <InfoItem label="Gender" value={student.gender} />
              <InfoItem label="Address" value={student.address} />
              <InfoItem label="Guardian" value={student.guardian_name} />
              <InfoItem label="Guardian phone" value={student.guardian_phone} />
              <InfoItem label="Portal account" value={student.account_email} />
              <InfoItem label="Account created" value={formatDateTime(student.account_created_at)} />
            </div>

            <div className="section-heading">
              <h2>Attendance by course</h2>
              <p>Attendance records instantly update this student profile.</p>
            </div>
            {summaries.length === 0 ? (
              <EmptyState title="No attendance data" message="Attendance will appear after roll call is recorded." />
            ) : (
              <div className="attendance-summary-grid">
                {summaries.map((row) => (
                  <div className="attendance-summary-item" key={row.course_id}>
                    <div className="attendance-summary-head">
                      <div>
                        <span className="code-pill">{row.code}</span>
                        <strong>{row.title}</strong>
                      </div>
                      <span>{percent(row.rate, 1)}</span>
                    </div>
                    <Progress
                      value={row.rate}
                      tone={Number(row.rate) >= 85 ? 'emerald' : 'amber'}
                    />
                    <div className="attendance-counts">
                      <span>Present {row.present}</span>
                      <span>Late {row.late}</span>
                      <span>Absent {row.absent}</span>
                      <span>Excused {row.excused}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="tab-panel">
            {attendance.length === 0 ? (
              <EmptyState title="No attendance records" message="No roll call has been recorded for this student." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Course</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record.id}>
                        <td>{formatDate(record.date)}</td>
                        <td>
                          <div className="stacked-cell">
                            <strong>{record.code}</strong>
                            <span>{record.title}</span>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="muted">{record.remarks || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'courses' && (
          <div className="tab-panel">
            {enrollments.length === 0 ? (
              <EmptyState title="Not enrolled" message="This student has no course enrollments yet." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Instructor</th>
                      <th>Schedule</th>
                      <th>Status</th>
                      <th className="text-right">Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((course) => (
                      <tr key={course.id}>
                        <td>
                          <div className="stacked-cell">
                            <strong>
                              <span className="code-pill">{course.code}</span> {course.title}
                            </strong>
                            <span>{course.units} units</span>
                          </div>
                        </td>
                        <td>{course.instructor}</td>
                        <td>
                          <div className="stacked-cell">
                            <strong>{course.schedule}</strong>
                            <span>{course.room}</span>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={course.status} />
                        </td>
                        <td className="text-right">
                          <span className={`grade-pill text-${gradeTone(course.avg_grade)}`}>
                            {course.avg_grade != null ? percent(course.avg_grade, 1) : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="section-heading">
              <h2>Grade items</h2>
              <p>{grades.length} recorded scores</p>
            </div>
            {grades.length === 0 ? (
              <EmptyState title="No grades yet" message="Graded work will appear here." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Assessment</th>
                      <th>Term</th>
                      <th className="text-right">Score</th>
                      <th className="text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id}>
                        <td className="mono">{grade.code}</td>
                        <td>{grade.assignment}</td>
                        <td>{grade.term}</td>
                        <td className="text-right">
                          {Number(grade.score)}/{Number(grade.max_score)}
                        </td>
                        <td className="text-right">
                          <span
                            className={`grade-pill text-${gradeTone(
                              (grade.score / grade.max_score) * 100,
                            )}`}
                          >
                            {percent((grade.score / grade.max_score) * 100, 1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'billing' && (
          <div className="tab-panel">
            {invoices.length === 0 ? (
              <EmptyState title="No invoices" message="This student has no billing records." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Description</th>
                      <th>Due date</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="mono">{invoice.invoice_no}</td>
                        <td>{invoice.description}</td>
                        <td>{formatDate(invoice.due_date)}</td>
                        <td>
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="text-right">{formatMoney(invoice.amount)}</td>
                        <td className="text-right">{formatMoney(invoice.paid)}</td>
                        <td className={`text-right ${Number(invoice.balance) > 0 ? 'amount-due' : 'amount-clear'}`}>
                          {formatMoney(invoice.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
