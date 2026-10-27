import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { api, formatDate } from '../lib/api.js';
import { EmptyState, Loading, Modal, PageHeader } from '../components/ui.jsx';
import {
  ClipboardIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
} from '../components/Icons.jsx';

const STATUSES = ['pending', 'enrolled', 'completed', 'dropped'];

const FILTERS = [
  { value: 'all', label: 'All records' },
  { value: 'pending', label: 'Pending' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
];

export default function Enrollment() {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ student_id: '', course_id: '', status: 'enrolled' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [recordsResponse, studentsResponse, coursesResponse] = await Promise.all([
        api.get('/enrollments'),
        api.get('/students'),
        api.get('/courses'),
      ]);
      setRecords(recordsResponse.enrollments);
      setStudents(studentsResponse.students);
      setCourses(coursesResponse.courses);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (filter !== 'all' && record.status !== filter) return false;
      if (!term) return true;
      return [record.student_name, record.student_no, record.code, record.title]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [records, filter, search]);

  const counts = useMemo(
    () => ({
      total: records.length,
      enrolled: records.filter((record) => record.status === 'enrolled').length,
      pending: records.filter((record) => record.status === 'pending').length,
      dropped: records.filter((record) => record.status === 'dropped').length,
    }),
    [records],
  );

  function openCreate() {
    setForm({
      student_id: students[0] ? String(students[0].id) : '',
      course_id: courses[0] ? String(courses[0].id) : '',
      status: 'enrolled',
    });
    setFormError('');
    setCreateOpen(true);
  }

  async function submitCreate(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/enrollments', {
        student_id: Number(form.student_id),
        course_id: Number(form.course_id),
        status: form.status,
      });
      toast('Enrollment record created');
      setCreateOpen(false);
      await load();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(record, status) {
    setUpdatingId(record.id);
    try {
      await api.patch(`/enrollments/${record.id}`, { status });
      toast(`Enrollment marked as ${status}`);
      setRecords((current) =>
        current.map((item) => (item.id === record.id ? { ...item, status } : item)),
      );
    } catch (requestError) {
      toast(requestError.message, 'error');
      setRecords((current) => [...current]);
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeRecord() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/enrollments/${deleteTarget.id}`);
      toast('Enrollment record removed');
      setDeleteTarget(null);
      await load();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <Loading label="Loading enrollment records..." />;

  return (
    <div className="page">
      <PageHeader
        title="Enrollment"
        subtitle="Manage the enrollment records that connect students to courses."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <PlusIcon size={17} />
            New enrollment
          </button>
        }
      />

      {error && <div className="form-error">{error}</div>}

      <div className="summary-strip">
        <div>
          <span>Total records</span>
          <strong>{counts.total}</strong>
        </div>
        <div>
          <span>Enrolled</span>
          <strong>{counts.enrolled}</strong>
        </div>
        <div>
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </div>
        <div>
          <span>Dropped</span>
          <strong>{counts.dropped}</strong>
        </div>
        <div className="summary-note">
          Each enrollment references the shared student and course IDs. Status changes notify the
          student and are written to the audit trail.
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Enrollment records</h2>
            <p className="card-sub">Course assignments across all programs</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshIcon size={15} />
            Refresh
          </button>
        </div>

        <div className="table-toolbar">
          <div className="search-box">
            <SearchIcon size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student, student no, or course"
            />
          </div>
          <div className="filters">
            <div className="filter-tabs">
              {FILTERS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={`filter-tab ${filter === item.value ? 'active' : ''}`}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleRecords.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon size={26} />}
            title="No enrollment records"
            message="Create an enrollment record or adjust the filters."
            action={
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <PlusIcon size={17} />
                New enrollment
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Semester</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="stacked-cell">
                        <strong>{record.student_name}</strong>
                        <span>
                          {record.student_no} · {record.program}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="stacked-cell">
                        <strong>
                          <span className="code-pill">{record.code}</span> {record.title}
                        </strong>
                        <span>{record.schedule || 'Schedule pending'}</span>
                      </div>
                    </td>
                    <td className="muted">{record.semester}</td>
                    <td className="mono">{formatDate(record.enrolled_at)}</td>
                    <td>
                      <select
                        className="table-select"
                        value={record.status}
                        disabled={updatingId === record.id}
                        onChange={(event) => changeStatus(record, event.target.value)}
                        aria-label={`Enrollment status for ${record.student_name}`}
                      >
                        {STATUSES.map((status) => (
                          <option value={status} key={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Remove enrollment"
                          onClick={() => setDeleteTarget(record)}
                        >
                          <TrashIcon size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New enrollment record"
        subtitle="The record links an existing student to an existing course."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="enrollment-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create record'}
            </button>
          </>
        }
      >
        <form id="enrollment-form" onSubmit={submitCreate}>
          {formError && <div className="form-error">{formError}</div>}
          <div className="form-grid">
            <label className="field field-full">
              <span>Student</span>
              <select
                value={form.student_id}
                onChange={(event) => setForm({ ...form, student_id: event.target.value })}
                required
              >
                <option value="">Select a student</option>
                {students.map((student) => (
                  <option value={student.id} key={student.id}>
                    {student.full_name} ({student.student_no})
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span>Course</span>
              <select
                value={form.course_id}
                onChange={(event) => setForm({ ...form, course_id: event.target.value })}
                required
              >
                <option value="">Select a course</option>
                {courses.map((course) => (
                  <option value={course.id} key={course.id}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {STATUSES.map((status) => (
                  <option value={status} key={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove enrollment record"
        subtitle="This also removes attendance and grade entries for that class."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={removeRecord} disabled={deleting}>
              {deleting ? 'Removing...' : 'Remove record'}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <p className="confirm-text">
            Remove <strong>{deleteTarget.student_name}</strong> from{' '}
            <strong>{deleteTarget.code}</strong>? This action cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}
