import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import { requireVerifiedPhone } from '../lib/phoneGate.js';
import { calculateAge, MIN_USER_AGE } from '../lib/patient.js';
import { saveUpload } from '../lib/storage.js';
import { servePrivateUpload, unlinkStoredUpload } from '../lib/privateUploads.js';
import { groupByBrand, gymsByIds, listGyms, proposeGym, gymPublic } from '../lib/gyms.js';
import {
  CONSENT_VERSION,
  MEAL_SLOTS,
  SESSION_KINDS,
  SPECIALTIES,
  TRAINER_STATUS_KA,
  applySchema,
  cancelSchema,
  certificateMetaSchema,
  coachError,
  completeSchema,
  goalProposalSchema,
  linkSchema,
  mealPlanSchema,
  photoMetaSchema,
  proposeGymSchema,
  scopesSchema,
  sessionPatchSchema,
  sessionSchema,
  tbilisiDayStart,
  tbilisiYmd,
  workoutSyncSchema,
} from '../lib/trainer.js';
import * as store from '../lib/trainerStore.js';
import { prisma } from '../lib/prisma.js';
import { notifyCoach } from '../lib/trainerPush.js';
import { parseQrToken } from '../lib/identity.js';

/**
 * MEDI COACH (2026-09-28): gyms, trainer applications, consented client links, sessions, meal plans,
 * progress photos and Health workouts. `/coach/*` is the verified trainer's workspace. docs/TRAINER.md
 */
export const trainerRouter = Router();
trainerRouter.use(requireAuth);
trainerRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'ძალიან ბევრი მოთხოვნა. სცადე ცოტა ხანში.', code: 'RATE_LIMITED' },
});
trainerRouter.use((req, res, next) => (req.method === 'GET' ? next() : writeLimiter(req, res, next)));

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_TYPES.has(String(file.mimetype || '').toLowerCase())) {
      cb(Object.assign(new Error('ატვირთე JPEG, PNG ან WEBP ფოტო.'), { status: 400 }));
      return;
    }
    cb(null, true);
  },
});

/** Re-encode to JPEG: strips EXIF/GPS, fixes orientation, bounds the size. */
async function cleanPhoto(file, maxEdge) {
  if (!file?.buffer?.length) throw coachError(400, 'ფოტო არ არის მიმაგრებული.');
  try {
    return await sharp(file.buffer, { limitInputPixels: 60_000_000, failOn: 'error' })
      .rotate()
      .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
  } catch {
    throw coachError(400, 'ფოტო ვერ დამუშავდა. აირჩიე სხვა ფოტო (JPEG ან PNG).');
  }
}

const requireVerifiedTrainer = asyncHandler(async (req, _res, next) => {
  req.trainer = await store.requireTrainer(req.user.id, { verified: true });
  next();
});

// ——— catalogues ———

trainerRouter.get('/catalog', (_req, res) => {
  res.json({
    specialties: Object.entries(SPECIALTIES).map(([key, label]) => ({ key, label })),
    sessionKinds: Object.entries(SESSION_KINDS).map(([key, label]) => ({ key, label })),
    mealSlots: Object.entries(MEAL_SLOTS).map(([key, label]) => ({ key, label })),
    statuses: TRAINER_STATUS_KA,
    consentVersion: CONSENT_VERSION,
  });
});

trainerRouter.get('/gyms', asyncHandler(async (req, res) => {
  const rows = await listGyms({ q: String(req.query.q || '').slice(0, 60), city: String(req.query.city || '').slice(0, 40), userId: req.user.id });
  const cities = [...new Set(rows.map((g) => g.city))];
  res.json({ brands: groupByBrand(rows), cities, total: rows.length });
}));

trainerRouter.post('/gyms', requireVerifiedPhone, asyncHandler(async (req, res) => {
  const body = proposeGymSchema.parse(req.body ?? {});
  const row = await proposeGym(req.user.id, body);
  res.status(201).json({ gym: gymPublic(row) });
}));

