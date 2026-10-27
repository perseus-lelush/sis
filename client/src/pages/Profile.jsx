import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, formatDate, formatDateTime, percent } from '../lib/api.js';
import {
  Avatar,
  EmptyState,
  Loading,
  PageHeader,
  Progress,
  StatusBadge,
} from '../components/ui.jsx';
import { CalendarIcon, UserIcon } from '../components/Icons.jsx';

function InfoItem({ label, value }) {
  return (
    <div className="info-item">
      <span>{label}</span>
      <strong>{value || 'N/A'}</strong>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(user?.role === 'student');
  const [error, setError] = useState('');

  async function load() {
    if (!user?.student_id) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/students/${user.student_id}`);
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user?.student_id]);

  if (user?.role === 'admin') {
    return (
      <div className="page">
        <PageHeader title="My Profile" subtitle="Your administrator account details." />
        <section className="profile-hero">
          <div className="profile-hero-main">
            <Avatar name={user.name} size={82} />
            <div>
              <div className="profile-title-row">
                <h1>{user.name}</h1>
                <StatusBadge status="active" />
              </div>
              <p className="profile-sub">Administrator &middot; SIS Campus Console</p>
              <div className="profile-tags">
                <span className="tag">{user.email}</span>
                <span className="tag">Full system access</span>
              </div>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Administrator account</h2>
              <p className="card-sub">Account permissions</p>
            </div>
          </div>
          <div className="info-grid">
            <InfoItem label="Full name" value={user.name} />
            <InfoItem label="Email address" value={user.email} />
            <InfoItem label="Role" value="Administrator" />
            <InfoItem label="Access" value="Students, attendance, LMS, billing, notifications, reports" />
          </div>
        </section>
      </div>
    );
  }

  if (loading) return <Loading label="Loading your profile..." />;
  if (error || !data) {
    return (
      <EmptyState
        title="Could not load your profile"
        message={error || 'Profile not found.'}
        action={
          <button type="button" className="btn btn-primary" onClick={load}>
            Try again
          </button>
        }
      />
    );
  }

  const { student, enrollments, attendance_summary: summaries } = data;

  return (
    <div className="page">
      <PageHeader
        title="My Profile"
        subtitle="Your student record and account information."
      />

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
            </div>
          </div>
        </div>
      </section>

      <div className="split-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Personal information</h2>
              <p className="card-sub">Contact details on record</p>
            </div>
            <span className="card-icon">
              <UserIcon size={18} />
            </span>
          </div>
          <div className="info-grid single">
            <InfoItem label="Email address" value={student.email} />
            <InfoItem label="Phone" value={student.phone} />
            <InfoItem label="Date of birth" value={formatDate(student.dob)} />
            <InfoItem label="Gender" value={student.gender} />
            <InfoItem label="Address" value={student.address} />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Academic details</h2>
              <p className="card-sub">Enrollment and account standing</p>
            </div>
          </div>
          <div className="info-grid single">
            <InfoItem label="Program" value={student.program} />
            <InfoItem label="Year level" value={`Year ${student.year_level}`} />
            <InfoItem label="Section" value={student.section} />
            <InfoItem label="Enrolled courses" value={`${enrollments.length} courses`} />
            <InfoItem label="Account created" value={formatDateTime(student.created_at)} />
          </div>
        </section>
      </div>

      <div className="split-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Guardian and emergency contact</h2>
              <p className="card-sub">Contact person on file</p>
            </div>
          </div>
          <div className="info-grid single">
            <InfoItem label="Guardian name" value={student.guardian_name} />
            <InfoItem label="Guardian phone" value={student.guardian_phone} />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Attendance standing</h2>
              <p className="card-sub">Keep above 85% to stay in good standing</p>
            </div>
            <span className="card-icon">
              <CalendarIcon size={18} />
            </span>
          </div>
          {summaries.length === 0 ? (
            <EmptyState title="No attendance data" message="Attendance will appear after roll call." />
          ) : (
            <div className="attendance-summary-grid compact">
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
