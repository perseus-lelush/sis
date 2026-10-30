import 'dotenv/config';

// Vercel reserves the "JWT_" prefix for project env vars, so prefer
// SIS_JWT_SECRET there. Both names are accepted for self-hosting.
const jwtSecret = process.env.SIS_JWT_SECRET || process.env.JWT_SECRET;
const defaultJwtSecret = 'sis-dev-secret-change-me';

if (process.env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret === defaultJwtSecret)) {
  throw new Error('SIS_JWT_SECRET (or JWT_SECRET) must be set to a strong, unique value when NODE_ENV=production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
}

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: jwtSecret || defaultJwtSecret,
  dbMode: process.env.DB_MODE || 'embedded',
  autoInit: process.env.DB_AUTO_INIT !== 'false',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'sis_db',
  },
};
