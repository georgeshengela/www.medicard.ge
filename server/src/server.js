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
import { requireFeature } from './lib/featureFlags.js';
import { adminManageRouter } from './routes/adminManage.routes.js';
import {
  apiTrafficKey,
  attachRateLimitHandler,
  authWriteKey,
  isAuthWriteRequest,
  RATE_LIMIT_VALIDATE,
} from './lib/rateLimitKey.js';
import { USER_CEILING_PER_MIN, isCeilingExempt, loopNotifier } from './lib/loopGuard.js';
import { denyLegacyPublicUploads } from './lib/privateUploads.js';
import { shutdownOcr } from './lib/ocr.js';
import { errorHandler, notFound, isHiddenPath } from './middleware/error.js';
import { enforceAppAvailability } from './middleware/auth.js';
import { nutritionRouter, adminNutritionRouter } from './routes/nutrition.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { communityRouter, adminCommunityRouter } from './routes/community.routes.js';
import { startCommunityPush } from './lib/communityPush.js';
import { startPriceDropAlerts } from './lib/priceDrop.js';
import { startReferralRewards } from './lib/referral.js';
import { startPushCampaignWorker } from './lib/pushCampaigns.js';
import { objectStorageConfigured, objectStoragePublicHint } from './lib/objectStorage.js';
import { adminReferralRouter, referralRouter } from './routes/referral.routes.js';
import { adminTrainerRouter, trainerRouter } from './routes/trainer.routes.js';
import { identityRouter } from './routes/identity.routes.js';
import { startTrainerReminders } from './lib/trainerPush.js';
import { adminFunnelRouter, funnelRouter } from './routes/funnel.routes.js';
import { adminCapacityRouter } from './routes/capacity.routes.js';
import { adminErrorsRouter } from './routes/errors.routes.js';
import { adminSocialRouter } from './routes/social.routes.js';
import { errorMonitorEnabled, recordFatalError, startErrorPurge, stopErrorPurge } from './lib/errorMonitor.js';
import { langMiddleware, t } from './lib/i18n.js';
import { capacityMiddleware, startCapacityMonitor, stopCapacityMonitor } from './lib/capacity.js';
import { adminDirectorRouter, directorRouter } from './routes/director.routes.js';
import { startDirectorWorkers } from './lib/director/supportAgent.js';
import { adminEmailRouter, emailWebhookRouter, unsubscribeRouter } from './routes/email.routes.js';
import { contactRouter } from './routes/contact.routes.js';
import { startEmailWorkers } from './lib/email/campaigns.js';
import { adminSupportRouter } from './routes/support.routes.js';
import { startSupportWorkers } from './lib/support/inbound.js';
import { healthProfileRouter } from './routes/health-profile.routes.js';
import { healthMetricsRouter } from './routes/health-metrics.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { assistantRouter } from './routes/assistant.routes.js';
import { chatsRouter } from './routes/chats.routes.js';
import { recordsRouter } from './routes/records.routes.js';
import { medicationsRouter } from './routes/medications.routes.js';
import { visitsRouter } from './routes/visits.routes.js';
import { petsRouter } from './routes/pets.routes.js';
import { usageRouter } from './routes/usage.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { adminRewardsRouter } from './routes/adminRewards.routes.js';
import { medipulsiRouter } from './routes/medipulsi.routes.js';
import { adminMedipulsiRouter } from './routes/adminMedipulsi.routes.js';
import { adminQaRouter } from './routes/adminQa.routes.js';
import { appRouter } from './routes/app.routes.js';
import { aiConsentRouter } from './routes/ai-consent.routes.js';
import { accountRouter } from './routes/account.routes.js';
import { cycleRouter, partnerShareClosedHandler } from './routes/cycle.routes.js';
import { applyPrivateCache } from './lib/cycleShare.js';
import { pushRouter } from './routes/push.routes.js';
import { pharmacyRouter } from './routes/pharmacy.routes.js';
import { checkInRouter } from './routes/check-in.routes.js';
import { locationRouter } from './routes/location.routes.js';
import { questsRouter } from './routes/quests.routes.js';
import { achievementsRouter } from './routes/achievements.routes.js';
import { rewardsRouter } from './routes/rewards.routes.js';
import { mediCompanionRouter } from './routes/mediCompanion.routes.js';
import { announcementsRouter, adminAnnouncementsRouter } from './routes/announcements.routes.js';
import { filesRouter } from './routes/files.routes.js';
import { PRIVACY_HTML, TERMS_HTML } from './lib/legalPages.js';
import { attachAdminRealtime } from './lib/adminRealtime.js';
import { startQuotaResetSweeper, stopQuotaResetSweeper } from './lib/usageNotify.js';
import { startPharmacySyncScheduler, stopPharmacySyncScheduler } from './lib/pharmacy/scheduler.js';
import { startMedirunAutopilot } from './lib/medipulsi/autopilot.js';

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
app.use(capacityMiddleware);
// req.lang ('ka' | 'en') from X-Medicard-Lang — errors, AI text and pushes follow it.
app.use(langMiddleware);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy:
      serveLanding || serveAdmin
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://api.mapbox.com'],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://api.mapbox.com'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", 'https:', 'ws:', 'wss:'],
              fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
              mediaSrc: ["'self'", 'blob:'],
              workerSrc: ["'self'", 'blob:'],
              childSrc: ["'self'", 'blob:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
            },
          }
        : undefined,
  }),
);
app.use(cors({ origin: true, credentials: true }));
// Resend webhook needs the raw body for its Svix signature, so it is mounted before express.json.
app.use('/api/email', emailWebhookRouter);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan((tokens, req, res) => {
    let url = tokens.url(req, res) || '';
    if (url.startsWith('/api/cycle/share')) url = '/api/cycle/share/[redacted]';
    if (url.startsWith('/api/files/')) url = '/api/files/[redacted]';
    if (url.startsWith('/uploads/')) url = '/uploads/[redacted]';
    url = url.replace(/([?&])(lat|lng|latitude|longitude|accuracy|coords|continuationToken|token|t)=[^&]*/gi, '$1$2=[redacted]');
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

// Do not request-count all of /api. A 120/min (or 20/min register) bucket
// 429s real onboarding: Expo retries, GET /auth/me, assessment, home.
// Auth writes (register/login/OTP/password) are IP-limited; GET /me is skipped.

app.use(
  '/api/cycle/share',
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: RATE_LIMIT_VALIDATE,
    handler: attachRateLimitHandler('cycle-share'),
  }),
  (req, res, next) => {
    applyPrivateCache(res);
    next();
  },
);