// ——— my status (client link + own trainer profile) ———

trainerRouter.get('/me', asyncHandler(async (req, res) => {
  const [profile, link] = await Promise.all([store.getTrainerProfile(req.user.id), store.openLinkForClient(req.user.id)]);
  const gyms = profile ? await gymsByIds(profile.gymIds) : new Map();
  res.json({ trainerProfile: store.ownTrainerProfile(profile, gyms), clientLink: link ? { id: link.id, status: link.status, trainerId: link.trainerId } : null, consentVersion: CONSENT_VERSION });
}));

// ——— trainer application ———

trainerRouter.post('/apply', requireVerifiedPhone, asyncHandler(async (req, res) => {
  const age = calculateAge(req.user.birthDate);
  if (age == null) throw coachError(400, 'ტრენერის განაცხადისთვის პროფილში დაბადების თარიღი მიუთითე.', 'BIRTHDATE_REQUIRED');
  if (age < MIN_USER_AGE) throw coachError(403, 'ტრენერის პროფილი მხოლოდ 18+ წლისთვისაა.', 'AGE_RESTRICTED');
  const body = applySchema.parse(req.body ?? {});
  const row = await store.applyTrainer(req.user, body);
  res.status(201).json({ trainerProfile: store.ownTrainerProfile(row, await gymsByIds(row.gymIds)) });
}));

trainerRouter.post('/certificates', upload.single('file'), asyncHandler(async (req, res) => {
  const meta = certificateMetaSchema.parse(req.body ?? {});
  const profile = await store.getTrainerProfile(req.user.id);
  if (!profile) throw coachError(404, 'ჯერ შეავსე ტრენერის განაცხადი.');
  const key = await saveUpload(await cleanPhoto(req.file, 2200), 'image/jpeg');
  try {
    const { profile: row, certificate } = await store.addCertificate(req.user.id, meta, key);
    res.status(201).json({ certificate: { id: certificate.id, title: certificate.title, issuer: certificate.issuer, year: certificate.year }, trainerProfile: store.ownTrainerProfile(row, await gymsByIds(row.gymIds)) });
  } catch (error) {
    await unlinkStoredUpload(key);
    throw error;
  }
}));

trainerRouter.delete('/certificates/:id', asyncHandler(async (req, res) => {
  const { profile, removed } = await store.removeCertificate(req.user.id, String(req.params.id));
  await unlinkStoredUpload(removed.fileKey);
  res.json({ trainerProfile: store.ownTrainerProfile(profile, await gymsByIds(profile.gymIds)) });
}));

trainerRouter.get('/certificates/:id/file', asyncHandler(async (req, res) => {
  const profile = await store.getTrainerProfile(req.user.id);
  const cert = (profile?.certificates || []).find((c) => c.id === req.params.id);
  if (!cert) throw coachError(404, 'ფაილი ვერ მოიძებნა.');
  const filename = String(cert?.fileKey || '').split('/').pop();
  req.params.filename = filename;
  return servePrivateUpload(req, res, { findOwner: async () => (cert ? { ok: true } : null) });
}));

// ——— finding and linking a trainer (client side) ———

trainerRouter.get('/search', asyncHandler(async (req, res) => {
  res.json({ trainers: await store.searchTrainers({ q: String(req.query.q || '').slice(0, 60), gymId: String(req.query.gymId || '').slice(0, 80) }) });
}));

trainerRouter.get('/card/:id', asyncHandler(async (req, res) => {
  const [row] = await prisma.$queryRaw`SELECT * FROM "TrainerProfile" WHERE "userId" = ${String(req.params.id)} AND status = 'VERIFIED'`;
  if (!row) throw coachError(404, 'ტრენერი ვერ მოიძებნა.', 'TRAINER_NOT_FOUND');
  const [card] = await store.trainerCards([row]);
  res.json({ trainer: card, consentVersion: CONSENT_VERSION });
}));

