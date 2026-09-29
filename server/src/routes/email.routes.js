/**
 * Email HTTP surface:
 *   POST /api/email/webhook      Resend (Svix-signed) delivery events — raw body, mounted before express.json
 *   GET|POST /unsubscribe?t=…    one-click marketing unsubscribe (page + RFC 8058 POST)
 *   /api/admin/email/*           admin #/email (overview, templates, campaigns, log, suppressions)
 */
import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import { clientIp } from '../lib/rateLimitKey.js';
import { parseLang } from '../lib/i18n.js';
import { isFeatureEnabled } from '../lib/featureFlags.js';
import { inboundHealth, isMissingSupportTable } from '../lib/support/inbound.js';
import {
  CAMPAIGN_VARS,
  DEFAULT_TEMPLATES,
  EMAIL_FEATURE,
  EMAIL_SEGMENTS,
  LOG_RETENTION_DAYS,
  SAMPLE_VARS,
  TEMPLATE_FIELDS,
  campaignContent,
  cancelEmailCampaign,
  commonVars,
  countSegment,
  dispatchEmailWebhookEvent,
  emailConfig,
  hashEmail,
  invalidateTemplateCache,
  isDeliverableEmail,
  listTemplates,
  mergeTemplate,
  queueEmailCampaign,
  renderEmail,
  segmentCounts,
  sendEmail,
  unsubscribePageHtml,
  unsubscribeWithToken,
  validateTemplateVars,
  verifySvixSignature,
} from '../lib/email/index.js';

const httpError = (message, status = 400, code) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) });

/* ═════════ Resend webhook ═════════ */
/** Indirection so tests can exercise the signed route without touching the database. */
export const webhookHandlers = { dispatch: (event) => dispatchEmailWebhookEvent(event) };
export const emailWebhookRouter = Router();
emailWebhookRouter.post(
  '/webhook',
  express.raw({ type: '*/*', limit: '512kb' }),
  asyncHandler(async (req, res) => {
    if (!env.RESEND_WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'webhook not configured', code: 'WEBHOOK_NOT_CONFIGURED' });
    }
    const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const check = verifySvixSignature({ secret: env.RESEND_WEBHOOK_SECRET, headers: req.headers, payload });
    if (!check.ok) return res.status(401).json({ error: 'invalid signature', code: 'INVALID_SIGNATURE' });
    let event;
    try { event = JSON.parse(payload); } catch { return res.status(400).json({ error: 'invalid json' }); }
    let result;
    try {
      result = await webhookHandlers.dispatch(event);
    } catch (error) {
      // Tables not installed yet (deploy in progress): 503 so Resend retries the event later.
      if (isMissingSupportTable(error)) return res.status(503).json({ error: 'not installed', code: 'NOT_INSTALLED' });
      throw error;
    }
    return res.json({ ok: true, ...result });
  }),
);

/* ═════════ Unsubscribe (public) ═════════ */
export const unsubscribeRouter = Router();
const unsubscribeLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => clientIp(req),
});

/** Page language: ?lang=en, else a browser that prefers English; Georgian otherwise. */
function unsubscribeLang(req) {
  return parseLang(req.query?.lang) ?? parseLang(String(req.headers?.['accept-language'] || '').split(',')[0]) ?? 'ka';
}

unsubscribeRouter.get('/unsubscribe', unsubscribeLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  let result;
  try { result = await unsubscribeWithToken(String(req.query.t || '')); } catch (error) {
    console.warn('[email] unsubscribe failed', error?.message);
    result = 'error';
  }
  res.status(result === 'invalid' ? 400 : result === 'error' ? 503 : 200).type('html').send(unsubscribePageHtml(result, unsubscribeLang(req)));
});

