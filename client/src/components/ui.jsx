import { useEffect } from 'react';
import { CloseIcon } from './Icons.jsx';
import { percent, statusTone } from '../lib/api.js';

/**
 * Neutral profile placeholder.
 *
 * Renders a person silhouette rather than initials, so records without a photo
 * never fake a name badge. The `name` prop is still accepted by call sites but
 * is not drawn.
 */
export function Avatar({ name, size = 40, className = '' }) {
  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={name ? `${name} has no profile photo` : 'No profile photo'}
      title={name ? `${name} has no profile photo` : 'No profile photo'}
    >
      <svg
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="8.2" r="3.7" fill="currentColor" />
        <path
          d="M4.2 20.1c.5-3.9 3.6-6.5 7.8-6.5s7.3 2.6 7.8 6.5c.1.6-.4 1.1-1 1.1H5.2c-.6 0-1.1-.5-1-1.1Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export function Badge({ children, tone = 'neutral', dot = false }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  if (!status) return <Badge tone="neutral">Unknown</Badge>;
  const label = String(status)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
  return (
    <Badge tone={statusTone(status)} dot>
      {label}
    </Badge>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon, label, value, hint, tone = 'indigo' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`}>{icon}</div>
      <div className="stat-body">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint && <p className="stat-hint">{hint}</p>}
      </div>
    </div>
  );
}

export function Progress({ value, tone = 'indigo', label }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-wrap">
      {label && (
        <div className="progress-caption">
          <span>{label}</span>
          <span>{percent(width, 1)}</span>
        </div>
      )}
      <div className="progress">
        <div className={`progress-bar tone-${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <InboxIconFallback />}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading...' }) {
  return (
    <div className="loading">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('modal-open');
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function InboxIconFallback() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 12h5l2 3h4l2-3h5" />
      <path d="M5 4h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
    </svg>
  );
}
