import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import { SIGNS } from '../lib/horoscope/astro.js';
import { KINDS, isValidPeriodKey } from '../lib/horoscope/generate.js';
import { HOROSCOPE_MODELS } from '../lib/horoscope/llm.js';
import { LIBRARY_NAMESPACES } from '../lib/horoscope/library.js';
import { ensureReadings, regenerateReading, runLibraryFill } from '../lib/horoscope/jobs.js';
import { loadHoroscopeOverview, loadHoroscopeStatus } from '../lib/horoscope/adminHoroscope.js';
import { skyView } from '../lib/horoscope/view.js';
import {
  DEFAULT_CONFIG, editReading, listLibrary, listReadings, readConfig, saveConfig, saveLibraryEntry, setReadingStatus,
} from '../lib/horoscope/store.js';

/**
 * Admin #/horoscope (MEDIHOROSCOPE): readings per period and sign (read, edit, hide, write again), the library,
 * the generator log/costs, settings and usage. Usage is counts only — never chat text or birth details.
 */
export const adminHoroscopeRouter = Router();
const a = adminHoroscopeRouter;
a.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const view = requireAdminCapability('HOROSCOPE_VIEW');
const manage = requireAdminCapability('HOROSCOPE_MANAGE');

const audit = (req, action, targetId, previousValue, newValue) =>
  writeAdminAudit({ admin: req.admin, action, targetType: 'horoscope', targetId, previousValue, newValue });

// Long jobs started from admin run in the background; one at a time.
let running = null;
function startBackground(label, fn) {
  if (running) return false;
  running = label;
  Promise.resolve().then(fn).catch((err) => console.error(`[horoscope-admin] ${label} failed:`, err?.message || err)).finally(() => { running = null; });
  return true;
}

a.get('/status', view, asyncHandler(async (_req, res) => {
  res.json({ ...(await loadHoroscopeStatus()), running, sky: skyView(new Date(), 45), models: HOROSCOPE_MODELS, defaults: DEFAULT_CONFIG });
}));

a.get('/overview', view, asyncHandler(async (req, res) => {
  res.json(await loadHoroscopeOverview({ days: Number(req.query.days), includeTeam: req.query.team === '1' }));
}));

// ── Readings ───────────────────────────────────────────────────────────

a.get('/readings', view, asyncHandler(async (req, res) => {
  const kind = String(req.query.kind || 'day');
  const key = String(req.query.key || '');
  if (!KINDS.includes(kind) || !isValidPeriodKey(kind, key)) return res.status(400).json({ error: 'პერიოდი არასწორია.' });
  res.json({ kind, key, readings: await listReadings({ kind, periodKey: key, source: 'ai' }) });
}));

const textBlock = z.object({
  headline: z.string().trim().min(1).max(200),
  general: z.string().trim().min(1).max(4000),
  love: z.string().trim().min(1).max(2000),
  money: z.string().trim().min(1).max(2000),
  mood: z.string().trim().min(1).max(2000),
  tip: z.string().trim().min(1).max(600),
});

a.put('/readings/:id', manage, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const input = z.object({ ka: textBlock, en: textBlock, scores: z.object({ love: z.number().int().min(1).max(5), money: z.number().int().min(1).max(5), mood: z.number().int().min(1).max(5) }) }).parse(req.body || {});
  const [kind, periodKey, sign] = id.split(':');
  const current = (await listReadings({ kind, periodKey, source: 'ai' })).find((r) => r.sign === sign);
  if (!current) return res.status(404).json({ error: 'ჰოროსკოპი ვერ მოიძებნა.' });
  const body = { ...current.body, ka: input.ka, en: input.en, scores: input.scores };
  const row = await editReading(id, body, req.admin.id);
  await audit(req, 'HOROSCOPE_READING_EDIT', id, current.body, body);
  res.json({ reading: row });
}));

a.post('/readings/:id/status', manage, asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['LIVE', 'HIDDEN']) }).parse(req.body || {});
  const row = await setReadingStatus(String(req.params.id), status, req.admin.id);
  if (!row) return res.status(404).json({ error: 'ჰოროსკოპი ვერ მოიძებნა.' });
  await audit(req, 'HOROSCOPE_READING_STATUS', row.id, null, { status });
  res.json({ reading: row });
}));

