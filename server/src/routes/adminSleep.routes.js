import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import { SLEEP_CATEGORIES, SLEEP_SOUND_STATUSES, sleepError } from '../lib/sleep.js';
import { SLEEP_TIP_TRIGGERS } from '../lib/sleepContent.js';
import {
  createSleepSound,
  listSleepSounds,
  listSleepTips,
  readSleepConfig,
  readSleepSound,
  saveSleepConfig,
  saveSleepFile,
  saveSleepTip,
  sniffSleepFile,
  updateSleepSound,
} from '../lib/sleepStore.js';
import { SLEEP_ADMIN_PERIODS, loadSleepOverview } from '../lib/adminUsageSleep.js';

/**
 * Admin #/sleep (MEDISLEEP): usage analytics (counts and people, never anyone's sleep values), the sound library
 * (uploads go to "SleepFile" — multipart, the JSON body limit is 2 MB), the advice cards and module settings.
 */
export const adminSleepRouter = Router();
const a = adminSleepRouter;
a.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const view = requireAdminCapability('SLEEP_VIEW');
const manage = requireAdminCapability('SLEEP_MANAGE');

const AUDIO_MAX = 12 * 1024 * 1024;
const IMAGE_MAX = 2 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: AUDIO_MAX, files: 1, fields: 4 } });

const slug = z.string().regex(/^[a-z0-9-]{2,40}$/, 'id: მხოლოდ ლათინური პატარა ასოები, ციფრები და ტირე.');
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const soundFields = {
  category: z.enum(SLEEP_CATEGORIES),
  titleKa: z.string().trim().min(1).max(60),
  titleEn: z.string().trim().min(1).max(60),
  subtitleKa: z.string().trim().max(90),
  subtitleEn: z.string().trim().max(90),
  tint: hex,
  loop: z.boolean(),
  featured: z.boolean(),
  status: z.enum(SLEEP_SOUND_STATUSES),
  sortOrder: z.number().int().min(0).max(100000),
};
const soundCreate = z.object({ id: slug, ...soundFields }).partial({ subtitleKa: true, subtitleEn: true, tint: true, loop: true, featured: true, status: true, sortOrder: true }).strict();
const soundPatch = z.object(soundFields).partial().strict();
const tipInput = z.object({
  trigger: z.enum(SLEEP_TIP_TRIGGERS),
  titleKa: z.string().trim().min(1).max(80),
  titleEn: z.string().trim().min(1).max(80),
  bodyKa: z.string().trim().min(1).max(600),
  bodyEn: z.string().trim().min(1).max(600),
  status: z.enum(['LIVE', 'HIDDEN', 'ARCHIVED']),
  sortOrder: z.number().int().min(0).max(100000),
}).strict();

function adminSound(row) {
  return {
    id: row.id,
    category: row.category,
    titleKa: row.titleKa,
    titleEn: row.titleEn,
    subtitleKa: row.subtitleKa,
    subtitleEn: row.subtitleEn,
    tint: row.tint,
    loop: row.loop,
    featured: row.featured,
    status: row.status,
    sortOrder: row.sortOrder,
    durationMs: row.durationMs ?? null,
    audio: row.audioFileId ? { id: row.audioFileId, url: `/api/sleep/files/${row.audioFileId}`, size: row.audioSize ?? null } : null,
    tail: row.tailFileId ? { id: row.tailFileId, url: `/api/sleep/files/${row.tailFileId}`, size: row.tailSize ?? null } : null,
    art: row.artFileId ? { id: row.artFileId, url: `/api/sleep/files/${row.artFileId}`, size: row.artSize ?? null } : null,
    updatedAt: row.updatedAt,
  };
}

const audit = (req, action, targetId, previousValue, newValue) =>
  writeAdminAudit({ admin: req.admin, action, targetType: 'sleep', targetId, previousValue, newValue });

// ------------------------------------------------------------------ analytics

a.get('/overview', view, asyncHandler(async (req, res) => {
  const days = SLEEP_ADMIN_PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  res.json(await loadSleepOverview({ days, includeTeam: req.query.team === '1' }));
}));

// ------------------------------------------------------------------ sounds

a.get('/sounds', view, asyncHandler(async (_req, res) => {
  const rows = await listSleepSounds({ all: true });
  res.json({ sounds: rows.map(adminSound), categories: SLEEP_CATEGORIES, statuses: SLEEP_SOUND_STATUSES });
}));

