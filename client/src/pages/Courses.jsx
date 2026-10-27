import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, gradeTone, percent } from '../lib/api.js';
import { PROGRAM_OPTIONS } from '../lib/constants.js';
import {
  Badge,
  EmptyState,
  Loading,
  Modal,
  PageHeader,
  Progress,
  StatCard,
  StatusBadge,
} from '../components/ui.jsx';
import {
  BookIcon,
  CalendarIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  TrendUpIcon,
  UsersIcon,
} from '../components/Icons.jsx';

const COURSE_PROGRAMS = [...PROGRAM_OPTIONS, 'General'];

const EMPTY_COURSE = {
  code: '',
  title: '',
  instructor: '',
  program: PROGRAM_OPTIONS[0],
  units: 3,
  schedule: '',
  room: '',
  semester: 'First Semester 2026',
};

function AdminCourses() {
  const { toast } = useToast();
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const [courseModal, setCourseModal] = useState(null);
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
  const [courseError, setCourseError] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const [gradeTarget, setGradeTarget] = useState(null);
  const [gradeForm, setGradeForm] = useState({
    assignment: '',
    term: 'Midterm',
    score: '',
    max_score: 100,
  });
  const [gradeError, setGradeError] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [unenrollTarget, setUnenrollTarget] = useState(null);
  const [unenrolling, setUnenrolling] = useState(false);

  async function loadCourses(preferredId) {
    setError('');
    try {
      const response = await api.get('/courses');
      setCourses(response.courses);
      if (preferredId) setSelectedId(String(preferredId));
      else {
        setSelectedId((current) =>
          current && response.courses.some((course) => String(course.id) === current)
            ? current
            : response.courses[0]
              ? String(response.courses[0].id)
              : '',
        );
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail() {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const response = await api.get(`/courses/${selectedId}`);
      setDetail(response);
    } catch (requestError) {
      setError(requestError.message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    loadDetail();
  }, [selectedId]);

  async function ensureStudents() {
    if (students.length) return students;
    const response = await api.get('/students');
    setStudents(response.students);
    return response.students;
  }

  function openCreateCourse() {
    setCourseForm(EMPTY_COURSE);
    setCourseError('');
    setCourseModal({ mode: 'create' });
  }

  function openEditCourse(course) {
    setCourseForm({
      code: course.code,
      title: course.title,
      instructor: course.instructor || '',
      program: course.program || 'General',
      units: course.units || 3,
      schedule: course.schedule || '',
      room: course.room || '',
      semester: course.semester || 'First Semester 2026',
    });
    setCourseError('');
    setCourseModal({ mode: 'edit', id: course.id });
  }

  async function saveCourse(event) {
    event.preventDefault();
    setSavingCourse(true);
    setCourseError('');
    try {
      const payload = { ...courseForm, units: Number(courseForm.units) };
      if (courseModal.mode === 'edit') {
        const editedId = courseModal.id;
        await api.put(`/courses/${editedId}`, payload);
        toast('Course updated');
        setCourseModal(null);
        // Refresh the catalog as well as the detail panel, otherwise the card
        // keeps showing the previous title and metadata until a full reload.
        await loadCourses(editedId);
      } else {
        const response = await api.post('/courses', payload);
        toast('Course created');
        setCourseModal(null);
        await loadCourses(response.id);
      }
    } catch (requestError) {
      setCourseError(requestError.message);
    } finally {
      setSavingCourse(false);
    }
  }

  async function openEnroll() {
    setEnrollOpen(true);
    try {
      const list = await ensureStudents();
      const rosterIds = new Set((detail?.roster || []).map((row) => row.student_id));
      const available = list.find((student) => !rosterIds.has(student.id));
      setEnrollStudentId(available ? String(available.id) : '');
    } catch (requestError) {
      toast(requestError.message, 'error');
    }
  }

  async function submitEnroll(event) {
    event.preventDefault();
    if (!enrollStudentId) {
      toast('Select a student to enroll.', 'error');
      return;
    }
    setEnrolling(true);
    try {
      await api.post(`/courses/${selectedId}/enroll`, {
        student_id: Number(enrollStudentId),
      });
      toast('Student enrolled and notified');
      setEnrollOpen(false);
      await Promise.all([loadCourses(), loadDetail()]);
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setEnrolling(false);
    }
  }

  function openGrade(student) {
    setGradeTarget(student);
    setGradeForm({ assignment: '', term: 'Midterm', score: '', max_score: 100 });
    setGradeError('');
  }

  async function submitGrade(event) {
    event.preventDefault();
    setSavingGrade(true);
    setGradeError('');
    try {
      await api.post('/grades', {
        student_id: gradeTarget.student_id,
        course_id: Number(selectedId),
        assignment: gradeForm.assignment,
        term: gradeForm.term,
        score: Number(gradeForm.score),
        max_score: Number(gradeForm.max_score),
      });
      toast('Grade recorded and student notified');
      setGradeTarget(null);
      await Promise.all([loadCourses(), loadDetail()]);
    } catch (requestError) {
      setGradeError(requestError.message);
    } finally {
      setSavingGrade(false);
    }
  }

  async function handleDeleteCourse() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/courses/${deleteTarget.id}`);
      toast('Course removed');
      setDeleteTarget(null);
      setDetail(null);
      setSelectedId('');
      await loadCourses();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleUnenroll() {
    if (!unenrollTarget) return;
    setUnenrolling(true);
    try {
      await api.delete(`/courses/${selectedId}/students/${unenrollTarget.student_id}`);
      toast('Student removed from course');
      setUnenrollTarget(null);
      await Promise.all([loadCourses(), loadDetail()]);
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setUnenrolling(false);
    }
  }

  const rosterIds = new Set((detail?.roster || []).map((row) => row.student_id));
  const availableStudents = students.filter((student) => !rosterIds.has(student.id));

  if (loading) return <Loading label="Loading courses..." />;

  return (
    <div className="page">
      <PageHeader
        title="LMS Courses"
        subtitle="Manage the course catalog, class rosters, and grade records."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreateCourse}>
            <PlusIcon size={17} />
            New course
          </button>
        }
      />

      {error && <div className="form-error inline">{error}</div>}

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookIcon size={26} />}
          title="No courses yet"
          message="Create your first course to begin managing enrollments and grades."
          action={
            <button type="button" className="btn btn-primary" onClick={openCreateCourse}>
              <PlusIcon size={17} />
              New course
            </button>
          }
        />
      ) : (
        <div className="course-grid">
          {courses.map((course) => (
            <div
              key={course.id}
              className={`course-card ${String(course.id) === selectedId ? 'selected' : ''}`}
              onClick={() => setSelectedId(String(course.id))}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === 'Enter' && setSelectedId(String(course.id))}
            >
              <div className="course-card-top">
                <span className="code-pill">{course.code}</span>
                <div className="course-card-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Edit course"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditCourse(course);
                    }}
                  >
                    <EditIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label="Delete course"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(course);
                    }}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
              <h3>{course.title}</h3>
              <p>{course.instructor || 'Instructor not assigned'}</p>
              <div className="course-card-meta">
                <span>
                  <CalendarIcon size={14} />
                  {course.schedule || 'Schedule TBA'}
                </span>
                <span>{course.room || 'Room TBA'}</span>
              </div>
              <div className="course-card-stats">
                <div>
                  <strong>{course.enrolled_count}</strong>
                  <span>Enrolled</span>
                </div>
                <div>
                  <strong>{course.avg_grade != null ? percent(course.avg_grade, 1) : 'N/A'}</strong>
                  <span>Avg. grade</span>
                </div>
                <div>
                  <strong>{course.units}</strong>
                  <span>Units</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedId && (
        <section className="card course-detail">
          {detailLoading || !detail ? (
            <Loading label="Loading course details..." />
          ) : (
            <>
              <div className="course-detail-head">
                <div>
                  <div className="course-detail-title">
                    <span className="code-pill">{detail.course.code}</span>
                    <h2>{detail.course.title}</h2>
                  </div>
                  <p className="card-sub">
                    {detail.course.instructor || 'Instructor not assigned'} &middot;{' '}
                    {detail.course.schedule || 'Schedule TBA'} &middot;{' '}
                    {detail.course.room || 'Room TBA'} &middot; {detail.course.semester}
                  </p>
                </div>
                <div className="page-actions">
                  <button type="button" className="btn btn-ghost" onClick={openEnroll}>
                    <UsersIcon size={16} />
                    Enroll student
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openGrade(detail.roster[0])}
                    disabled={!detail.roster.length}
                  >
                    <PlusIcon size={16} />
                    Add grade
                  </button>
                </div>
              </div>

              <div className="section-heading">
                <h3>Class roster</h3>
                <p>{detail.roster.length} student(s) enrolled</p>
              </div>

              {detail.roster.length === 0 ? (
                <EmptyState
                  icon={<UsersIcon size={24} />}
                  title="No students enrolled"
                  message="Enroll a student to start tracking attendance and grades."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Program</th>
                        <th>Status</th>
                        <th>Attendance</th>
                        <th className="text-right">Average</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.roster.map((row) => (
                        <tr key={row.enrollment_id}>
                          <td>
                            <div className="stacked-cell">
                              <strong>{row.name}</strong>
                              <span>{row.student_no}</span>
                            </div>
                          </td>
                          <td>
                            <div className="stacked-cell">
                              <strong>{row.program}</strong>
                              <span>Year {row.year_level}</span>
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={row.status} />
                          </td>
                          <td>{row.attendance_rate != null ? percent(row.attendance_rate, 1) : 'N/A'}</td>
                          <td className="text-right">
                            <span className={`grade-pill text-${gradeTone(row.avg_grade)}`}>
                              {row.avg_grade != null ? percent(row.avg_grade, 1) : 'N/A'}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => openGrade(row)}
                              >
                                Add grade
                              </button>
                              <button
                                type="button"
                                className="icon-btn danger"
                                aria-label="Remove from course"
                                onClick={() => setUnenrollTarget(row)}
                              >
                                <TrashIcon size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="section-heading">
                <h3>Recent grades</h3>
                <p>Latest scores recorded for this course</p>
              </div>
              {detail.recent_grades.length === 0 ? (
                <EmptyState title="No grades yet" message="Add a grade from the roster above." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Assessment</th>
                        <th>Term</th>
                        <th className="text-right">Score</th>
                        <th className="text-right">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.recent_grades.map((grade) => (
                        <tr key={grade.id}>
                          <td>{grade.student_name}</td>
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
            </>
          )}
        </section>
      )}

      <Modal
        open={Boolean(courseModal)}
        onClose={() => setCourseModal(null)}
        title={courseModal?.mode === 'edit' ? 'Edit course' : 'New course'}
        subtitle="Course details appear in the LMS catalog and student schedules."
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setCourseModal(null)}>
              Cancel
            </button>
            <button type="submit" form="course-form" className="btn btn-primary" disabled={savingCourse}>
              {savingCourse ? 'Saving...' : courseModal?.mode === 'edit' ? 'Save changes' : 'Create course'}
            </button>
          </>
        }
      >
        <form id="course-form" onSubmit={saveCourse}>
          {courseError && <div className="form-error">{courseError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>Course code</span>
              <input
                value={courseForm.code}
                onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })}
                placeholder="IT101"
                required
              />
            </label>
            <label className="field">
              <span>Units</span>
              <input
                type="number"
                min="1"
                max="6"
                value={courseForm.units}
                onChange={(event) => setCourseForm({ ...courseForm, units: event.target.value })}
              />
            </label>
            <label className="field field-full">
              <span>Course title</span>
              <input
                value={courseForm.title}
                onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Instructor</span>
              <input
                value={courseForm.instructor}
                onChange={(event) => setCourseForm({ ...courseForm, instructor: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Program</span>
              <select
                value={courseForm.program}
                onChange={(event) => setCourseForm({ ...courseForm, program: event.target.value })}
              >
                {COURSE_PROGRAMS.map((program) => (
                  <option value={program} key={program}>
                    {program}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Schedule</span>
              <input
                value={courseForm.schedule}
                onChange={(event) => setCourseForm({ ...courseForm, schedule: event.target.value })}
                placeholder="MWF 8:00 - 9:00 AM"
              />
            </label>
            <label className="field">
              <span>Room</span>
              <input
                value={courseForm.room}
                onChange={(event) => setCourseForm({ ...courseForm, room: event.target.value })}
                placeholder="IT-201"
              />
            </label>
            <label className="field field-full">
              <span>Semester</span>
              <input
                value={courseForm.semester}
                onChange={(event) => setCourseForm({ ...courseForm, semester: event.target.value })}
              />
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title="Enroll student"
        subtitle={`Add a student to ${detail?.course?.code || 'this course'}.`}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEnrollOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="enroll-form" className="btn btn-primary" disabled={enrolling}>
              {enrolling ? 'Enrolling...' : 'Enroll student'}
            </button>
          </>
        }
      >
        <form id="enroll-form" onSubmit={submitEnroll}>
          {availableStudents.length === 0 ? (
            <EmptyState
              title="No available students"
              message="Every student is already enrolled in this course."
            />
          ) : (
            <label className="field">
              <span>Student</span>
              <select
                value={enrollStudentId}
                onChange={(event) => setEnrollStudentId(event.target.value)}
                required
              >
                <option value="">Select a student</option>
                {availableStudents.map((student) => (
                  <option value={student.id} key={student.id}>
                    {student.full_name} ({student.student_no})
                  </option>
                ))}
              </select>
            </label>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(gradeTarget)}
        onClose={() => setGradeTarget(null)}
        title="Add grade"
        subtitle={
          gradeTarget
            ? `${gradeTarget.name} \u00B7 ${detail?.course?.code} - ${detail?.course?.title}`
            : ''
        }
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setGradeTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="grade-form" className="btn btn-primary" disabled={savingGrade}>
              {savingGrade ? 'Saving...' : 'Record grade'}
            </button>
          </>
        }
      >
        <form id="grade-form" onSubmit={submitGrade}>
          {gradeError && <div className="form-error">{gradeError}</div>}
          <div className="form-grid">
            <label className="field field-full">
              <span>Assessment</span>
              <input
                value={gradeForm.assignment}
                onChange={(event) => setGradeForm({ ...gradeForm, assignment: event.target.value })}
                placeholder="Midterm Exam"
                required
              />
            </label>
            <label className="field">
              <span>Term</span>
              <select
                value={gradeForm.term}
                onChange={(event) => setGradeForm({ ...gradeForm, term: event.target.value })}
              >
                <option value="Prelim">Prelim</option>
                <option value="Midterm">Midterm</option>
                <option value="Finals">Finals</option>
              </select>
            </label>
            <label className="field">
              <span>Score</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={gradeForm.score}
                onChange={(event) => setGradeForm({ ...gradeForm, score: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Maximum score</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={gradeForm.max_score}
                onChange={(event) => setGradeForm({ ...gradeForm, max_score: event.target.value })}
              />
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete course"
        subtitle="This removes the course, its enrollments, attendance records, and grades."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDeleteCourse} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete course'}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <p className="confirm-text">
            Delete <strong>{deleteTarget.code} - {deleteTarget.title}</strong>? This cannot be
            undone.
          </p>
        )}
      </Modal>

      <Modal
        open={Boolean(unenrollTarget)}
        onClose={() => setUnenrollTarget(null)}
        title="Remove from course"
        subtitle="The student's attendance and grades for this course will also be removed."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setUnenrollTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleUnenroll} disabled={unenrolling}>
              {unenrolling ? 'Removing...' : 'Remove student'}
            </button>
          </>
        }
      >
        {unenrollTarget && (
          <p className="confirm-text">
            Remove <strong>{unenrollTarget.name}</strong> from {detail?.course?.code}?
          </p>
        )}
      </Modal>
    </div>
  );
}

function StudentCourses() {
  const [courses, setCourses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [courseResponse, gradeResponse] = await Promise.all([
        api.get('/courses'),
        api.get('/grades/me'),
      ]);
      setCourses(courseResponse.courses);
      setGrades(gradeResponse.grades);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const gradesByCourse = useMemo(() => {
    return grades.reduce((accumulator, grade) => {
      if (!accumulator[grade.course_id]) accumulator[grade.course_id] = [];
      accumulator[grade.course_id].push(grade);
      return accumulator;
    }, {});
  }, [grades]);

  const totalScore = grades.reduce((accumulator, grade) => accumulator + Number(grade.score), 0);
  const totalMax = grades.reduce((accumulator, grade) => accumulator + Number(grade.max_score), 0);
  const overallGrade = totalMax ? (totalScore / totalMax) * 100 : 0;
  const avgAttendance = courses.length
    ? courses.reduce((accumulator, course) => accumulator + Number(course.attendance_rate || 0), 0) /
      courses.length
    : 0;
  const totalUnits = courses.reduce((accumulator, course) => accumulator + Number(course.units || 0), 0);

  if (loading) return <Loading label="Loading your courses..." />;
  if (error) {
    return (
      <EmptyState
        title="Could not load your courses"
        message={error}
        action={
          <button type="button" className="btn btn-primary" onClick={load}>
            Try again
          </button>
        }
      />
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="My Courses"
        subtitle="Your enrolled subjects, attendance standing, and posted grades."
      />

      <div className="stat-grid">
        <StatCard
          icon={<BookIcon size={22} />}
          label="Enrolled courses"
          value={courses.length}
          hint={`${totalUnits} total units`}
          tone="indigo"
        />
        <StatCard
          icon={<TrendUpIcon size={22} />}
          label="Overall grade"
          value={percent(overallGrade, 1)}
          hint={`${grades.length} graded assessments`}
          tone="sky"
        />
        <StatCard
          icon={<CalendarIcon size={22} />}
          label="Average attendance"
          value={percent(avgAttendance, 1)}
          hint="Across all subjects"
          tone="emerald"
        />
        <StatCard
          icon={<UsersIcon size={22} />}
          label="Learning mode"
          value="On campus"
          hint="First Semester 2026"
          tone="amber"
        />
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookIcon size={26} />}
          title="No enrolled courses"
          message="Your courses will appear once enrollment is completed."
        />
      ) : (
        <div className="course-grid student-course-grid">
          {courses.map((course) => {
            const courseGrades = gradesByCourse[course.id] || [];
            return (
              <section className="course-card student-course" key={course.id}>
                <div className="course-card-top">
                  <span className="code-pill">{course.code}</span>
                  <Badge tone={course.status === 'pending' ? 'warning' : 'success'}>
                    {course.status === 'pending' ? 'Pending payment' : 'Active'}
                  </Badge>
                </div>
                <h3>{course.title}</h3>
                <p>{course.instructor}</p>
                <div className="course-card-meta">
                  <span>
                    <CalendarIcon size={14} />
                    {course.schedule || 'Schedule TBA'}
                  </span>
                  <span>{course.room || 'Room TBA'}</span>
                </div>

                <div className="student-course-metrics">
                  <div>
                    <span>Attendance</span>
                    <Progress
                      value={course.attendance_rate}
                      tone={Number(course.attendance_rate) >= 85 ? 'emerald' : 'amber'}
                    />
                    <strong>{course.attendance_rate != null ? percent(course.attendance_rate, 1) : 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Average</span>
                    <strong className={`big-grade text-${gradeTone(course.avg_grade)}`}>
                      {course.avg_grade != null ? percent(course.avg_grade, 1) : 'N/A'}
                    </strong>
                  </div>
                </div>

                <details className="course-grades">
                  <summary>
                    Grade items <span>{courseGrades.length}</span>
                  </summary>
                  {courseGrades.length === 0 ? (
                    <p className="helper">No grades have been posted for this course yet.</p>
                  ) : (
                    <div className="grade-list">
                      {courseGrades.map((grade) => (
                        <div className="grade-item" key={grade.id}>
                          <div>
                            <strong>{grade.assignment}</strong>
                            <span>{grade.term}</span>
                          </div>
                          <div className="grade-item-score">
                            <strong>
                              {Number(grade.score)}/{Number(grade.max_score)}
                            </strong>
                            <span className={`text-${gradeTone((grade.score / grade.max_score) * 100)}`}>
                              {percent((grade.score / grade.max_score) * 100, 1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Courses() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminCourses /> : <StudentCourses />;
}
