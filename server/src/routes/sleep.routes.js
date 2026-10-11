import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { t } from '../lib/i18n.js';
import { clientTimezoneFromReq } from '../lib/cycleCivilDate.js';
import {
  isNightDate,
  localParts,
  nightOf,
  nightTimesProblem,
  publicNight,
  publicPlan,
  sleepError,
  sleepImportInput,
  sleepNightInput,
  sleepPlanInput,
  sleepPlaysInput,
  suggestedPlan,
} from '../lib/sleep.js';
import { pickTips, sleepSummary } from '../lib/sleepInsights.js';
import {
  deleteSleepNight,
  listSleepNights,
  listSleepSounds,
  listSleepTips,
  readSleepConfig,
  readSleepFile,
  readSleepPlan,
  recordSleepPlays,
  saveSleepPlan,
  stepsByDay,
  upsertSleepNight,
} from '../lib/sleepStore.js';

/**
 * MEDISLEEP API (/api/sleep, requireFeature('sleep') in server.js). The sound files are public (immutable, by
 * random id) so the phone can download them once into its cache; everything else is the signed-in person's own.
 */
export const sleepRouter = Router();
const r = sleepRouter;
const DAY_MS = 86_400_000;
const zone = (req) => clientTimezoneFromReq(req) || 'Asia/Tbilisi';
const shiftDay = (ymd, days) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

// ------------------------------------------------------------------ public files (before auth)