/** RFC 8058 one-click: mail clients POST "List-Unsubscribe=One-Click" to the same URL. */
unsubscribeRouter.post('/unsubscribe', unsubscribeLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let result;
  try { result = await unsubscribeWithToken(String(req.query.t || req.body?.t || '')); } catch (error) {
    console.warn('[email] unsubscribe failed', error?.message);
    result = 'error';
  }
  if (result === 'invalid') return res.status(400).json({ ok: false });
  if (result === 'error') return res.status(503).json({ ok: false });
  return res.json({ ok: true });
});

/* ═════════ Admin ═════════ */
export const adminEmailRouter = Router();
adminEmailRouter.use(requireAdmin);

const DAY = 24 * 60 * 60 * 1000;
const tbilisiDay = (d) => new Date(d.getTime() + 4 * 3600 * 1000).toISOString().slice(0, 10);
const isMissing = (error) => /Email(Log|Template|Suppression|Campaign)|emailMarketingOptIn|42P01|42703|P2021|does not exist/i.test(String(error?.message || error?.code || ''));

adminEmailRouter.get('/overview', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const days = [7, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY);
  const enabled = await isFeatureEnabled(EMAIL_FEATURE);
  const config = emailConfig();
  let installed = true;
  let byStatus = {};
  let trend = { sent: [], failed: [], delivered: [] };
  let optIn = { optedIn: 0, reachable: 0, rate: null };
  let suppressions = 0;
  try {
    const grouped = await prisma.emailLog.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } });
    byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    const rows = await prisma.$queryRaw`SELECT to_char(("createdAt" + INTERVAL '4 hours')::date, 'YYYY-MM-DD') AS day, status, COUNT(*)::int AS n
      FROM "EmailLog" WHERE "createdAt" >= ${since} GROUP BY 1, 2`;
    const daysList = Array.from({ length: days }, (_, i) => tbilisiDay(new Date(now.getTime() - (days - 1 - i) * DAY)));
    const count = (day, statuses) => rows.filter((r) => r.day === day && statuses.includes(r.status)).reduce((s, r) => s + r.n, 0);
    const ACCEPTED = ['sent', 'delayed', 'delivered', 'opened', 'clicked', 'bounced', 'complained'];
    trend = {
      sent: daysList.map((day) => ({ day, count: count(day, ACCEPTED) })),
      delivered: daysList.map((day) => ({ day, count: count(day, ['delivered', 'opened', 'clicked']) })),
      failed: daysList.map((day) => ({ day, count: count(day, ['failed', 'bounced', 'complained']) })),
    };
    suppressions = await prisma.emailSuppression.count();
  } catch (error) {
    if (!isMissing(error)) throw error;
    installed = false;
  }
  try {
    const r = await prisma.$queryRaw`SELECT COUNT(*) FILTER (WHERE "emailMarketingOptIn")::int AS "optedIn", COUNT(*)::int AS reachable
      FROM "User" WHERE status <> 'BLOCKED' AND email NOT LIKE '%@phone.medicard.ge'`;
    const { optedIn = 0, reachable = 0 } = r[0] || {};
    optIn = { optedIn, reachable, rate: reachable ? Math.round((optedIn / reachable) * 1000) / 10 : null };
  } catch (error) {
    if (!isMissing(error)) throw error;
    installed = false;
  }
  const sum = (...keys) => keys.reduce((s, k) => s + (byStatus[k] || 0), 0);
  res.json({
    days,
    installed,
    enabled,
    config: { resendConfigured: config.resendConfigured, webhookConfigured: config.webhookConfigured, from: config.from, replyTo: config.replyTo },
    totals: {
      sent: sum('sent', 'delayed', 'delivered', 'opened', 'clicked', 'bounced', 'complained'),
      delivered: sum('delivered', 'opened', 'clicked'),
      opened: sum('opened', 'clicked'),
      bounced: sum('bounced'),
      complained: sum('complained'),
      failed: sum('failed'),
      suppressed: sum('suppressed'),
    },
    byStatus,
    trend,
    optIn,
    suppressions,
    retentionDays: LOG_RETENTION_DAYS,
    inbound: await inboundHealth().catch(() => null),
  });
}));

