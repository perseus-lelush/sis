import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, formatDate, percent } from '../lib/api.js';
import {
  EmptyState,
  Loading,
  PageHeader,
  Progress,
  StatCard,
  StatusBadge,
} from '../components/ui.jsx';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  RefreshIcon,
  UsersIcon,
} from '../components/Icons.jsx';

const STATUS_OPTIONS = [
  { value: 'present', short: 'P', label: 'Present' },
  { value: 'late', short: 'L', label: 'Late' },
  { value: 'absent', short: 'A', label: 'Absent' },
  { value: 'excused', short: 'E', label: 'Excused' },
];

function todayISO() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function AdminAttendance() {
  const { toast } = useToast();
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [course, setCourse] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadCourses() {
      try {
        const response = await api.get('/courses');
        if (!active) return;
        setCourses(response.courses);
        if (response.courses.length) setCourseId(String(response.courses[0].id));
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }
    loadCourses();
    return () => {
      active = false;
    };
  }, []);

  async function loadSheet() {
    if (!courseId) return;
    setLoadingSheet(true);
    setError('');
    try {
      const response = await api.get(
        `/attendance/sheet?course_id=${courseId}&date=${encodeURIComponent(date)}`,
      );
      setCourse(response.course);
      setRoster(
        response.roster.map((row) => ({
          ...row,
          status: row.status || '',
          remarks: row.remarks || '',
        })),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingSheet(false);
    }
  }

  useEffect(() => {
    if (courseId) loadSheet();
  }, [courseId, date]);

  function setStatus(studentId, status) {
    setRoster((current) =>
      current.map((row) => (row.student_id === studentId ? { ...row, status } : row)),
    );
  }

  function setRemarks(studentId, remarks) {
    setRoster((current) =>
      current.map((row) => (row.student_id === studentId ? { ...row, remarks } : row)),
    );
  }

  const counts = useMemo(() => {
    return STATUS_OPTIONS.reduce((accumulator, option) => {
      accumulator[option.value] = roster.filter((row) => row.status === option.value).length;
      return accumulator;
    }, {});
  }, [roster]);

  const marked = roster.filter((row) => row.status).length;

  async function handleSave() {
    const records = roster
      .filter((row) => row.status)
      .map((row) => ({
        student_id: row.student_id,
        status: row.status,
        remarks: row.remarks,
      }));

    if (!records.length) {
      toast('Mark at least one student before saving.', 'error');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/attendance/sheet', {
        course_id: Number(courseId),
        date,
        records,
      });
      toast(
        `Attendance saved for ${response.saved} student(s)${
          response.notified ? ` \u00B7 ${response.notified} alert(s) sent` : ''
        }`,
      );
      await loadSheet();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Attendance"
        subtitle="Record daily roll call and keep student attendance profiles in sync."
        actions={
          <button type="button" className="btn btn-ghost" onClick={loadSheet} disabled={!courseId}>
            <RefreshIcon size={16} />
            Refresh
          </button>
        }
      />

      <section className="card attendance-toolbar">
        <label className="field">
          <span>Course</span>
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            disabled={!courses.length}
          >
            {courses.map((item) => (
              <option value={item.id} key={item.id}>
                {item.code} - {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        {course && (
          <div className="course-brief">
            <strong>{course.title}</strong>
            <span>Roll call sheet</span>
          </div>
        )}
      </section>

      {error && <div className="form-error inline">{error}</div>}

      {!courses.length ? (
        <EmptyState
          icon={<CalendarIcon size={26} />}
          title="No courses available"
          message="Create a course first before recording attendance."
        />
      ) : loadingSheet ? (
        <Loading label="Loading roll call..." />
      ) : (
        <section className="card">
          <div className="attendance-summary-bar">
            <div className="summary-pills">
              <span className="pill pill-present">Present {counts.present || 0}</span>
              <span className="pill pill-late">Late {counts.late || 0}</span>
              <span className="pill pill-absent">Absent {counts.absent || 0}</span>
              <span className="pill pill-excused">Excused {counts.excused || 0}</span>
            </div>
            <div className="attendance-actions">
              <span className="helper">
                {marked}/{roster.length} marked
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !roster.length}
              >
                <CheckIcon size={16} />
                {saving ? 'Saving...' : 'Save attendance'}
              </button>
            </div>
          </div>

          {roster.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={26} />}
              title="No students enrolled"
              message="Enroll students in this course to take attendance."
            />
          ) : (
            <div className="table-wrap">
              <table className="table attendance-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student no.</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((row) => (
                    <tr key={row.student_id} className={row.status ? 'row-marked' : ''}>
                      <td>
                        <div className="stacked-cell">
                          <strong>{row.name}</strong>
                          <span>{course?.code}</span>
                        </div>
                      </td>
                      <td className="mono">{row.student_no}</td>
                      <td>
                        <div className="status-group">
                          {STATUS_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`status-btn status-${option.value} ${
                                row.status === option.value ? 'active' : ''
                              }`}
                              onClick={() => setStatus(row.student_id, option.value)}
                              title={option.label}
                            >
                              {option.short}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          className="input remarks-input"
                          value={row.remarks}
                          onChange={(event) => setRemarks(row.student_id, event.target.value)}
                          placeholder="Optional remark"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StudentAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/attendance/me');
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

  if (loading) return <Loading label="Loading your attendance..." />;
  if (error || !data) {
    return (
      <EmptyState
        title="Could not load attendance"
        message={error}
        action={
          <button type="button" className="btn btn-primary" onClick={load}>
            Try again
          </button>
        }
      />
    );
  }

  const { summary, courses, records } = data;

  return (
    <div className="page">
      <PageHeader
        title="My Attendance"
        subtitle="Track your attendance rate and review every recorded roll call."
      />

      <div className="stat-grid">
        <StatCard
          icon={<CalendarIcon size={22} />}
          label="Attendance rate"
          value={percent(summary.rate, 1)}
          hint="Present and late records"
          tone="indigo"
        />
        <StatCard
          icon={<CheckIcon size={22} />}
          label="Present"
          value={summary.present}
          hint={`${summary.total} total records`}
          tone="emerald"
        />
        <StatCard
          icon={<ClockIcon size={22} />}
          label="Late"
          value={summary.late}
          hint="Arrived after roll call"
          tone="amber"
        />
        <StatCard
          icon={<CloseIcon size={22} />}
          label="Absent"
          value={summary.absent}
          hint={`${summary.excused} excused`}
          tone="rose"
        />
      </div>

      <div className="split-grid wide-left">
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Attendance by course</h2>
              <p className="card-sub">Your standing in each enrolled subject</p>
            </div>
          </div>
          {courses.length === 0 ? (
            <EmptyState title="No courses" message="Enroll in a course to start tracking attendance." />
          ) : (
            <div className="attendance-summary-grid">
              {courses.map((course) => (
                <div className="attendance-summary-item" key={course.id}>
                  <div className="attendance-summary-head">
                    <div>
                      <span className="code-pill">{course.code}</span>
                      <strong>{course.title}</strong>
                    </div>
                    <span>{percent(course.rate, 1)}</span>
                  </div>
                  <Progress
                    value={course.rate}
                    tone={Number(course.rate) >= 85 ? 'emerald' : 'amber'}
                  />
                  <div className="attendance-counts">
                    <span>Present {course.present}</span>
                    <span>Late {course.late}</span>
                    <span>Absent {course.absent}</span>
                    <span>Excused {course.excused}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Recent records</h2>
              <p className="card-sub">Latest roll call entries</p>
            </div>
          </div>
          {records.length === 0 ? (
            <EmptyState title="No attendance yet" message="Your instructors have not recorded any roll call." />
          ) : (
            <div className="record-list">
              {records.slice(0, 12).map((record) => (
                <div className="record-row" key={record.id}>
                  <div>
                    <strong>{record.code}</strong>
                    <p>{formatDate(record.date)}</p>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminAttendance /> : <StudentAttendance />;
}