a.post('/sounds', manage, asyncHandler(async (req, res) => {
  const input = soundCreate.parse(req.body);
  if (await readSleepSound(input.id)) {
    throw sleepError(409, 'ამ id-ით ხმა უკვე არსებობს.', 'SLEEP_SOUND_EXISTS', 'A sound with this id already exists.');
  }
  if (input.status === 'LIVE') {
    throw sleepError(400, 'ახალი ხმა ჯერ მონახაზად შეინახე და ფაილი ატვირთე.', 'SLEEP_SOUND_NO_AUDIO', 'Save the new sound as a draft and upload its file first.');
  }
  const row = await createSleepSound(input);
  await audit(req, 'sleep.sound.create', row.id, null, input);
  res.status(201).json({ sound: adminSound(row) });
}));

a.patch('/sounds/:id', manage, asyncHandler(async (req, res) => {
  const id = slug.parse(req.params.id);
  const patch = soundPatch.parse(req.body);
  const { before, row } = await updateSleepSound(id, patch);
  await audit(req, 'sleep.sound.update', id, Object.fromEntries(Object.keys(patch).map((k) => [k, before[k]])), patch);
  res.json({ sound: adminSound(row) });
}));

a.post('/sounds/order', manage, asyncHandler(async (req, res) => {
  const { ids } = z.object({ ids: z.array(slug).min(1).max(200) }).strict().parse(req.body);
  for (const [index, id] of ids.entries()) await updateSleepSound(id, { sortOrder: index * 10 });
  await audit(req, 'sleep.sound.order', null, null, { ids });
  res.json({ ok: true });
}));

const SLOT = { audio: 'audioFileId', tail: 'tailFileId', art: 'artFileId' };

a.post('/sounds/:id/:slot(audio|tail|art)', manage, upload.single('file'), asyncHandler(async (req, res) => {
  const id = slug.parse(req.params.id);
  const slot = req.params.slot;
  const sound = await readSleepSound(id);
  if (!sound) throw sleepError(404, 'ხმა ვერ მოიძებნა.', 'SLEEP_SOUND_NOT_FOUND', 'Sound not found.');
  const bytes = req.file?.buffer;
  const kind = sniffSleepFile(bytes);
  const wantImage = slot === 'art';
  if (!kind || (wantImage ? kind.kind !== 'image' : kind.kind !== 'audio')) {
    throw sleepError(400, wantImage ? 'სურათი უნდა იყოს JPG, PNG ან WEBP.' : 'ხმა უნდა იყოს M4A (AAC) ან MP3.', 'SLEEP_FILE_TYPE',
      wantImage ? 'The image must be JPG, PNG or WEBP.' : 'The sound must be M4A (AAC) or MP3.');
  }
  if (wantImage && bytes.length > IMAGE_MAX) {
    throw sleepError(400, 'სურათი 2 მეგაბაიტზე ნაკლები უნდა იყოს.', 'SLEEP_FILE_SIZE', 'The image must be under 2 MB.');
  }
  const durationMs = Number.isInteger(Number(req.body?.durationMs)) && Number(req.body.durationMs) > 0 ? Number(req.body.durationMs) : null;
  const file = await saveSleepFile({ kind: kind.kind, mime: kind.mime, bytes, durationMs, createdBy: req.admin?.email || null });
  const patch = { [SLOT[slot]]: file.id };
  if (slot === 'audio') {
    patch.durationMs = durationMs ?? sound.durationMs;
    // A new loop does not match the old fade-out tail; the app fades on its own until a new tail is uploaded.
    patch.tailFileId = null;
  }
  const { row } = await updateSleepSound(id, patch);
  await audit(req, `sleep.sound.${slot}`, id, { [SLOT[slot]]: sound[SLOT[slot]] }, { [SLOT[slot]]: file.id, size: file.size });
  res.json({ sound: adminSound({ ...row, audioSize: slot === 'audio' ? file.size : undefined }) });
}));

// ------------------------------------------------------------------ advice

a.get('/tips', view, asyncHandler(async (_req, res) => {
  res.json({ tips: await listSleepTips({ all: true }), triggers: SLEEP_TIP_TRIGGERS });
}));

a.put('/tips/:id', manage, asyncHandler(async (req, res) => {
  const id = slug.parse(req.params.id);
  const input = tipInput.parse(req.body);
  const before = (await listSleepTips({ all: true })).find((tip) => tip.id === id) || null;
  const row = await saveSleepTip({ id, ...input });
  await audit(req, before ? 'sleep.tip.update' : 'sleep.tip.create', id, before, input);
  res.json({ tip: row });
}));

// ------------------------------------------------------------------ settings

a.get('/config', view, asyncHandler(async (_req, res) => {
  res.json({ config: await readSleepConfig() });
}));

a.put('/config', manage, asyncHandler(async (req, res) => {
  const before = await readSleepConfig();
  const config = await saveSleepConfig(req.body?.config ?? req.body);
  await audit(req, 'sleep.config', 'default', before, config);
  res.json({ config });
}));