/* ───────── Templates ───────── */
const templateView = (t) => ({
  key: t.key,
  name: t.name,
  category: t.category,
  trigger: t.trigger,
  enabled: t.enabled,
  overridden: t.overridden,
  vars: t.vars,
  required: t.required,
  updatedAt: t.updatedAt,
  updatedBy: t.updatedBy,
  ...Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, t[f] ?? ''])),
  defaults: Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, DEFAULT_TEMPLATES[t.key][f] ?? ''])),
});

adminEmailRouter.get('/templates', asyncHandler(async (_req, res) => {
  res.json({ templates: (await listTemplates()).map(templateView), sampleVars: SAMPLE_VARS });
}));

const fieldsSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  preheader: z.string().max(250),
  heading: z.string().max(200),
  body: z.string().max(8000),
  ctaLabel: z.string().max(60),
  ctaUrl: z.string().max(500),
});
const templatePatch = fieldsSchema.partial().extend({ enabled: z.boolean().optional() });

function assertKnownTemplate(key) {
  if (!DEFAULT_TEMPLATES[key]) throw httpError('შაბლონი ვერ მოიძებნა.', 404);
  return DEFAULT_TEMPLATES[key];
}

function assertVars(fields, def) {
  const check = validateTemplateVars(fields, { vars: def.vars, required: def.required });
  if (!check.ok) {
    const parts = [];
    if (check.unknown.length) parts.push(`უცნობი ცვლადი: ${check.unknown.map((v) => `{{${v}}}`).join(', ')}`);
    if (check.missing.length) parts.push(`აუცილებელი ცვლადი აკლია: ${check.missing.map((v) => `{{${v}}}`).join(', ')}`);
    throw httpError(parts.join('. '), 400, 'TEMPLATE_VARS');
  }
}

adminEmailRouter.put('/templates/:key', asyncHandler(async (req, res) => {
  const def = assertKnownTemplate(req.params.key);
  const body = templatePatch.parse(req.body ?? {});
  const beforeList = await listTemplates();
  const before = beforeList.find((t) => t.key === def.key);
  const nextFields = Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, body[f] ?? before[f] ?? '']));
  assertVars(nextFields, def);
  const data = {
    name: def.name,
    category: def.category,
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...Object.fromEntries(TEMPLATE_FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]])),
    updatedAt: new Date(),
    updatedBy: req.admin?.email || null,
  };
  try {
    await prisma.emailTemplate.upsert({ where: { key: def.key }, create: { key: def.key, ...data }, update: data });
  } catch (error) {
    if (isMissing(error)) throw httpError('ელფოსტის ცხრილები ჯერ არ არის დაყენებული (შემდეგი დეპლოი).', 503, 'EMAIL_NOT_INSTALLED');
    throw error;
  }
  invalidateTemplateCache();
  const after = (await listTemplates()).find((t) => t.key === def.key);
  await writeAdminAudit({
    admin: req.admin,
    action: body.enabled !== undefined && Object.keys(body).length === 1 ? 'email.template.toggle' : 'email.template.update',
    targetType: 'emailTemplate',
    targetId: def.key,
    previousValue: { enabled: before.enabled, ...Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, before[f]])) },
    newValue: { enabled: after.enabled, ...Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, after[f]])) },
  });
  res.json({ template: templateView(after) });
}));

/** Reset to the code default (keeps the on/off switch). */
adminEmailRouter.post('/templates/:key/reset', asyncHandler(async (req, res) => {
  const def = assertKnownTemplate(req.params.key);
  const before = (await listTemplates()).find((t) => t.key === def.key);
  const cleared = Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, null]));
  try {
    await prisma.emailTemplate.updateMany({ where: { key: def.key }, data: { ...cleared, updatedAt: new Date(), updatedBy: req.admin?.email || null } });
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  invalidateTemplateCache();
  const after = (await listTemplates()).find((t) => t.key === def.key);
  await writeAdminAudit({
    admin: req.admin,
    action: 'email.template.reset',
    targetType: 'emailTemplate',
    targetId: def.key,
    previousValue: Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, before[f]])),
    newValue: { reset: true },
  });
  res.json({ template: templateView(after) });
}));

