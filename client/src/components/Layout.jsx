import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Avatar } from './ui.jsx';
import Logo from './Logo.jsx';
import {
  BellIcon,
  BookIcon,
  CalendarIcon,
  ChartIcon,
  ClipboardIcon,
  DashboardIcon,
  InfoIcon,
  LayersIcon,
  LogoutIcon,
  MenuIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from './Icons.jsx';

const PROJECT_NAV = [
  { to: '/integration', label: 'Integration', icon: LayersIcon, group: 'Project' },
  { to: '/about', label: 'About SIS', icon: InfoIcon, group: 'Project' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, group: 'Project' },
];

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/students', label: 'Students', icon: UsersIcon },
  { to: '/enrollment', label: 'Enrollment', icon: ClipboardIcon },
  { to: '/courses', label: 'Courses', icon: BookIcon },
  { to: '/attendance', label: 'Attendance', icon: CalendarIcon },
  { to: '/library', label: 'Library Loans', icon: BookIcon },
  { to: '/billing', label: 'Billing', icon: WalletIcon },
  { to: '/reports', label: 'Reports', icon: ChartIcon },
  { to: '/notifications', label: 'Notifications', icon: BellIcon },
  ...PROJECT_NAV,
];

const STUDENT_NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/profile', label: 'My Profile', icon: UserIcon },
  { to: '/courses', label: 'My Courses', icon: BookIcon },
  { to: '/attendance', label: 'My Attendance', icon: CalendarIcon },
  { to: '/library', label: 'My Library', icon: BookIcon },
  { to: '/billing', label: 'My Billing', icon: WalletIcon },
  { to: '/notifications', label: 'Notifications', icon: BellIcon },
  ...PROJECT_NAV,
];

const LIBRARIAN_NAV = [
  { to: '/library', label: 'Library Loans', icon: BookIcon },
  { to: '/notifications', label: 'Notifications', icon: BellIcon },
  ...PROJECT_NAV,
];

const ROLE_LABELS = {
  admin: 'Administrator',
  librarian: 'Librarian',
  student: 'Student',
};

function roleLabel(role) {
  return ROLE_LABELS[role] || 'User';
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const navItems =
    user?.role === 'admin'
      ? ADMIN_NAV
      : user?.role === 'librarian'
        ? LIBRARIAN_NAV
        : STUDENT_NAV;

  const current =
    navItems.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
    ) || navItems[0];

  const title =
    location.pathname.startsWith('/students/') && location.pathname !== '/students'
      ? 'Student Profile'
      : current.label;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await api.get('/notifications/unread-count');
        if (active) setUnread(data.unread);
      } catch {
        /* ignore */
      }
    };

    load();
    const interval = window.setInterval(load, 60000);
    window.addEventListener('sis:notifications', load);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('sis:notifications', load);
    };
  }, [location.pathname]);

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Logo size={30} />
          </div>
          <div className="brand-text">
            <strong>SIS</strong>
            <span>Student Information System</span>
          </div>
        </div>

        <nav className="nav">
          {['Workspace', 'Project'].map((group) => {
            const items = navItems.filter((item) => (item.group || 'Workspace') === group);
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group}>
                <p className="nav-label">{group}</p>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="nav-icon">
                        <Icon size={19} />
                      </span>
                      <span>{item.label}</span>
                      {item.to === '/notifications' && unread > 0 && (
                        <span className="nav-count">{unread}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <Avatar name={user?.name} size={38} />
            <div className="user-meta">
              <strong>{user?.name}</strong>
              <span>{roleLabel(user?.role)}</span>
            </div>
            <button type="button" className="logout-btn" onClick={logout} title="Sign out">
              <LogoutIcon size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon size={20} />
            </button>
            <div className="topbar-title">
              <span>SIS Portal</span>
              <strong>{title}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <Link to="/notifications" className="icon-btn notification-btn" aria-label="Notifications">
              <BellIcon size={20} />
              {unread > 0 && <span className="notification-dot">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <span className="topbar-divider" />
            <div className="topbar-user">
              <Avatar name={user?.name} size={34} />
              <div>
                <strong>{user?.name}</strong>
                <span>{roleLabel(user?.role)}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
