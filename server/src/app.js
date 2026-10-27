import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { auditTrail } from './middleware/audit.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import studentRoutes from './routes/students.js';
import enrollmentRoutes from './routes/enrollments.js';
import attendanceRoutes from './routes/attendance.js';
import courseRoutes from './routes/courses.js';
import gradeRoutes from './routes/grades.js';
import billingRoutes from './routes/billing.js';
import libraryRoutes from './routes/library.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(auditTrail);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    existsSync(path.join(clientDist, 'index.html'))
  ) {
    return res.sendFile(path.join(clientDist, 'index.html'));
  }
  return next();
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) {
    console.error('[api]', error);
  }
  return res.status(status).json({
    error: status >= 500 ? 'Something went wrong on the server' : error.message,
  });
});

export default app;
