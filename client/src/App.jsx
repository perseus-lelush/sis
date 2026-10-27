import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Logo from './components/Logo.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import Attendance from './pages/Attendance.jsx';
import Courses from './pages/Courses.jsx';
import Enrollment from './pages/Enrollment.jsx';
import Billing from './pages/Billing.jsx';
import Library from './pages/Library.jsx';
import Notifications from './pages/Notifications.jsx';
import Reports from './pages/Reports.jsx';
import Profile from './pages/Profile.jsx';
import Integration from './pages/Integration.jsx';
import About from './pages/About.jsx';
import Settings from './pages/Settings.jsx';

function ScreenLoader() {
  return (
    <div className="screen-loader">
      <div className="brand-mark">
        <Logo size={30} />
      </div>
      <span className="spinner" />
    </div>
  );
}

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

function AdminOnly({ children }) {
  return <RequireRole roles={['admin']}>{children}</RequireRole>;
}

function Home() {
  const { user } = useAuth();
  if (user?.role === 'librarian') return <Navigate to="/library" replace />;
  return <Dashboard />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <ScreenLoader />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Home />} />
        <Route
          path="students"
          element={
            <AdminOnly>
              <Students />
            </AdminOnly>
          }
        />
        <Route
          path="students/:id"
          element={
            <AdminOnly>
              <StudentDetail />
            </AdminOnly>
          }
        />
        <Route
          path="attendance"
          element={
            <RequireRole roles={['admin', 'student']}>
              <Attendance />
            </RequireRole>
          }
        />
        <Route
          path="enrollment"
          element={
            <AdminOnly>
              <Enrollment />
            </AdminOnly>
          }
        />
        <Route
          path="courses"
          element={
            <RequireRole roles={['admin', 'student']}>
              <Courses />
            </RequireRole>
          }
        />
        <Route path="library" element={<Library />} />
        <Route
          path="billing"
          element={
            <RequireRole roles={['admin', 'student']}>
              <Billing />
            </RequireRole>
          }
        />
        <Route path="notifications" element={<Notifications />} />
        <Route path="integration" element={<Integration />} />
        <Route path="about" element={<About />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="reports"
          element={
            <AdminOnly>
              <Reports />
            </AdminOnly>
          }
        />
        <Route
          path="profile"
          element={
            <RequireRole roles={['admin', 'student']}>
              <Profile />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
