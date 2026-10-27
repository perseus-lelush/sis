export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function required(value, name) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new HttpError(400, `${name} is required`);
  }
  return value;
}

/**
 * Parse a route or query identifier. Non-numeric values must be rejected with
 * a 400 instead of reaching MySQL, where they surface as an opaque 500.
 */
export function parseId(value, name = 'id') {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return id;
}

/**
 * Validate a real calendar date in YYYY-MM-DD form. The regex alone accepts
 * impossible dates such as 2026-02-31, which MySQL rejects at insert time.
 */
export function parseISODate(value, name = 'date') {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  return text;
}
