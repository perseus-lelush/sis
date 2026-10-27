import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatMoney, percent } from '../lib/api.js';
import { PROGRAM_OPTIONS, YEAR_OPTIONS } from '../lib/constants.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  Avatar,
  EmptyState,
  Loading,
  Modal,
  PageHeader,
  Progress,
  StatusBadge,
} from '../components/ui.jsx';
import {
  EditIcon,
  EyeIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from '../components/Icons.jsx';

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  program: PROGRAM_OPTIONS[0],
  year_level: 1,
  section: '',
  gender: '',
  dob: '',
  phone: '',
  address: '',
  guardian_name: '',
  guardian_phone: '',
  status: 'active',
};

function StudentForm({ form, setForm, editing }) {
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <div className="form-grid">
      <label className="field">
        <span>First name</span>
        <input value={form.first_name} onChange={update('first_name')} required />
      </label>
      <label className="field">
        <span>Last name</span>
        <input value={form.last_name} onChange={update('last_name')} required />
      </label>
      <label className="field">
        <span>Email address</span>
        <input type="email" value={form.email} onChange={update('email')} required />
      </label>
      <label className="field">
        <span>Phone</span>
        <input value={form.phone} onChange={update('phone')} placeholder="0917 000 0000" />
      </label>
      <label className="field">
        <span>Program</span>
        <select value={form.program} onChange={update('program')} required>
          {PROGRAM_OPTIONS.map((program) => (
            <option value={program} key={program}>
              {program}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Year level</span>
        <select value={form.year_level} onChange={update('year_level')}>
          {YEAR_OPTIONS.map((year) => (
            <option value={year} key={year}>
              Year {year}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Section</span>
        <input value={form.section} onChange={update('section')} placeholder="A" />
      </label>
      <label className="field">
        <span>Gender</span>
        <select value={form.gender} onChange={update('gender')}>
          <option value="">Not specified</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label className="field">
        <span>Date of birth</span>
        <input type="date" value={form.dob || ''} onChange={update('dob')} />
      </label>
      {editing ? (
        <label className="field">
          <span>Status</span>
          <select value={form.status} onChange={update('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
          </select>
        </label>
      ) : (
        <label className="field">
          <span>Account password</span>
          <input
            type="text"
            value={form.password}
            onChange={update('password')}
            placeholder="student123"
          />
          <small>Leave blank to use the default password.</small>
        </label>
      )}
      <label className="field">
        <span>Guardian name</span>
        <input value={form.guardian_name} onChange={update('guardian_name')} />
      </label>
      <label className="field">
        <span>Guardian phone</span>
        <input value={form.guardian_phone} onChange={update('guardian_phone')} />
      </label>
      <label className="field field-full">
        <span>Address</span>
        <textarea rows="2" value={form.address} onChange={update('address')} />
      </label>
    </div>
  );
}

export default function Students() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      const response = await api.get(`/students?${params.toString()}`);
      setStudents(response.students);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [search, status]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreate();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(student) {
    setEditing(student);
    setForm({
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      email: student.email || '',
      password: '',
      program: student.program || PROGRAM_OPTIONS[0],
      year_level: student.year_level || 1,
      section: student.section || '',
      gender: student.gender || '',
      dob: student.dob || '',
      phone: student.phone || '',
      address: student.address || '',
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      status: student.status || 'active',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, year_level: Number(form.year_level) };
      if (editing && !payload.password) delete payload.password;
      if (editing) {
        await api.put(`/students/${editing.id}`, payload);
        toast('Student record updated');
      } else {
        await api.post('/students', payload);
        toast('Student created with a linked portal account');
      }
      setModalOpen(false);
      await load();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteTarget.id}`);
      toast('Student account removed');
      setDeleteTarget(null);
      await load();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  const activeCount = students.filter((student) => student.status === 'active').length;
  const withBalance = students.filter((student) => Number(student.balance) > 0).length;

  return (
    <div className="page">
      <PageHeader
        title="Students"
        subtitle="Manage student records, portal accounts, and outstanding balances."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <PlusIcon size={17} />
            Add student
          </button>
        }
      />

      <div className="summary-strip">
        <div>
          <span>Showing</span>
          <strong>{students.length} students</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>With balance</span>
          <strong>{withBalance}</strong>
        </div>
        <div className="summary-note">
          Creating a student automatically provisions an LMS account and an enrollment invoice.
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="search-box">
            <SearchIcon size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, student no, or email"
            />
          </div>
          <div className="filters">
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>
        </div>

        {error && <div className="form-error inline">{error}</div>}

        {loading ? (
          <Loading label="Loading students..." />
        ) : students.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={26} />}
            title="No students found"
            message="Try adjusting your filters or add a new student."
            action={
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <PlusIcon size={17} />
                Add student
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student no.</th>
                  <th>Program</th>
                  <th>Attendance</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={student.full_name} size={36} />
                        <div>
                          <strong>{student.full_name}</strong>
                          <span>{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{student.student_no}</td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{student.program}</strong>
                        <span>
                          Year {student.year_level}
                          {student.section ? ` \u00B7 Section ${student.section}` : ''}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="attendance-cell">
                        <Progress
                          value={student.attendance_rate}
                          tone={Number(student.attendance_rate) >= 85 ? 'emerald' : 'amber'}
                        />
                        <span>{percent(student.attendance_rate, 1)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={Number(student.balance) > 0 ? 'amount-due' : 'amount-clear'}>
                        {formatMoney(student.balance)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={student.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link to={`/students/${student.id}`} className="icon-btn" title="View profile">
                          <EyeIcon size={17} />
                        </Link>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit student"
                          onClick={() => openEdit(student)}
                        >
                          <EditIcon size={17} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Delete student"
                          onClick={() => setDeleteTarget(student)}
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
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit student' : 'Add student'}
        subtitle={
          editing
            ? 'Update the student profile and linked portal account.'
            : 'A portal login, LMS enrollments, and an enrollment invoice will be created automatically.'
        }
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="student-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Create student'}
            </button>
          </>
        }
      >
        <form id="student-form" onSubmit={handleSubmit}>
          {formError && <div className="form-error">{formError}</div>}
          <StudentForm form={form} setForm={setForm} editing={Boolean(editing)} />
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove student account"
        subtitle="This also removes the student's login, enrollments, attendance, grades, and invoices."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing...' : 'Remove student'}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <p className="confirm-text">
            Remove <strong>{deleteTarget.full_name}</strong> ({deleteTarget.student_no}) from the
            system? This action cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}