app.use('/uploads', denyLegacyPublicUploads);

// Legal pages: Georgian (prevails) + English translation; ?lang=en|ka picks the matching page.
const legalLang = (req) => String(req.query.lang || '').slice(0, 2).toLowerCase();

app.get('/privacy', (req, res) => {
  if (legalLang(req) === 'en') return res.redirect(302, '/privacy-en?lang=en');
  res.set('Cache-Control', 'public, max-age=3600');
  if (PUBLIC_DIST) return res.sendFile(path.join(PUBLIC_DIST, 'privacy.html'));
  res.type('html').send(PRIVACY_HTML);
});

app.get('/terms', (req, res) => {
  if (legalLang(req) === 'en') return res.redirect(302, '/terms-en?lang=en');
  res.set('Cache-Control', 'public, max-age=3600');
  if (PUBLIC_DIST) return res.sendFile(path.join(PUBLIC_DIST, 'terms.html'));
  res.type('html').send(TERMS_HTML);
});

for (const [route, file, ka] of [['/privacy-en', 'privacy-en.html', '/privacy'], ['/terms-en', 'terms-en.html', '/terms']]) {
  app.get([route, `${route}/`], (req, res) => {
    if (legalLang(req) === 'ka') return res.redirect(302, `${ka}?lang=ka`);
    if (!PUBLIC_DIST) return res.redirect(302, ka);
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(PUBLIC_DIST, file));
  });
}

// Google Play account-deletion page (bilingual ka/en). Public, no auth.
app.get(['/delete-account', '/delete-account/', '/en/delete-account'], (_req, res, next) => {
  if (!PUBLIC_DIST) return next();
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(PUBLIC_DIST, 'delete-account.html'));
});

// Public site pages with clean URLs.
for (const [route, file] of [['/about', 'about.html'], ['/contact', 'contact.html']]) {
  app.get([route, `${route}/`], (_req, res, next) => {
    if (!PUBLIC_DIST) return next();
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIST, file));
  });
}

// One-click marketing unsubscribe (email links + RFC 8058 POST). Public, no auth.
app.use(unsubscribeRouter);

app.get(['/calculators', '/calculators/'], (req, res, next) => {
  if (!PUBLIC_DIST) return next();
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(PUBLIC_DIST, 'calculators', 'index.html'));
});