trainerRouter.get('/code/:code', asyncHandler(async (req, res) => {
  const row = await store.trainerByCode(req.params.code);
  if (!row) throw coachError(404, 'ასეთი კოდით დადასტურებული ტრენერი ვერ მოიძებნა.', 'TRAINER_NOT_FOUND');
  const [card] = await store.trainerCards([row]);
  res.json({ trainer: card, consentVersion: CONSENT_VERSION });
}));

trainerRouter.post('/link', asyncHandler(async (req, res) => {
  const body = linkSchema.parse(req.body ?? {});
  const { link, created } = await store.createLink(req.user, body);
  res.status(created ? 201 : 200).json({ link: { id: link.id, status: link.status }, overview: await store.clientOverview(req.user) });
}));

// Client accepts a trainer's QR invitation, choosing what to share (consent).
trainerRouter.post('/link/accept', asyncHandler(async (req, res) => {
  const body = z.object({ scopes: z.record(z.string(), z.boolean()).optional(), consentVersion: z.literal(CONSENT_VERSION) }).parse(req.body ?? {});
  await store.acceptInvite(req.user, body);
  res.json(await store.clientOverview(req.user));
}));

trainerRouter.patch('/link', asyncHandler(async (req, res) => {
  const { scopes } = scopesSchema.parse(req.body ?? {});
  await store.updateScopes(req.user.id, scopes);
  res.json(await store.clientOverview(req.user));
}));

trainerRouter.delete('/link', asyncHandler(async (req, res) => {
  const link = await store.openLinkForClient(req.user.id);
  if (!link) throw coachError(404, 'ტრენერთან კავშირი არ გაქვს.');
  await store.endLink({ linkId: link.id, by: 'CLIENT', actorId: req.user.id });
  res.json({ ok: true });
}));

trainerRouter.post('/link/goal', asyncHandler(async (req, res) => {
  const { decision } = z.object({ decision: z.enum(['accepted', 'dismissed']) }).parse(req.body ?? {});
  const link = await store.openLinkForClient(req.user.id);
  if (!link?.proposedGoal) throw coachError(404, 'შემოთავაზებული მიზანი არ არის.');
  // The app saves an accepted goal through the normal weight-goal flow (appState sync); here the proposal is cleared.
  await store.clearGoalProposal(req.user.id);
  const trainer = await store.getTrainerProfile(link.trainerId);
  if (decision === 'accepted') {
    void notifyCoach(link.trainerId, { title: 'მიზანი დადასტურდა 🎯', body: `${(await store.peopleByIds([req.user.id])).get(req.user.id)?.name ?? 'კლიენტმა'} შენი შემოთავაზებული მიზანი მიიღო.`, route: `/coach/client/${req.user.id}` });
  }
  res.json({ ok: true, decision, trainerName: trainer?.displayName ?? null });
}));

trainerRouter.get('/overview', asyncHandler(async (req, res) => {
  res.json(await store.clientOverview(req.user));
}));

trainerRouter.get('/session/:id', asyncHandler(async (req, res) => {
  const s = await store.getSession(String(req.params.id));
  if (!s || s.clientId !== req.user.id) throw coachError(404, 'ვარჯიში ვერ მოიძებნა.');
  const [session] = await store.decorateSessions([s]);
  const workouts = await store.listWorkouts(req.user.id, new Date(new Date(s.startsAt).getTime() - 3600000), new Date(new Date(s.startsAt).getTime() + (s.durationMin + 60) * 60000));
  res.json({ session: { ...session, workout: store.matchWorkout(s, workouts) } });
}));

trainerRouter.post('/sessions/:id/confirm', asyncHandler(async (req, res) => {
  const [s] = await store.decorateSessions([await store.confirmSession(req.user.id, String(req.params.id))]);
  res.json({ session: s });
}));

