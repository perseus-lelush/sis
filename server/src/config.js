import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'sis-dev-secret-change-me',
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