app.get('/calculators/:slug', (req, res, next) => {
  if (!PUBLIC_DIST) return next();
  const slug = String(req.params.slug || '');
  if (!/^[a-z0-9-]+$/.test(slug)) return next();
  const file = path.join(PUBLIC_DIST, 'calculators', `${slug}.html`);
  if (!existsSync(file)) return next();
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(file);
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

// Loop guard: a per-session ceiling, not the old per-IP /api bucket above. Guests are never counted,
// and USER_CEILING_PER_MIN is ~10× the busiest real session, so only a runaway loop reaches it
// (the 2026-09-29 health-sync loop sent 3 354/min from one phone). See lib/loopGuard.js.
const userCeilingHandler = attachRateLimitHandler('user-ceiling');
const userCeilingLimiter = rateLimit({
  windowMs: 60_000,
  limit: USER_CEILING_PER_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: RATE_LIMIT_VALIDATE,
  keyGenerator: apiTrafficKey,
  skip: isCeilingExempt,
  handler: (req, res, next, options) => {
    if (req.rateLimit?.used === USER_CEILING_PER_MIN + 1) loopNotifier.ceilingHit(req);
    return userCeilingHandler(req, res, next, options);
  },
});
app.use('/api', userCeilingLimiter);
// After the ceiling, so a refused loop never reaches the settings lookup.
app.use(enforceAppAvailability);

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'production' ? 80 : 400,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: RATE_LIMIT_VALIDATE,
  keyGenerator: authWriteKey,
  skip: (req) => !isAuthWriteRequest(req),
  handler: attachRateLimitHandler('auth-write'),
});

