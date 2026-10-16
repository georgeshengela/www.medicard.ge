/**
 * Admin #/influencers (/api/admin/influencers): influencers with socials, photo and status; per-influencer numbers and
 * registrations (masked accounts, no health data); the payout queue; flagged registrations; program settings.
 * INFLUENCERS_VIEW reads, INFLUENCERS_MANAGE decides, INFLUENCER_PAYOUTS handles money. Every change is audited.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { adminHasCapability, requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import * as store from '../lib/influencer/store.js';
import { sendInfluencerPhoto } from '../lib/influencer/photo.js';
import { formatGel, maskIban } from '../lib/influencer/rules.js';
import { emailInfluencer } from './promo.routes.js';

export const adminInfluencersRouter = Router();
adminInfluencersRouter.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const view = requireAdminCapability('INFLUENCERS_VIEW');
const manage = requireAdminCapability('INFLUENCERS_MANAGE');
const payouts = requireAdminCapability('INFLUENCER_PAYOUTS');

const STATUS_NOTICE = {
  ACTIVE: {
    title: 'ანგარიში დადასტურდა', titleEn: 'Your account is approved',
    message: 'შენი ინფლუენსერის ანგარიში დადასტურებულია. კოდი მუშაობს, რეგისტრაციები ითვლება და ბალანსის გატანაც შეგიძლია, როცა მინიმალურ თანხას მიაღწევ.',
    messageEn: 'Your influencer account is approved. Your code works, registrations count, and you can request a payout once you reach the minimum.',
  },
  SUSPENDED: {
    title: 'ანგარიში შეჩერდა', titleEn: 'Your account is paused',
    message: 'შენი ინფლუენსერის ანგარიში დროებით შეჩერებულია: კოდი ახალ რეგისტრაციებს არ იღებს და გატანა შეჩერებულია. უკვე დათვლილი თანხა რჩება.',
    messageEn: 'Your influencer account is paused for now: your code takes no new registrations and payouts are on hold. Money already counted stays.',
  },
  BLOCKED: {
    title: 'ანგარიში დაიბლოკა', titleEn: 'Your account is blocked',
    message: 'შენი ინფლუენსერის ანგარიში დაიბლოკა პროგრამის წესების დარღვევის გამო. თუ ფიქრობ, რომ შეცდომაა, უპასუხე ამ წერილს.',
    messageEn: 'Your influencer account was blocked for breaking the program rules. If you think this is a mistake, reply to this email.',
  },
};

adminInfluencersRouter.get('/', view, asyncHandler(async (req, res) => {
  res.json(await store.adminOverview({ status: String(req.query.status || 'ALL').toUpperCase(), q: String(req.query.q || '').slice(0, 80) }));
}));

adminInfluencersRouter.get('/settings', view, asyncHandler(async (_req, res) => {
  res.json({ config: await store.loadConfig({ fresh: true }) });
}));

adminInfluencersRouter.put('/settings', manage, asyncHandler(async (req, res) => {
  const { previous, config } = await store.saveConfig(req.body?.config ?? req.body ?? {}, { admin: req.admin });
  await writeAdminAudit({ admin: req.admin, action: 'INFLUENCER_SETTINGS', targetType: 'InfluencerConfig', targetId: '1', previousValue: previous, newValue: config });
  res.json({ config });
}));

adminInfluencersRouter.get('/flagged', view, asyncHandler(async (_req, res) => {
  res.json({ referrals: await store.adminFlagged() });
}));

adminInfluencersRouter.post('/referrals/:id/decide', manage, asyncHandler(async (req, res) => {
  const { action, note } = z.object({ action: z.enum(['approve', 'reject', 'reverse']), note: z.string().trim().max(300).optional().default('') }).parse(req.body ?? {});
  const result = await store.adminDecideReferral(String(req.params.id), action, note, { admin: req.admin });
  await writeAdminAudit({ admin: req.admin, action: `INFLUENCER_REFERRAL_${action.toUpperCase()}`, targetType: 'InfluencerReferral', targetId: String(req.params.id), previousValue: { status: result.before }, newValue: { action, note, influencerId: result.influencerId } });
  res.json({ ok: true });
}));

adminInfluencersRouter.get('/payouts', view, asyncHandler(async (req, res) => {
  const status = ['OPEN', 'ALL', 'REQUESTED', 'APPROVED', 'PAID', 'REJECTED'].includes(String(req.query.status).toUpperCase()) ? String(req.query.status).toUpperCase() : 'OPEN';
  const data = await store.adminPayouts({ status });
  // Bank details only for admins who handle money.
  if (!adminHasCapability(req.admin, 'INFLUENCER_PAYOUTS')) {
    data.payouts = data.payouts.map((p) => ({ ...p, account: { iban: maskIban(p.account?.iban), bank: p.account?.bank, holder: p.account?.holder, payeeType: p.account?.payeeType } }));
  }
  res.json(data);
}));

const PAYOUT_NOTICE = {
  paid: (amount, reference) => ({
    title: 'თანხა ჩაგერიცხა', titleEn: 'Your payout is on its way',
    message: `${formatGel(amount)} გადმოგერიცხა შენს ანგარიშზე${reference ? ` (გადარიცხვის ნომერი: ${reference})` : ''}. ბანკიდან ჩარიცხვას შეიძლება 1–2 სამუშაო დღე დასჭირდეს.`,
    messageEn: `${formatGel(amount)} has been sent to your account${reference ? ` (transfer reference: ${reference})` : ''}. The bank may take 1–2 working days.`,
  }),
  reject: (amount, reason) => ({
    title: 'გატანის მოთხოვნა უარყოფილია', titleEn: 'Your payout request was declined',
    message: `${formatGel(amount)}-ის გატანის მოთხოვნა უარყოფილია. მიზეზი: ${reason}. თანხა ისევ შენს ბალანსზეა — შეასწორე და ხელახლა მოითხოვე.`,
    messageEn: `Your ${formatGel(amount)} payout request was declined. Reason: ${reason}. The money is back on your balance — fix it and request again.`,
  }),
};

adminInfluencersRouter.post('/payouts/:id/:action', payouts, asyncHandler(async (req, res) => {
  const action = String(req.params.action);
  if (!['approve', 'paid', 'reject'].includes(action)) return res.status(404).json({ error: 'უცნობი მოქმედება.' });
  const body = z.object({ reference: z.string().trim().max(120).optional().default(''), reason: z.string().trim().max(500).optional().default('') }).parse(req.body ?? {});
  if (action === 'reject' && body.reason.length < 3) return res.status(400).json({ error: 'მიუთითე მიზეზი — ინფლუენსერი მას ნახავს.' });
  const result = await store.decidePayout(String(req.params.id), { action, reference: body.reference, reason: body.reason }, { admin: req.admin });
  await writeAdminAudit({ admin: req.admin, action: `INFLUENCER_PAYOUT_${action.toUpperCase()}`, targetType: 'InfluencerPayout', targetId: String(req.params.id), previousValue: { status: result.before }, newValue: { action, amount: result.amount, reference: body.reference || undefined, reason: body.reason || undefined } });
  if (action !== 'approve') {
    const influencer = await store.getInfluencer(result.influencerId);
    if (influencer) void emailInfluencer(influencer, action === 'paid' ? PAYOUT_NOTICE.paid(result.amount, body.reference) : PAYOUT_NOTICE.reject(result.amount, body.reason));
  }
  res.json({ ok: true });
}));

adminInfluencersRouter.get('/:id', view, asyncHandler(async (req, res) => {
  const data = await store.adminInfluencerDetail(String(req.params.id));
  if (!data) return res.status(404).json({ error: 'ინფლუენსერი ვერ მოიძებნა.' });
  if (!adminHasCapability(req.admin, 'INFLUENCER_PAYOUTS')) {
    data.payouts = data.payouts.map((p) => ({ ...p, account: { ...p.account, iban: maskIban(p.account?.iban) } }));
  }
  res.json(data);
}));

adminInfluencersRouter.get('/:id/photo', view, asyncHandler(async (req, res) => {
  const [row] = await store.adminPhotoKey(String(req.params.id));
  if (!row?.photoKey) return res.status(404).json({ error: 'ფოტო ვერ მოიძებნა.' });
  return sendInfluencerPhoto(res, row.photoKey);
}));

adminInfluencersRouter.post('/:id/status', manage, asyncHandler(async (req, res) => {
  const { status, reason, notify } = z.object({
    status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED']),
    reason: z.string().trim().max(500).optional().default(''),
    notify: z.boolean().optional().default(true),
  }).parse(req.body ?? {});
  if ((status === 'SUSPENDED' || status === 'BLOCKED') && reason.length < 3) return res.status(400).json({ error: 'მიუთითე მიზეზი (ჩანს ადმინში და ინფლუენსერის პორტალზე).' });
  const result = await store.adminSetStatus(String(req.params.id), status, reason);
  await writeAdminAudit({ admin: req.admin, action: 'INFLUENCER_STATUS', targetType: 'Influencer', targetId: String(req.params.id), previousValue: { status: result.before }, newValue: { status, reason: reason || undefined } });
  if (notify && result.before !== status && STATUS_NOTICE[status]) {
    const influencer = await store.getInfluencer(String(req.params.id));
    const notice = STATUS_NOTICE[status];
    if (influencer) void emailInfluencer(influencer, reason && status !== 'ACTIVE' ? { ...notice, message: `${notice.message} მიზეზი: ${reason}`, messageEn: `${notice.messageEn} Reason: ${reason}` } : notice);
  }
  res.json({ ok: true });
}));

adminInfluencersRouter.patch('/:id/note', manage, asyncHandler(async (req, res) => {
  const { note } = z.object({ note: z.string().trim().max(2000) }).parse(req.body ?? {});
  await store.adminSetNote(String(req.params.id), note);
  await writeAdminAudit({ admin: req.admin, action: 'INFLUENCER_NOTE', targetType: 'Influencer', targetId: String(req.params.id), newValue: { length: note.length } });
  res.json({ ok: true });
}));

adminInfluencersRouter.post('/:id/adjust', payouts, asyncHandler(async (req, res) => {
  const { amount, note } = z.object({ amount: z.number().int(), note: z.string().trim().min(3).max(300) }).parse(req.body ?? {});
  const result = await store.adminAdjust(String(req.params.id), amount, note, { admin: req.admin });
  await writeAdminAudit({ admin: req.admin, action: 'INFLUENCER_ADJUST', targetType: 'Influencer', targetId: String(req.params.id), newValue: { amount: result.amount, note } });
  res.json({ ok: true });
}));