trainerRouter.post('/sessions/:id/cancel', asyncHandler(async (req, res) => {
  const { reason } = cancelSchema.parse(req.body ?? {});
  const [s] = await store.decorateSessions([await store.cancelSession({ id: String(req.params.id), actorId: req.user.id, by: 'CLIENT', reason })]);
  res.json({ session: s });
}));

trainerRouter.post('/sessions/:id/book', asyncHandler(async (req, res) => {
  const [s] = await store.decorateSessions([await store.bookSlot(req.user.id, String(req.params.id))]);
  res.status(201).json({ session: s });
}));

trainerRouter.post('/sessions/:id/rate', asyncHandler(async (req, res) => {
  const { rating } = z.object({ rating: z.coerce.number().int().min(1).max(5) }).parse(req.body ?? {});
  const [s] = await store.decorateSessions([await store.rateSession(req.user.id, String(req.params.id), rating)]);
  res.json({ session: s });
}));

// ——— progress photos (own) ———

trainerRouter.get('/photos', asyncHandler(async (req, res) => {
  res.json({ photos: (await store.listPhotos(req.user.id)).map((p) => store.photoPublic(p)) });
}));

trainerRouter.post('/photos', upload.single('file'), asyncHandler(async (req, res) => {
  const meta = photoMetaSchema.parse(req.body ?? {});
  const key = await saveUpload(await cleanPhoto(req.file, 1600), 'image/jpeg');
  try {
    res.status(201).json({ photo: store.photoPublic(await store.addPhoto(req.user.id, meta, key)) });
  } catch (error) {
    await unlinkStoredUpload(key);
    throw error;
  }
}));

trainerRouter.delete('/photos/:id', asyncHandler(async (req, res) => {
  const row = await store.deletePhoto(req.user.id, String(req.params.id));
  await unlinkStoredUpload(row.fileKey);
  res.json({ ok: true });
}));

async function servePhoto(req, res) {
  const photo = await store.photoViewer(req.user.id, String(req.params.id));
  if (!photo) throw coachError(404, 'ფოტო ვერ მოიძებნა.');
  req.params.filename = String(photo?.fileKey || 'x').split('/').pop();
  return servePrivateUpload(req, res, { findOwner: async () => (photo ? { ok: true } : null) });
}
trainerRouter.get('/photos/:id/file', asyncHandler(servePhoto));

// ——— workouts from Apple Health / Health Connect ———

trainerRouter.post('/workouts/sync', asyncHandler(async (req, res) => {
  const { workouts } = workoutSyncSchema.parse(req.body ?? {});
  const link = await store.openLinkForClient(req.user.id);
  // Only kept while the person shares workouts with a trainer (data minimisation).
  if (!link || link.status !== 'ACTIVE' || !link.scopes?.workouts) return res.json({ saved: 0, skipped: 'not_shared' });
  res.json({ saved: await store.syncWorkouts(req.user.id, workouts) });
}));

// ——— trainer workspace ———

const coach = Router();
trainerRouter.use('/coach', coach);

coach.get('/today', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  res.json(await store.coachToday(req.user.id));
}));

coach.get('/clients', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  res.json(await store.coachClients(req.user.id));
}));

const scanLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, validate: false, message: { error: 'ძალიან ბევრი სკანირება. სცადე ცოტა ხანში.', code: 'RATE_LIMITED' } });
const tokenSchema = z.object({ token: z.string().trim().min(1).max(300), note: z.string().trim().max(300).optional().default('') });

// Trainer scanned a person's personal QR: identity preview only (no health data).
coach.post('/scan', scanLimiter, requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const { token: raw } = tokenSchema.parse(req.body ?? {});
  const token = parseQrToken(raw);
  if (!token) throw coachError(400, 'ეს MEDICARD-ის პროფილის QR კოდი არ არის.', 'QR_INVALID');
  res.json(await store.scanPreview(req.user.id, token));
}));

