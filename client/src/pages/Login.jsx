import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  BookIcon,
  CalendarIcon,
  CapIcon,
  LayersIcon,
  WalletIcon,
} from '../components/Icons.jsx';
import Logo from '../components/Logo.jsx';

const MODULES = [
  { label: 'Student Records', icon: CapIcon },
  { label: 'Enrollment & Scheduling', icon: CalendarIcon },
  { label: 'Library Loans', icon: BookIcon },
  { label: 'Payment and Billing', icon: WalletIcon },
  { label: 'Secure Integration APIs', icon: LayersIcon },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const year = new Date().getFullYear();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(demoEmail, demoPassword) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  }

  return (
    <div className="login-shell">
      <section className="login-hero">
        <div className="login-hero-top">
          <div className="login-logo">
            <Logo size={34} />
          </div>
          <div>
            <strong>SIS</strong>
            <span>Student Information System</span>
          </div>
        </div>

        <div className="login-copy">
          <span className="eyebrow light">Unified campus records platform</span>
          <h1>One connected record for the whole student journey.</h1>
          <p>
            Student records, enrollment, attendance, library loans, billing, and
            notifications work from a shared relational database and secure APIs -
            so campus offices stop re-entering the same information.
          </p>
          <div className="module-chips">
            {MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <span className="module-chip" key={module.label}>
                  <Icon size={16} />
                  {module.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="login-hero-foot">
          <div>
            <strong>13</strong>
            <span>relational tables</span>
          </div>
          <div>
            <strong>3</strong>
            <span>role-based workspaces</span>
          </div>
          <div>
            <strong>1</strong>
            <span>unified source of truth</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-heading">
            <span className="eyebrow">Welcome back</span>
            <h2>Sign in to SIS</h2>
            <p>Use your institutional account to continue to the portal.</p>
          </div>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@school.edu"
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="demo-accounts">
            <p>Demo accounts - click to autofill</p>
            <div className="demo-grid">
              <button
                type="button"
                className="demo-btn"
                onClick={() => fillDemo('admin@school.edu', 'admin123')}
              >
                <span className="demo-role">Administrator</span>
                <span className="demo-email">admin@school.edu</span>
                <span className="demo-password">admin123</span>
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => fillDemo('librarian@school.edu', 'library123')}
              >
                <span className="demo-role">Librarian</span>
                <span className="demo-email">librarian@school.edu</span>
                <span className="demo-password">library123</span>
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => fillDemo('maria.santos@student.edu', 'student123')}
              >
                <span className="demo-role">Student</span>
                <span className="demo-email">maria.santos@student.edu</span>
                <span className="demo-password">student123</span>
              </button>
            </div>
          </div>
        </div>
        <p className="login-foot">
          &copy; {year} SIS &middot; Student Information System
        </p>
      </section>
    </div>
  );
}