/** Live preview with sample values and the real layout. Nothing is saved. */
adminEmailRouter.post('/templates/:key/preview', asyncHandler(async (req, res) => {
  const def = assertKnownTemplate(req.params.key);
  const fields = fieldsSchema.extend({ subject: z.string().max(200) }).partial().parse(req.body ?? {});
  const content = { ...mergeTemplate(def.key, null), ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) };
  const check = validateTemplateVars(content, { vars: def.vars, required: def.required });
  const rendered = renderEmail({ content, vars: SAMPLE_VARS, allowed: def.vars, category: def.category, unsubscribeUrl: 'https://medicard.ge/unsubscribe?t=preview' });
  res.json({ ...rendered, vars: check });
}));

const testSendSchema = z.object({ to: z.string().trim().toLowerCase().email().max(254) });

async function sendTest({ to, templateKey, content, allowed, category, admin }) {
  if (!isDeliverableEmail(to)) throw httpError('ელფოსტის მისამართი არასწორია.', 400);
  const result = await sendEmail({
    to,
    templateKey,
    vars: { ...SAMPLE_VARS, ...commonVars({ fullName: admin?.fullName || '' }), code: SAMPLE_VARS.code, minutes: SAMPLE_VARS.minutes },
    content,
    allowedVars: allowed,
    previewUnsubscribeUrl: category === 'marketing' ? 'https://medicard.ge/unsubscribe' : '',
    category,
    subjectPrefix: '[ტესტი] ',
    ignoreTemplateSwitch: true,
  });
  if (result.status !== 'sent') {
    const reasons = {
      disabled: 'ელფოსტა გამორთულია (კილ-სვიჩი).',
      not_configured: 'RESEND_API_KEY არ არის დაყენებული.',
      suppressed: 'ეს მისამართი დაბლოკილია (bounce ან საჩივარი).',
      undeliverable: 'მისამართი არასწორია.',
    };
    throw httpError(reasons[result.reason] || `გაგზავნა ვერ მოხერხდა: ${result.reason || ''}`, 422, 'TEST_SEND_FAILED');
  }
  return result;
}

adminEmailRouter.post('/templates/:key/test', asyncHandler(async (req, res) => {
  const def = assertKnownTemplate(req.params.key);
  const { to } = testSendSchema.parse(req.body ?? {});
  const fields = fieldsSchema.partial().parse(req.body?.fields ?? {});
  const content = Object.keys(fields).length ? { ...mergeTemplate(def.key, null), ...(await listTemplates()).find((t) => t.key === def.key), ...fields } : null;
  if (content) assertVars(content, def);
  const result = await sendTest({ to, templateKey: def.key, content, allowed: def.vars, category: def.category, admin: req.admin });
  await writeAdminAudit({ admin: req.admin, action: 'email.template.test', targetType: 'emailTemplate', targetId: def.key, newValue: { toHash: hashEmail(to).slice(0, 12) } });
  res.json({ ok: true, providerId: result.providerId });
}));

/* ───────── Campaigns ───────── */
const campaignSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  preheader: z.string().max(250).default(''),
  heading: z.string().max(200).default(''),
  body: z.string().trim().min(1).max(8000),
  ctaLabel: z.string().max(60).default(''),
  ctaUrl: z.string().max(500).default(''),
  segment: z.enum(EMAIL_SEGMENTS).default('ALL_OPTED_IN'),
});

function assertCampaignVars(fields) {
  const check = validateTemplateVars(fields, { vars: CAMPAIGN_VARS });
  if (!check.ok) throw httpError(`უცნობი ცვლადი: ${check.unknown.map((v) => `{{${v}}}`).join(', ')}`, 400, 'TEMPLATE_VARS');
  if (fields.ctaLabel && !fields.ctaUrl) throw httpError('ღილაკს ბმული სჭირდება.', 400);
}