coach.post('/invite', scanLimiter, requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const { token: raw, note } = tokenSchema.parse(req.body ?? {});
  const token = parseQrToken(raw);
  if (!token) throw coachError(400, 'ეს MEDICARD-ის პროფილის QR კოდი არ არის.', 'QR_INVALID');
  res.status(201).json(await store.inviteByQr(req.user.id, token, note));
}));

coach.delete('/invites/:clientId', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const [link] = await prisma.$queryRaw`SELECT id FROM "TrainerLink" WHERE "trainerId" = ${req.user.id} AND "clientId" = ${String(req.params.clientId)} AND status = 'REQUESTED' AND initiator = 'TRAINER'`;
  if (!link) throw coachError(404, 'მოწვევა ვერ მოიძებნა.');
  await store.endLink({ linkId: link.id, by: 'TRAINER', actorId: req.user.id });
  res.json({ ok: true });
}));

coach.post('/requests/:linkId', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const { accept } = z.object({ accept: z.boolean() }).parse(req.body ?? {});
  const link = await store.answerRequest(req.user.id, String(req.params.linkId), accept);
  res.json({ link: { id: link.id, status: link.status } });
}));

coach.get('/clients/:clientId', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  res.json(await store.coachClientDashboard(req.user.id, String(req.params.clientId)));
}));

coach.delete('/clients/:clientId', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const link = await store.requireClientAccess(req.user.id, String(req.params.clientId));
  await store.endLink({ linkId: link.id, by: 'TRAINER', actorId: req.user.id });
  res.json({ ok: true });
}));

coach.post('/clients/:clientId/goal', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const goal = goalProposalSchema.parse(req.body ?? {});
  res.status(201).json({ proposedGoal: await store.proposeGoal(req.user.id, String(req.params.clientId), goal) });
}));

coach.post('/clients/:clientId/plan', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const body = mealPlanSchema.parse(req.body ?? {});
  res.status(201).json({ plan: store.mealPlanPublic(await store.createMealPlan(req.user.id, String(req.params.clientId), body)) });
}));

coach.get('/sessions', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : tbilisiDayStart(tbilisiYmd());
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 7 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to - from > 62 * 86400000 || to <= from) throw coachError(400, 'არასწორი პერიოდი.');
  const rows = await store.listSessions({ trainerId: req.user.id, from, to });
  res.json({ sessions: await store.decorateSessions(rows), gyms: (await gymsByIds(req.trainer.gymIds)).size ? [...(await gymsByIds(req.trainer.gymIds)).values()].map(gymPublic) : [] });
}));

coach.post('/sessions', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const body = sessionSchema.parse(req.body ?? {});
  const rows = await store.createSessions(req.user.id, body);
  res.status(201).json({ sessions: await store.decorateSessions(rows) });
}));

coach.get('/sessions/:id', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const s = await store.getSession(String(req.params.id));
  if (!s || s.trainerId !== req.user.id) throw coachError(404, 'ვარჯიში ვერ მოიძებნა.');
  const [session] = await store.decorateSessions([s]);
  let workout = null;
  if (s.clientId) {
    const link = await store.activeLink(req.user.id, s.clientId);
    if (link?.scopes?.workouts) {
      const around = await store.listWorkouts(s.clientId, new Date(new Date(s.startsAt).getTime() - 3600000), new Date(new Date(s.startsAt).getTime() + (s.durationMin + 60) * 60000));
      workout = store.matchWorkout(s, around);
    }
  }
  res.json({ session: { ...session, workout } });
}));

coach.patch('/sessions/:id', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const patch = sessionPatchSchema.parse(req.body ?? {});
  const [s] = await store.decorateSessions([await store.patchSession(req.user.id, String(req.params.id), patch)]);
  res.json({ session: s });
}));

coach.post('/sessions/:id/cancel', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const { reason } = cancelSchema.parse(req.body ?? {});
  const [s] = await store.decorateSessions([await store.cancelSession({ id: String(req.params.id), actorId: req.user.id, by: 'TRAINER', reason })]);
  res.json({ session: s });
}));

