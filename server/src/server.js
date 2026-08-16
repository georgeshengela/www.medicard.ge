import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env, hasVisionProvider } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { UPLOAD_DIR } from './lib/storage.js';
import { shutdownOcr } from './lib/ocr.js';
import { errorHandler, notFound } from './middleware/error.js';
import { enforceAppAvailability } from './middleware/auth.js';
import { authRouter } from './routes/auth.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { chatsRouter } from './routes/chats.routes.js';
import { recordsRouter } from './routes/records.routes.js';
import { medicationsRouter } from './routes/medications.routes.js';
import { usageRouter } from './routes/usage.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { appRouter } from './routes/app.routes.js';
import { cycleRouter, partnerShareHandler } from './routes/cycle.routes.js';
import { asyncHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const WEB_DIST = path.resolve(__dirname, '../../mobile/dist');
const ADMIN_DIST = path.resolve(__dirname, '../admin');
const serveWeb = env.NODE_ENV === 'production' && existsSync(path.join(WEB_DIST, 'index.html'));
const serveAdmin = existsSync(path.join(ADMIN_DIST, 'index.html'));

app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy:
      serveWeb || serveAdmin
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", 'https:', 'wss:'],
              fontSrc: ["'self'", 'data:'],
              mediaSrc: ["'self'", 'blob:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
            },
          }
        : undefined,
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use(
  '/api/',
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ ერთ წუთს.' },
  }),
);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'medicard-ge',
    time: new Date().toISOString(),
    engines: { evidencemd: true, vision: hasVisionProvider },
  });
});

app.use(enforceAppAvailability);

app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/cycle', cycleRouter);
app.get('/api/cycle/share/:code', asyncHandler(partnerShareHandler));
app.use('/api/usage', usageRouter);
app.use('/api/app', appRouter);
app.use('/api/admin', adminRouter);

if (serveAdmin) {
  app.use('/admin', express.static(ADMIN_DIST, { index: false, maxAge: 0, etag: false }));
  app.get(['/admin', '/admin/'], (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(ADMIN_DIST, 'index.html'));
  });
}

if (serveWeb) {
  app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const p = req.path;
    if (
      p.startsWith('/api') ||
      p.startsWith('/uploads') ||
      p.startsWith('/admin') ||
      p === '/health'
    ) {
      return next();
    }
    res.sendFile(path.join(WEB_DIST, 'index.html'), (err) => (err ? next(err) : undefined));
  });
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`\n  Medicard.GE API  →  http://localhost:${env.PORT}`);
  if (serveAdmin) console.log(`  admin panel     →  http://localhost:${env.PORT}/admin`);
  if (serveWeb) console.log(`  web app          →  ${WEB_DIST}`);
  console.log(`  environment      →  ${env.NODE_ENV}`);
  console.log(`  free daily limit →  ${env.FREE_DAILY_AI_LIMIT} (FREE package default)`);
  if (!hasVisionProvider) {
    console.warn('  ⚠️  no OPENROUTER_API_KEY — image modules fall back to local OCR\n');
  } else {
    console.log(`  ✓ vision via OpenRouter (${env.OPENROUTER_MODEL || 'fallback'})\n`);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`\n[medicard] ${signal} received, shutting down…`);
    server.close();
    await Promise.allSettled([prisma.$disconnect(), shutdownOcr()]);
    process.exit(0);
  });
}

export default app;
