import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, formatDateTime, timeAgo } from '../lib/api.js';
import { NOTIFICATION_FILTERS } from '../lib/constants.js';
import { EmptyState, Loading, Modal, PageHeader } from '../components/ui.jsx';
import NotificationIcon from '../components/NotificationIcon.jsx';
import { BellIcon, CheckIcon, SendIcon } from '../components/Icons.jsx';

const CHANNEL_LABELS = {
  in_app: 'In-app',
  email: 'Email',
  sms: 'SMS',
};

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);

  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceForm, setAnnounceForm] = useState({
    title: '',
    message: '',
    audience: 'students',
    email: true,
    sms: true,
  });
  const [announceError, setAnnounceError] = useState('');
  const [sending, setSending] = useState(false);

  async function load(activeFilter = filter) {
    setLoading(true);
    setError('');
    try {
      const query =
        activeFilter === 'all'
          ? ''
          : activeFilter === 'unread'
            ? '?unread=true'
            : `?type=${activeFilter}`;
      const response = await api.get(`/notifications${query}`);
      setNotifications(response.notifications);
      setUnread(response.unread);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  useEffect(() => {
    if (searchParams.get('announce') === '1' && user?.role === 'admin') {
      openAnnounce();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  function notifyLayout() {
    window.dispatchEvent(new Event('sis:notifications'));
  }

  async function markRead(notification) {
    if (notification.is_read) return;
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: 1 } : item,
        ),
      );
      setUnread((current) => Math.max(0, current - 1));
      notifyLayout();
    } catch (requestError) {
      toast(requestError.message, 'error');
    }
  }

  async function markAllRead() {
    setMarking(true);
    try {
      await api.post('/notifications/read-all');
      if (filter === 'unread') setNotifications([]);
      else setNotifications((current) => current.map((item) => ({ ...item, is_read: 1 })));
      setUnread(0);
      toast('All notifications marked as read');
      notifyLayout();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setMarking(false);
    }
  }

  function openAnnounce() {
    setAnnounceForm({
      title: '',
      message: '',
      audience: 'students',
      email: true,
      sms: true,
    });
    setAnnounceError('');
    setAnnounceOpen(true);
  }

  async function sendAnnouncement(event) {
    event.preventDefault();
    setSending(true);
    setAnnounceError('');
    try {
      const channels = [];
      if (announceForm.email) channels.push('email');
      if (announceForm.sms) channels.push('sms');
      const response = await api.post('/notifications/announce', {
        title: announceForm.title,
        message: announceForm.message,
        audience: announceForm.audience,
        channels,
      });
      toast(response.message);
      setAnnounceOpen(false);
      await load(filter);
    } catch (requestError) {
      setAnnounceError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        subtitle={
          user?.role === 'admin'
            ? 'Send campus announcements and review alerts delivered to your account.'
            : 'Announcements, grade updates, attendance alerts, and payment reminders.'
        }
        actions={
          <>
            {unread > 0 && (
              <button type="button" className="btn btn-ghost" onClick={markAllRead} disabled={marking}>
                <CheckIcon size={16} />
                {marking ? 'Updating...' : 'Mark all read'}
              </button>
            )}
            {user?.role === 'admin' && (
              <button type="button" className="btn btn-primary" onClick={openAnnounce}>
                <SendIcon size={16} />
                Send announcement
              </button>
            )}
          </>
        }
      />

      <div className="card notif-card">
        <div className="table-toolbar">
          <div className="filter-tabs">
            {NOTIFICATION_FILTERS.map((item) => (
              <button
                type="button"
                key={item.value}
                className={`filter-tab ${filter === item.value ? 'active' : ''}`}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                {item.value === 'unread' && unread > 0 && (
                  <span className="tab-count">{unread}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="form-error inline">{error}</div>}

        {loading ? (
          <Loading label="Loading notifications..." />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<BellIcon size={26} />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            message={
              filter === 'unread'
                ? 'You are all caught up.'
                : 'Notifications will appear here when there is an update.'
            }
          />
        ) : (
          <div className="notif-list">
            {notifications.map((notification) => (
              <button
                type="button"
                className={`notif-item ${notification.is_read ? '' : 'unread'}`}
                key={notification.id}
                onClick={() => markRead(notification)}
              >
                <NotificationIcon type={notification.type} size={19} />
                <div className="notif-content">
                  <div className="notif-title-row">
                    <strong>{notification.title}</strong>
                    <span className="notif-time">{timeAgo(notification.created_at)}</span>
                  </div>
                  <p>{notification.message}</p>
                  <div className="notif-meta">
                    <span className="notif-date">{formatDateTime(notification.created_at)}</span>
                    {String(notification.channel)
                      .split(',')
                      .filter(Boolean)
                      .map((channel) => (
                        <span className="channel-chip" key={channel}>
                          {CHANNEL_LABELS[channel] || channel}
                        </span>
                      ))}
                  </div>
                </div>
                {!notification.is_read && <span className="unread-dot" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={announceOpen}
        onClose={() => setAnnounceOpen(false)}
        title="Send announcement"
        subtitle="Deliver a message to student or admin accounts."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAnnounceOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="announce-form" className="btn btn-primary" disabled={sending}>
              {sending ? 'Sending...' : 'Send announcement'}
            </button>
          </>
        }
      >
        <form id="announce-form" onSubmit={sendAnnouncement}>
          {announceError && <div className="form-error">{announceError}</div>}
          <div className="form-grid">
            <label className="field field-full">
              <span>Title</span>
              <input
                value={announceForm.title}
                onChange={(event) =>
                  setAnnounceForm({ ...announceForm, title: event.target.value })
                }
                placeholder="Enrollment deadline reminder"
                required
              />
            </label>
            <label className="field field-full">
              <span>Message</span>
              <textarea
                rows="4"
                value={announceForm.message}
                onChange={(event) =>
                  setAnnounceForm({ ...announceForm, message: event.target.value })
                }
                placeholder="Write the announcement..."
                required
              />
            </label>
            <label className="field field-full">
              <span>Audience</span>
              <select
                value={announceForm.audience}
                onChange={(event) =>
                  setAnnounceForm({ ...announceForm, audience: event.target.value })
                }
              >
                <option value="students">All students</option>
                <option value="admins">Administrators only</option>
                <option value="all">Everyone</option>
              </select>
            </label>
            <div className="field field-full">
              <span>Delivery channels</span>
              <div className="checkbox-row">
                <label className="checkbox locked">
                  <input type="checkbox" checked readOnly />
                  In-app notification
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={announceForm.email}
                    onChange={(event) =>
                      setAnnounceForm({ ...announceForm, email: event.target.checked })
                    }
                  />
                  Email
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={announceForm.sms}
                    onChange={(event) =>
                      setAnnounceForm({ ...announceForm, sms: event.target.checked })
                    }
                  />
                  SMS
                </label>
              </div>
              <small>Email and SMS delivery is simulated in this environment.</small>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
