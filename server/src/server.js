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
import { healthProfileRouter } from './routes/health-profile.routes.js';
import { healthMetricsRouter } from './routes/health-metrics.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { chatsRouter } from './routes/chats.routes.js';
import { recordsRouter } from './routes/records.routes.js';
import { medicationsRouter } from './routes/medications.routes.js';
import { visitsRouter } from './routes/visits.routes.js';
import { usageRouter } from './routes/usage.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { appRouter } from './routes/app.routes.js';
import { cycleRouter, partnerShareClosedHandler } from './routes/cycle.routes.js';
import { applyPrivateCache } from './lib/cycleShare.js';
import { pushRouter } from './routes/push.routes.js';
import { pharmacyRouter } from './routes/pharmacy.routes.js';
import { checkInRouter } from './routes/check-in.routes.js';
import { PRIVACY_HTML, TERMS_HTML } from './lib/legalPages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

/** Resolve admin UI from several cwd layouts (local, Render, npm --prefix). */
function resolveAdminDist() {
  const candidates = [
    path.resolve(__dirname, '../admin'),
    path.resolve(process.cwd(), 'server/admin'),
    path.resolve(process.cwd(), 'admin'),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

function resolvePublicDist() {
  const candidates = [
    path.resolve(__dirname, '../public'),
    path.resolve(process.cwd(), 'server/public'),
    path.resolve(process.cwd(), 'public'),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

const ADMIN_DIST = resolveAdminDist();
const PUBLIC_DIST = resolvePublicDist();
const serveAdmin = Boolean(ADMIN_DIST);
const serveLanding = Boolean(PUBLIC_DIST);

app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy:
      serveLanding || serveAdmin
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", 'https:', 'wss:'],
              fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
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
app.use(
  morgan((tokens, req, res) => {
    let url = tokens.url(req, res) || '';
    if (url.startsWith('/api/cycle/share')) url = '/api/cycle/share/[redacted]';
    return [
      tokens.method(req, res),
      url,
      tokens.status(req, res),
      tokens.res(req, res, 'content-length'),
      '-',
      tokens['response-time'](req, res),
      'ms',
    ].join(' ');
  }),
);

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

app.use(
  '/api/cycle/share',
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ ერთ წუთს.' },
  }),
  (req, res, next) => {
    applyPrivateCache(res);
    next();
  },
);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/privacy', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('html').send(PRIVACY_HTML);
});

app.get('/terms', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('html').send(TERMS_HTML);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'medicard-ge',
    time: new Date().toISOString(),
    engines: { evidencemd: true, vision: hasVisionProvider },
    admin: serveAdmin,
    landing: serveLanding,
  });
});

app.use(enforceAppAvailability);

app.use('/api/auth', authRouter);
app.use('/api/health-profile', healthProfileRouter);
app.use('/api/health-metrics', healthMetricsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/visits', visitsRouter);
app.use('/api/cycle', cycleRouter);
app.get('/api/cycle/share/:code', partnerShareClosedHandler);
app.use('/api/usage', usageRouter);
app.use('/api/push', pushRouter);
app.use('/api/pharmacy', pharmacyRouter);
app.use('/api/check-in', checkInRouter);
app.use('/api/app', appRouter);
app.use('/api/admin', adminRouter);

if (serveAdmin) {
  // Must be registered before the marketing-site fallback, otherwise /admin becomes the landing page.
  app.use(
    '/admin',
    express.static(ADMIN_DIST, {
      index: false,
      maxAge: 0,
      etag: false,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'no-store');
      },
    }),
  );
  app.get(['/admin', '/admin/', '/admin/index.html'], (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(ADMIN_DIST, 'index.html'));
  });
} else {
  console.warn('[medicard] Admin UI not found — /admin will not be available.');
}

if (serveLanding) {
  app.use(
    express.static(PUBLIC_DIST, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
        else if (filePath.endsWith('.css')) res.setHeader('Cache-Control', 'public, max-age=3600');
        else res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    }),
  );
  app.use('/share', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIST, 'open-app.html'));
  });
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const p = req.path;
    if (
      p.startsWith('/api') ||
      p.startsWith('/uploads') ||
      p === '/admin' ||
      p.startsWith('/admin/') ||
      p === '/health' ||
      p === '/privacy' ||
      p === '/terms'
    ) {
      return next();
    }
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIST, 'index.html'), (err) => (err ? next(err) : undefined));
  });
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`\n  Medicard.GE API  →  http://localhost:${env.PORT}`);
  if (serveAdmin) console.log(`  admin panel     →  http://localhost:${env.PORT}/admin  (${ADMIN_DIST})`);
  else console.warn('  admin panel     →  MISSING (server/admin/index.html not found)');
  if (serveLanding) console.log(`  landing          →  ${PUBLIC_DIST}`);
  else console.warn('  landing          →  MISSING (server/public/index.html not found)');
  console.log(`  environment      →  ${env.NODE_ENV}`);
  console.log(`  free monthly limit →  ${env.FREE_MONTHLY_AI_LIMIT} AI queries (FREE package)`);
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
