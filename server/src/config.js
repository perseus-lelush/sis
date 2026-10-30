import 'dotenv/config';

const defaultJwtSecret = 'sis-dev-secret-change-me';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === defaultJwtSecret)) {
  throw new Error('JWT_SECRET must be set to a strong, unique value when NODE_ENV=production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
}

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || defaultJwtSecret,
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
