const TOKEN_KEY = 'sis_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401 && getToken()) {
    setToken(null);
    window.dispatchEvent(new Event('sis:unauthorized'));
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export function formatMoney(value) {
  return `\u20B1${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactMoney(value) {
  return `\u20B1${Number(value || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  })}`;
}

function parseDateValue(value) {
  const text = String(value);
  // Date-only values are stored as YYYY-MM-DD. Parse them in local time so a
  // date such as 2004-03-12 never renders as the previous day in UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(text.replace(' ', 'T'));
}

export function formatDate(value) {
  if (!value) return 'N/A';
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatMonth(key) {
  const [year, month] = String(key).split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

export function timeAgo(value) {
  if (!value) return '';
  const date = parseDateValue(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(value);
}

export function percent(value, digits = 0) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

export function gradeTone(value) {
  const grade = Number(value || 0);
  if (grade >= 90) return 'success';
  if (grade >= 80) return 'info';
  if (grade >= 70) return 'warning';
  return 'danger';
}

export function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (['paid', 'active', 'present', 'enrolled', 'completed', 'returned'].includes(value)) {
    return 'success';
  }
  if (['unpaid', 'pending', 'partial', 'late', 'borrowed'].includes(value)) return 'warning';
  if (['overdue', 'absent', 'inactive', 'dropped'].includes(value)) return 'danger';
  if (['excused', 'graduated'].includes(value)) return 'info';
  return 'neutral';
}