const campaignView = (c) => ({
  id: c.id, subject: c.subject, preheader: c.preheader, heading: c.heading, body: c.body, ctaLabel: c.ctaLabel, ctaUrl: c.ctaUrl,
  segment: c.segment, status: c.status, targetCount: c.targetCount, sentCount: c.sentCount, failedCount: c.failedCount,
  skipped: Number(c.data?.progress?.skipped || 0), createdById: c.createdById, createdAt: c.createdAt, updatedAt: c.updatedAt, sentAt: c.sentAt,
});

const withInstallGuard = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (isMissing(error)) throw httpError('ელფოსტის ცხრილები ჯერ არ არის დაყენებული (შემდეგი დეპლოი).', 503, 'EMAIL_NOT_INSTALLED');
    throw error;
  }
});

adminEmailRouter.get('/segments', withInstallGuard(async (_req, res) => {
  res.json({ segments: EMAIL_SEGMENTS, counts: await segmentCounts() });
}));

adminEmailRouter.get('/campaigns', withInstallGuard(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = await prisma.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ campaigns: rows.map(campaignView) });
}));

adminEmailRouter.get('/campaigns/:id', withInstallGuard(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const row = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!row) throw httpError('კამპანია ვერ მოიძებნა.', 404);
  res.json({ campaign: campaignView(row) });
}));

adminEmailRouter.post('/campaigns', withInstallGuard(async (req, res) => {
  const body = campaignSchema.parse(req.body ?? {});
  assertCampaignVars(body);
  const row = await prisma.emailCampaign.create({ data: { id: randomUUID(), ...body, status: 'draft', createdById: req.admin?.id || null } });
  await writeAdminAudit({ admin: req.admin, action: 'email.campaign.create', targetType: 'emailCampaign', targetId: row.id, newValue: { subject: row.subject, segment: row.segment } });
  res.status(201).json({ campaign: campaignView(row) });
}));

adminEmailRouter.put('/campaigns/:id', withInstallGuard(async (req, res) => {
  const body = campaignSchema.parse(req.body ?? {});
  assertCampaignVars(body);
  const before = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!before) throw httpError('კამპანია ვერ მოიძებნა.', 404);
  if (before.status !== 'draft') throw httpError('რედაქტირება შესაძლებელია მხოლოდ მონახაზში.', 409);
  const row = await prisma.emailCampaign.update({ where: { id: before.id }, data: { ...body, updatedAt: new Date() } });
  await writeAdminAudit({ admin: req.admin, action: 'email.campaign.update', targetType: 'emailCampaign', targetId: row.id, previousValue: { subject: before.subject, segment: before.segment }, newValue: { subject: row.subject, segment: row.segment } });
  res.json({ campaign: campaignView(row) });
}));

adminEmailRouter.post('/campaigns/preview', asyncHandler(async (req, res) => {
  // Lenient while typing: empty fields preview as empty, only lengths are enforced.
  const body = z.object({
    subject: z.string().max(200).default(''),
    preheader: z.string().max(250).default(''),
    heading: z.string().max(200).default(''),
    body: z.string().max(8000).default(''),
    ctaLabel: z.string().max(60).default(''),
    ctaUrl: z.string().max(500).default(''),
    segment: z.enum(EMAIL_SEGMENTS).optional(),
  }).parse(req.body ?? {});
  const content = campaignContent(body);
  const check = validateTemplateVars(content, { vars: CAMPAIGN_VARS });
  const rendered = renderEmail({ content, vars: SAMPLE_VARS, allowed: CAMPAIGN_VARS, category: 'marketing', unsubscribeUrl: 'https://medicard.ge/unsubscribe?t=preview' });
  let count = null;
  if (body.segment) count = await countSegment(body.segment).catch(() => null);
  res.json({ ...rendered, vars: check, recipients: count });
}));