app.use('/api/auth', authWriteLimiter, authRouter);
app.use('/api/health-profile', healthProfileRouter);
app.use('/api/account', accountRouter);
app.use('/api/health-metrics', healthMetricsRouter);
app.use('/api/ai', requireFeature('medi', { match: (req) => req.path !== '/feedback' }), aiRouter);
app.use('/api/assistant', requireFeature('medi'), assistantRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/files', filesRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/visits', visitsRouter);
app.use('/api/pets', requireFeature('pets'), requireFeature('mediVet', { match: (req) => /\/chat\/query$/.test(req.path) }), petsRouter);
app.use('/api/nutrition', requireFeature('nutrition'), requireFeature('nutritionAi', { match: (req) => req.path === '/estimate' || req.path === '/quick-log' }), nutritionRouter);
app.use('/api/admin/nutrition', adminNutritionRouter);
app.use('/api/community', requireFeature('community'), communityRouter);
app.use('/api/admin/community', adminCommunityRouter);
startCommunityPush();
startPriceDropAlerts();
startReferralRewards();
startTrainerReminders();
startPushCampaignWorker();
startEmailWorkers();
startSupportWorkers();
startDirectorWorkers();
app.use('/api/medipulsi', requireFeature('medirun'), medipulsiRouter);
app.use('/api/cycle', requireFeature('cycle'), cycleRouter);
app.get('/api/cycle/share/:code', partnerShareClosedHandler);
app.use('/api/usage', usageRouter);
app.use('/api/push', pushRouter);
app.use('/api/pharmacy', requireFeature('pharmacy'), pharmacyRouter);
app.use('/api/check-in', checkInRouter);
app.use('/api/location', locationRouter);
app.use('/api/quests', requireFeature('quest'), questsRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/rewards', requireFeature('rewardsStore', { match: (req) => /\/redeem$/.test(req.path) }), rewardsRouter);
app.use('/api/referrals', referralRouter);
app.use('/api/trainer', requireFeature('coach'), trainerRouter);
app.use('/api/admin/trainers', adminTrainerRouter);
app.use('/api/identity', identityRouter);
app.use('/api/admin/referrals', adminReferralRouter);
app.use('/api/funnel', funnelRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin/funnel', adminFunnelRouter);
app.use('/api/admin/capacity', adminCapacityRouter);
app.use('/api/admin/errors', adminErrorsRouter);
app.use('/api/admin/social', adminSocialRouter);
app.use('/api/admin/announcements', adminAnnouncementsRouter);
app.use('/api/admin/email', adminEmailRouter);
app.use('/api/admin/support', adminSupportRouter);
app.use('/api/medi-companion', requireFeature('quest'), mediCompanionRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/app', appRouter);
app.use('/api/ai-consent', aiConsentRouter);
app.use('/api/admin/director', adminDirectorRouter);
app.use('/api/director', directorRouter);
app.use('/api/admin/manage', adminManageRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/rewards', adminRewardsRouter);
app.use('/api/admin/medipulsi', adminMedipulsiRouter);
app.use('/api/admin/qa', adminQaRouter);

// The MEDIRUN web page is hidden for now (owner, 2026-09-29): browsers go to the front page.
// The app's MEDIRUN is native (/run) and does not load this page. MEDIPULSI_WEB=on shows it again.
app.get(['/medipulsi', '/medipulsi/', '/medipulsi/index.html'], (req,res) => {
  if (process.env.MEDIPULSI_WEB !== 'on') return res.redirect(302, '/');
  const file=path.resolve(__dirname,'../public/medipulsi/index.html');
  res.set('Cache-Control','no-store');
  if(!existsSync(file))return res.status(503).send(t(req, 'MEDIPULSI მზადდება.', 'MEDIRUN is getting ready.'));
  return res.sendFile(file);
});

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
        // Web app modules import each other without version stamps: revalidate every load.
        else if (/[\\/]app[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
        else if (filePath.endsWith('.css')) res.setHeader('Cache-Control', 'public, max-age=3600');
        else if (/\.(woff2|woff|ttf|otf)$/i.test(filePath)) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    }),
  );
  // Signed-in web app (vanilla ES modules, history routing under /app).
  app.get(['/app', /^\/app\/(?!.*\.[a-z0-9]+$).*/i], (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIST, 'app', 'index.html'));
  });
  app.get('/i/:code', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIST, 'invite.html'));
  });
  app.get('/u/:token', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIST, 'personal-qr.html'));
  });
  app.get('/c/:code', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(PUBLIC_DIST, 'coach.html'));
  });
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
      p === '/terms' ||
      p === '/delete-account' ||
      p === '/unsubscribe' ||
      p === '/calculators' ||
      p.startsWith('/calculators/')
    ) {
      return next();
    }
    // Scanners probe /.git/index, /.env…: a plain 404 at once, not the 30 KB home page with 200.
    if (isHiddenPath(p)) return res.status(404).type('text/plain').send('Not found');
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
  console.log('  consumer access   →  free, no paid tiers or commercial quotas');
  if (objectStorageConfigured()) console.log(`  uploads          →  object storage (${objectStoragePublicHint().provider})`);
  else if (env.NODE_ENV === 'production') console.warn('  ⚠️  uploads → local disk (ephemeral on Render: pet/record photos are lost on deploy). Set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.');
  if (!hasVisionProvider) {
    console.warn('  ⚠️  no OPENROUTER_API_KEY — image modules fall back to local OCR\n');
  } else {
    console.log(`  ✓ vision via OpenRouter (${env.OPENROUTER_MODEL || 'fallback'})\n`);
  }
});
attachAdminRealtime(server);
startQuotaResetSweeper();
if (env.NODE_ENV === 'production') startPharmacySyncScheduler();
// „გაანათე თბილისი“ gift autopilot (owner OK 2026-10-01). Pause: admin მოდულები → MEDIRUN ავტოპილოტი; MEDIRUN_AUTOPILOT=off stops it here.
if (env.NODE_ENV === 'production' && process.env.MEDIRUN_AUTOPILOT !== 'off') startMedirunAutopilot();
// Production only: local servers point at the main DB and must not write samples or alert the owner.
if (env.NODE_ENV === 'production' && process.env.CAPACITY_MONITOR !== 'off') startCapacityMonitor();
// Error monitoring retention (30 days, daily under a lease); recording itself is production-only too.
if (errorMonitorEnabled()) startErrorPurge();

// Fatal process errors: log, record (lib/errorMonitor.js) and still exit with code 1 as Node would
// by default — the only change is up to 2 s to flush the ErrorEvent row before exiting.
let fatalExiting = false;
for (const origin of ['uncaughtException', 'unhandledRejection']) {
  process.on(origin, (error) => {
    console.error(`[medicard] ${origin}:`, error);
    if (fatalExiting) return;
    fatalExiting = true;
    void Promise.resolve(recordFatalError(error, origin)).finally(() => process.exit(1));
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`\n[medicard] ${signal} received, shutting down…`);
    stopQuotaResetSweeper();
    stopPharmacySyncScheduler();
    stopCapacityMonitor();
    stopErrorPurge();
    // Render sends SIGTERM on every deploy while the new instance takes traffic. Let in-flight
    // requests (a Medi answer takes 20–40 s) finish before the database goes away; Render
    // allows 30 s before SIGKILL.
    const drained = new Promise((resolve) => server.close(resolve));
    server.closeIdleConnections?.();
    await Promise.race([drained, new Promise((resolve) => setTimeout(resolve, 27_000))]);
    await Promise.allSettled([prisma.$disconnect(), shutdownOcr()]);
    process.exit(0);
  });
}

export default app;