coach.post('/sessions/:id/complete', requireVerifiedTrainer, asyncHandler(async (req, res) => {
  const body = completeSchema.parse(req.body ?? {});
  const [s] = await store.decorateSessions([await store.completeSession(req.user.id, String(req.params.id), body)]);
  res.json({ session: s });
}));

coach.get('/photos/:id/file', requireVerifiedTrainer, asyncHandler(servePhoto));

// ——— admin ———

export const adminTrainerRouter = Router();
adminTrainerRouter.use(requireAdmin);
adminTrainerRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const view = requireAdminCapability('TRAINER_VIEW');
const manage = requireAdminCapability('TRAINER_MANAGE');

adminTrainerRouter.get('/', view, asyncHandler(async (req, res) => {
  const status = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'ALL'].includes(String(req.query.status)) ? String(req.query.status) : 'PENDING';
  res.json(await store.adminTrainerList({ status }));
}));

adminTrainerRouter.post('/:userId/review', manage, asyncHandler(async (req, res) => {
  const { action, note } = z.object({ action: z.enum(['approve', 'reject', 'suspend', 'restore']), note: z.string().trim().max(500).optional().default('') }).parse(req.body ?? {});
  if (action === 'reject' && !note) throw coachError(400, 'უარის მიზეზი მიუთითე — ტრენერი მას ნახავს.');
  const before = await store.getTrainerProfile(String(req.params.userId));
  const row = await store.adminReviewTrainer({ userId: String(req.params.userId), action, note, admin: req.admin });
  await writeAdminAudit({ admin: req.admin, action: `TRAINER_${action.toUpperCase()}`, targetType: 'TrainerProfile', targetId: row.userId, previousValue: { status: before?.status }, newValue: { status: row.status, note } });
  res.json({ ok: true, status: row.status });
}));

adminTrainerRouter.get('/certificates/:filename', view, asyncHandler(async (req, res) => {
  const filename = String(req.params.filename);
  const [hit] = await prisma.$queryRaw`SELECT 1 AS ok FROM "TrainerProfile" WHERE certificates::text LIKE ${`%/uploads/${filename}%`} LIMIT 1`;
  const shim = { user: { id: `admin:${req.admin.id}` }, params: { filename } };
  return servePrivateUpload(shim, res, { findOwner: async () => (hit ? { ok: true } : null) });
}));

adminTrainerRouter.get('/gyms', view, asyncHandler(async (req, res) => {
  const status = ['ACTIVE', 'HIDDEN', 'PROPOSED', 'ALL'].includes(String(req.query.status)) ? String(req.query.status) : 'ALL';
  res.json({ gyms: await store.adminGyms({ status }) });
}));

const gymBody = z.object({
  brand: z.string().trim().min(2).max(80),
  brandKa: z.string().trim().max(80).optional(),
  name: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(40),
  district: z.string().trim().max(60).optional(),
  address: z.string().trim().max(160).optional(),
});

adminTrainerRouter.post('/gyms', manage, asyncHandler(async (req, res) => {
  const row = await store.adminAddGym(gymBody.parse(req.body ?? {}));
  await writeAdminAudit({ admin: req.admin, action: 'GYM_ADD', targetType: 'Gym', targetId: row.id, newValue: { brand: row.brand, name: row.name, city: row.city } });
  res.status(201).json({ gym: row });
}));

adminTrainerRouter.patch('/gyms/:id', manage, asyncHandler(async (req, res) => {
  const patch = gymBody.partial().extend({ status: z.enum(['ACTIVE', 'HIDDEN', 'PROPOSED']).optional() }).parse(req.body ?? {});
  const row = await store.adminSetGym(String(req.params.id), patch);
  await writeAdminAudit({ admin: req.admin, action: 'GYM_UPDATE', targetType: 'Gym', targetId: row.id, newValue: patch });
  res.json({ gym: row });
}));