adminEmailRouter.post('/campaigns/test', asyncHandler(async (req, res) => {
  const { to } = testSendSchema.parse(req.body ?? {});
  const fields = campaignSchema.parse(req.body?.fields ?? {});
  assertCampaignVars(fields);
  const result = await sendTest({ to, templateKey: 'campaign', content: campaignContent(fields), allowed: CAMPAIGN_VARS, category: 'marketing', admin: req.admin });
  await writeAdminAudit({ admin: req.admin, action: 'email.campaign.test', targetType: 'emailCampaign', targetId: null, newValue: { subject: fields.subject, toHash: hashEmail(to).slice(0, 12) } });
  res.json({ ok: true, providerId: result.providerId });
}));

adminEmailRouter.post('/campaigns/:id/queue', withInstallGuard(async (req, res) => {
  if (!emailConfig().resendConfigured) throw httpError('RESEND_API_KEY არ არის დაყენებული.', 422, 'NOT_CONFIGURED');
  const row = await queueEmailCampaign(req.params.id);
  await writeAdminAudit({ admin: req.admin, action: 'email.campaign.queue', targetType: 'emailCampaign', targetId: row.id, newValue: { subject: row.subject, segment: row.segment, targetCount: row.targetCount } });
  res.status(202).json({ campaign: campaignView(row) });
}));

adminEmailRouter.post('/campaigns/:id/cancel', withInstallGuard(async (req, res) => {
  const row = await cancelEmailCampaign(req.params.id);
  await writeAdminAudit({ admin: req.admin, action: 'email.campaign.cancel', targetType: 'emailCampaign', targetId: row.id, newValue: { sentCount: row.sentCount } });
  res.json({ campaign: campaignView(row) });
}));

/* ───────── Log ───────── */
const LOG_STATUSES = ['queued', 'sent', 'failed', 'suppressed', 'delayed', 'delivered', 'opened', 'clicked', 'bounced', 'complained'];
const logQuery = z.object({
  template: z.string().max(40).optional(),
  status: z.enum(LOG_STATUSES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId: z.string().max(80).optional(),
  campaignId: z.string().max(80).optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

adminEmailRouter.get('/logs', withInstallGuard(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const q = logQuery.parse(req.query ?? {});
  const where = {
    ...(q.template ? { templateKey: q.template } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.userId ? { userId: q.userId.trim() } : {}),
    ...(q.campaignId ? { campaignId: q.campaignId } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00+04:00`) } : {}), ...(q.to ? { lt: new Date(new Date(`${q.to}T00:00:00+04:00`).getTime() + DAY) } : {}) } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: q.offset,
      take: q.limit,
      select: { id: true, userId: true, toMasked: true, templateKey: true, category: true, subject: true, status: true, error: true, campaignId: true, createdAt: true, updatedAt: true },
    }),
  ]);
  res.json({ total, logs: rows, statuses: LOG_STATUSES });
}));

/* ───────── Suppressions ───────── */
adminEmailRouter.post('/suppressions/check', withInstallGuard(async (req, res) => {
  const { to } = testSendSchema.parse(req.body ?? {});
  const row = await prisma.emailSuppression.findUnique({ where: { toHash: hashEmail(to) } });
  res.json({ suppressed: Boolean(row), reason: row?.reason || null, since: row?.createdAt || null });
}));

adminEmailRouter.post('/suppressions/remove', withInstallGuard(async (req, res) => {
  const { to } = testSendSchema.parse(req.body ?? {});
  const toHash = hashEmail(to);
  const { count } = await prisma.emailSuppression.deleteMany({ where: { toHash } });
  if (count) await writeAdminAudit({ admin: req.admin, action: 'email.suppression.remove', targetType: 'emailSuppression', targetId: toHash.slice(0, 16), newValue: { removed: true } });
  res.json({ removed: count > 0 });
}));