/** Writes one sign's reading again now (≈ 20–60 s). */
a.post('/readings/regenerate', manage, asyncHandler(async (req, res) => {
  const input = z.object({ kind: z.enum(KINDS), key: z.string(), sign: z.enum(SIGNS) }).parse(req.body || {});
  if (!isValidPeriodKey(input.kind, input.key)) return res.status(400).json({ error: 'პერიოდი არასწორია.' });
  const r = await regenerateReading(input);
  await audit(req, 'HOROSCOPE_READING_REGENERATE', `${input.kind}:${input.key}:${input.sign}`, null, { model: r.model, costUsd: r.costUsd });
  res.json({ ok: true, model: r.model, costUsd: r.costUsd, body: r.body });
}));

/** Writes every missing reading of a period in the background. */
a.post('/readings/generate', manage, asyncHandler(async (req, res) => {
  const input = z.object({ kind: z.enum(KINDS), key: z.string() }).parse(req.body || {});
  if (!isValidPeriodKey(input.kind, input.key)) return res.status(400).json({ error: 'პერიოდი არასწორია.' });
  const started = startBackground(`readings ${input.kind} ${input.key}`, () => ensureReadings({ force: [input.kind, input.key], max: 12 }));
  if (!started) return res.status(409).json({ error: `ახლა უკვე მიმდინარეობს: ${running}` });
  await audit(req, 'HOROSCOPE_READINGS_GENERATE', `${input.kind}:${input.key}`, null, null);
  res.status(202).json({ ok: true });
}));

// ── Library ────────────────────────────────────────────────────────────

a.get('/library', view, asyncHandler(async (req, res) => {
  const ns = LIBRARY_NAMESPACES.includes(String(req.query.ns)) ? String(req.query.ns) : '';
  const rows = await listLibrary({ prefix: ns ? `${ns}:` : '', q: String(req.query.q || '').slice(0, 60), limit: 60, offset: Math.max(0, Number(req.query.offset) || 0) });
  res.json({ ns, rows });
}));

a.put('/library', manage, asyncHandler(async (req, res) => {
  const input = z.object({ key: z.string().regex(/^[a-z_]+:[\w:]+$/).max(80), lang: z.enum(['ka', 'en']), data: z.record(z.string(), z.any()) }).parse(req.body || {});
  if (!LIBRARY_NAMESPACES.includes(input.key.split(':')[0])) return res.status(400).json({ error: 'უცნობი გასაღები.' });
  await saveLibraryEntry({ key: input.key, lang: input.lang, data: input.data, source: 'admin', updatedBy: req.admin.id });
  await audit(req, 'HOROSCOPE_LIBRARY_EDIT', `${input.key}:${input.lang}`, null, input.data);
  res.json({ ok: true });
}));

a.post('/library/fill', manage, asyncHandler(async (req, res) => {
  const batches = Math.max(1, Math.min(40, Number(req.body?.batches) || 10));
  const started = startBackground(`library ×${batches}`, () => runLibraryFill({ maxBatches: batches }));
  if (!started) return res.status(409).json({ error: `ახლა უკვე მიმდინარეობს: ${running}` });
  await audit(req, 'HOROSCOPE_LIBRARY_FILL', null, null, { batches });
  res.status(202).json({ ok: true });
}));

// ── Settings ───────────────────────────────────────────────────────────

const modelId = z.string().refine((v) => v === 'none' || Boolean(HOROSCOPE_MODELS[v]), 'უცნობი მოდელი');
a.put('/config', manage, asyncHandler(async (req, res) => {
  const input = z.object({
    aiEnabled: z.boolean().optional(),
    writerModel: modelId.optional(),
    editorModel: modelId.optional(),
    englishModel: modelId.optional(),
    extraStyle: z.string().max(2000).optional(),
    libraryAutoFill: z.boolean().optional(),
    homeCard: z.boolean().optional(),
    oracleEnabled: z.boolean().optional(),
    oracleDailyLimit: z.number().int().min(1).max(200).optional(),
    oracleNameKa: z.string().trim().min(1).max(40).optional(),
    oracleNameEn: z.string().trim().min(1).max(40).optional(),
  }).parse(req.body || {});
  if (input.writerModel === 'none' || input.englishModel === 'none') return res.status(400).json({ error: 'ავტორის მოდელი სავალდებულოა.' });
  const before = await readConfig();
  const after = await saveConfig(input, req.admin.id);
  await audit(req, 'HOROSCOPE_CONFIG', 'config', before, after);
  res.json({ config: after });
}));
