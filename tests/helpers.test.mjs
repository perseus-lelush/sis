import test from 'node:test';
import assert from 'node:assert/strict';

import { parseId, parseISODate, required, HttpError } from '../server/src/utils/http.js';
import { addDaysISO, toISODate, todayISO } from '../server/src/utils/dates.js';
import {
  formatCompactMoney,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMonth,
  gradeTone,
  percent,
  statusTone,
  timeAgo,
} from '../client/src/lib/api.js';
import { MIN_DESKTOP_WIDTH, inspectDevice } from '../client/src/lib/device.js';

test('parseId accepts positive integers and rejects everything else', () => {
  assert.equal(parseId(7), 7);
  assert.equal(parseId('12'), 12);

  for (const value of [0, -1, 1.5, 'abc', '', null, undefined, '1e3']) {
    assert.throws(() => parseId(value), HttpError, `expected ${String(value)} to be rejected`);
    try {
      parseId(value);
    } catch (error) {
      assert.equal(error.status, 400);
    }
  }
});

test('parseISODate rejects impossible calendar dates', () => {
  assert.equal(parseISODate('2026-02-28'), '2026-02-28');
  assert.equal(parseISODate('2024-02-29'), '2024-02-29');

  for (const value of ['2026-02-31', '2026-13-01', '2026-00-10', '27-10-2026', '2026-1-1', '', null]) {
    assert.throws(() => parseISODate(value), HttpError, `expected ${String(value)} to be rejected`);
  }
});

test('required rejects blank values', () => {
  assert.equal(required('value', 'Field'), 'value');
  assert.throws(() => required('   ', 'Field'), /Field is required/);
  assert.throws(() => required(undefined, 'Field'), /Field is required/);
});

test('date helpers use the local calendar day', () => {
  assert.equal(toISODate(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(todayISO(), toISODate(new Date()));
  assert.match(addDaysISO(14), /^\d{4}-\d{2}-\d{2}$/);
});

test('money formatters use the peso sign and two decimals', () => {
  assert.equal(formatMoney(18000), '\u20B118,000.00');
  assert.equal(formatMoney(0), '\u20B10.00');
  assert.equal(formatMoney(undefined), '\u20B10.00');
  assert.equal(formatCompactMoney(12500.4), '\u20B112,500');
});

test('date formatters return a readable fallback instead of an em dash', () => {
  assert.equal(formatDate(''), 'N/A');
  assert.equal(formatDateTime(null), 'N/A');
  assert.equal(formatDate('2024-03-12'), 'Mar 12, 2024');
  assert.equal(formatDate('not a date'), 'not a date');
  assert.equal(formatMonth('2026-03'), 'Mar');
  assert.equal(formatMonth('broken'), 'broken');
});

test('percent clamps formatting to the requested precision', () => {
  assert.equal(percent(81.25, 1), '81.3%');
  assert.equal(percent(0), '0%');
  assert.equal(percent(undefined), '0%');
});

test('status and grade tones map to the design tokens', () => {
  assert.equal(statusTone('Paid'), 'success');
  assert.equal(statusTone('pending'), 'warning');
  assert.equal(statusTone('overdue'), 'danger');
  assert.equal(statusTone('excused'), 'info');
  assert.equal(statusTone('nonsense'), 'neutral');

  assert.equal(gradeTone(95), 'success');
  assert.equal(gradeTone(85), 'info');
  assert.equal(gradeTone(75), 'warning');
  assert.equal(gradeTone(60), 'danger');
  assert.equal(gradeTone(null), 'danger');
});

test('timeAgo describes recent timestamps', () => {
  const now = Date.now();
  const stamp = (millisecondsAgo) => {
    const date = new Date(now - millisecondsAgo);
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  assert.equal(timeAgo(''), '');
  assert.equal(timeAgo(stamp(10 * 1000)), 'Just now');
  assert.equal(timeAgo(stamp(5 * 60 * 1000)), '5m ago');
  assert.equal(timeAgo(stamp(3 * 60 * 60 * 1000)), '3h ago');
  assert.equal(timeAgo(stamp(2 * 24 * 60 * 60 * 1000)), '2d ago');
});

test('device gate blocks phone, tablet and touch-only browsers regardless of window size', () => {
  const desktop = { width: 1440, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36', touchOnly: false };
  assert.deepEqual(inspectDevice(desktop), { blocked: false, reasons: [] });

  const androidPhone = { ...desktop, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) Chrome/126 Mobile Safari/537.36' };
  assert.deepEqual(inspectDevice(androidPhone), { blocked: true, reasons: ['device'] });

  const androidTablet = { ...desktop, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-T970) Tablet Chrome/126 Safari/537.36' };
  assert.deepEqual(inspectDevice(androidTablet), { blocked: true, reasons: ['device'] });

  // iPads without the "Request Desktop Site" swap show an iPad UA; touch-only
  // hardware is caught even when it claims to be a Macintosh desktop.
  assert.equal(inspectDevice({ ...desktop, userAgent: 'Mozilla/5.0 (iPad) Safari/17' }).blocked, true);
  assert.deepEqual(inspectDevice({ ...desktop, touchOnly: true }), { blocked: true, reasons: ['touch'] });
});

test('device gate enforces the desktop viewport minimum and reports every reason', () => {
  const win = { width: 1440, userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/126', touchOnly: false };

  assert.equal(inspectDevice({ ...win, width: MIN_DESKTOP_WIDTH }).blocked, false);
  assert.deepEqual(inspectDevice({ ...win, width: MIN_DESKTOP_WIDTH - 1 }), {
    blocked: true,
    reasons: ['viewport'],
  });

  const everyReason = inspectDevice({ width: 412, userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile', touchOnly: true });
  assert.deepEqual(everyReason, { blocked: true, reasons: ['device', 'touch', 'viewport'] });

  // Missing or malformed inputs never silently allow access.
  assert.deepEqual(inspectDevice({}), { blocked: true, reasons: ['unknown'] });
});