r.get('/files/:id', asyncHandler(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(404).end();
  const file = await readSleepFile(id.data);
  if (!file) return res.status(404).end();
  const etag = `"${file.sha256}"`;
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('ETag', etag);
  res.set('Accept-Ranges', 'bytes');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Type', file.mime);
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : file.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : file.size - 1;
    start = Math.max(0, start);
    end = Math.min(file.size - 1, end);
    if (start > end || start >= file.size) {
      res.set('Content-Range', `bytes */${file.size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.set('Content-Range', `bytes ${start}-${end}/${file.size}`);
    res.set('Content-Length', String(end - start + 1));
    return res.end(file.bytes.subarray(start, end + 1));
  }
  res.set('Content-Length', String(file.size));
  return res.end(file.bytes);
}));

r.use(requireAuth, (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

// ------------------------------------------------------------------ helpers

const fileUrl = (id) => (id ? `/api/sleep/files/${id}` : null);

function publicSound(row, req) {
  return {
    id: row.id,
    category: row.category,
    title: t(req, row.titleKa, row.titleEn),
    subtitle: t(req, row.subtitleKa, row.subtitleEn),
    tint: row.tint,
    loop: row.loop,
    featured: row.featured,
    durationMs: row.durationMs ?? null,
    audio: row.audioFileId ? { id: row.audioFileId, url: fileUrl(row.audioFileId), size: row.audioSize ?? null } : null,
    tail: row.tailFileId ? { id: row.tailFileId, url: fileUrl(row.tailFileId), size: row.tailSize ?? null } : null,
    art: row.artFileId ? { id: row.artFileId, url: fileUrl(row.artFileId) } : null,
  };
}

const CATEGORY_TITLES = {
  rain: ['წვიმა', 'Rain'],
  nature: ['ბუნება', 'Nature'],
  noise: ['ხმაური', 'Noise'],
  music: ['მელოდიები', 'Melodies'],
};

function publicTip(row, req) {
  return { id: row.id, trigger: row.trigger, title: t(req, row.titleKa, row.titleEn), body: t(req, row.bodyKa, row.bodyEn) };
}

async function analytics(req, { days }) {
  const tz = zone(req);
  const today = localParts(new Date(), tz).date;
  const historyFrom = shiftDay(today, -(days + 60));
  const [planRow, rows, steps] = await Promise.all([
    readSleepPlan(req.user.id),
    listSleepNights(req.user.id, { from: historyFrom }),
    stepsByDay(req.user.id, shiftDay(today, -(days + 2))),
  ]);
  const plan = publicPlan(planRow);
  const summary = sleepSummary(rows, { plan, timeZone: tz, today, days, stepsByDay: steps });
  return { tz, today, planRow, plan, rows, summary };
}

// ------------------------------------------------------------------ hub

r.get('/', asyncHandler(async (req, res) => {
  const [{ today, plan, rows, summary }, tips, config, user, profile] = await Promise.all([
    analytics(req, { days: 7 }),
    listSleepTips(),
    readSleepConfig(),
    prisma.user.findUnique({ where: { id: req.user.id }, select: { birthDate: true } }),
    prisma.healthProfile.findUnique({ where: { userId: req.user.id }, select: { extraAnswers: true, sleepHours: true } }),
  ]);
  const recent = rows.filter((n) => publicNight(n).night >= shiftDay(today, -20)).map(publicNight);
  res.json({
    today,
    plan,
    suggested: suggestedPlan({ birthDate: user?.birthDate, extraAnswers: profile?.extraAnswers, sleepHours: profile?.sleepHours }),
    nights: recent,
    summary,
    tips: pickTips(tips, summary).map((tip) => publicTip(tip, req)),
    config,
  });
}));

r.get('/insights', asyncHandler(async (req, res) => {
  const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const { today, plan, rows, summary } = await analytics(req, { days });
  const start = shiftDay(today, -(days - 1));
  res.json({
    today,
    plan,
    nights: rows.map(publicNight).filter((n) => n.night >= start),
    summary,
  });
}));

r.get('/sounds', asyncHandler(async (req, res) => {
  const [rows, config] = await Promise.all([listSleepSounds(), readSleepConfig()]);
  const sounds = rows.map((row) => publicSound(row, req));
  const used = new Set(sounds.map((s) => s.category));
  res.json({
    categories: Object.entries(CATEGORY_TITLES).filter(([id]) => used.has(id)).map(([id, [ka, en]]) => ({ id, title: t(req, ka, en) })),
    sounds,
    config,
  });
}));

// ------------------------------------------------------------------ writes

r.put('/plan', asyncHandler(async (req, res) => {
  const input = sleepPlanInput.parse(req.body);
  const row = await saveSleepPlan(req.user.id, input);
  res.json({ plan: publicPlan(row) });
}));

function nightParam(req) {
  if (!isNightDate(req.params.night)) {
    throw sleepError(400, 'ღამის თარიღი არასწორია.', 'SLEEP_NIGHT_INVALID', 'That night date is not valid.');
  }
  const today = localParts(new Date(), zone(req)).date;
  if (req.params.night > shiftDay(today, 1) || req.params.night < shiftDay(today, -400)) {
    throw sleepError(400, 'ამ თარიღზე ღამის ჩაწერა ვერ ხერხდება.', 'SLEEP_NIGHT_RANGE', 'A night cannot be saved for that date.');
  }
  return req.params.night;
}

function checkTimes(req, night, input) {
  if (input.kind === 'checkin' || (input.bedAt === undefined && input.wakeAt === undefined)) return;
  const problem = nightTimesProblem(input.bedAt, input.wakeAt);
  if (problem) throw sleepError(400, problem[0], 'SLEEP_TIMES_INVALID', problem[1]);
  const owner = nightOf(input.wakeAt, zone(req));
  // The night is the morning it ends; allow one day either way for time-zone travel.
  if (owner && Math.abs(Date.parse(`${owner}T00:00:00Z`) - Date.parse(`${night}T00:00:00Z`)) > DAY_MS) {
    throw sleepError(400, 'გაღვიძების დრო ამ ღამეს არ ეკუთვნის.', 'SLEEP_TIMES_NIGHT', 'That wake-up time does not belong to this night.');
  }
}

r.put('/nights/:night', asyncHandler(async (req, res) => {
  const night = nightParam(req);
  const input = sleepNightInput.parse(req.body);
  checkTimes(req, night, input);
  const { row, changed } = await upsertSleepNight(req.user.id, night, input);
  res.json({ night: publicNight(row), changed });
}));

r.delete('/nights/:night', asyncHandler(async (req, res) => {
  const night = nightParam(req);
  const removed = await deleteSleepNight(req.user.id, night);
  res.json({ removed });
}));

/** Nights read from Apple Health / Health Connect. Never touches her check-in; skips nights that fail the checks. */
r.post('/nights/import', asyncHandler(async (req, res) => {
  const { nights } = sleepImportInput.parse(req.body);
  const tz = zone(req);
  const today = localParts(new Date(), tz).date;
  let changed = 0;
  let skipped = 0;
  for (const { night, ...input } of nights) {
    if (night > shiftDay(today, 1) || night < shiftDay(today, -400) || nightTimesProblem(input.bedAt, input.wakeAt)) {
      skipped += 1;
      continue;
    }
    const result = await upsertSleepNight(req.user.id, night, input);
    if (result.changed) changed += 1;
  }
  res.json({ changed, skipped });
}));

r.post('/plays', asyncHandler(async (req, res) => {
  const { plays } = sleepPlaysInput.parse(req.body);
  const saved = await recordSleepPlays(req.user.id, plays);
  res.json({ saved });
}));
