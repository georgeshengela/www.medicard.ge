import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import {
  CAMPAIGN_VARS,
  DEFAULT_TEMPLATES,
  applyEmailWebhookEvent,
  createResendTransport,
  hashEmail,
  isDeliverableEmail,
  maskEmail,
  mergeTemplate,
  processEmailCampaigns,
  queueAccountDeletedEmail,
  queueWelcomeEmail,
  renderEmail,
  resetEmailCachesForTests,
  runEmailCampaign,
  safeUrl,
  sendEmail,
  sendPasswordResetCode,
  signSvixPayload,
  signUnsubscribeToken,
  suppressionReason,
  validateTemplateVars,
  verifySvixSignature,
  verifyUnsubscribeToken,
  isSendableRecipient,
} from './email/index.js';
import { ALLOWED_USER_COLUMNS, emailStatements } from '../../scripts/install-email.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ───────── Fakes ───────── */
function fakeDb({ templates = [], suppressed = [], campaigns = [] } = {}) {
  const logs = [];
  const sup = new Set(suppressed);
  const camps = campaigns.map((c) => ({ ...c }));
  const campaignUpdates = [];
  return {
    logs,
    sup,
    camps,
    campaignUpdates,
    emailTemplate: { findMany: async () => templates },
    emailSuppression: {
      findUnique: async ({ where }) => (sup.has(where.toHash) ? { toHash: where.toHash } : null),
      findMany: async ({ where }) => [...sup].filter((h) => where.toHash.in.includes(h)).map((toHash) => ({ toHash })),
      upsert: async ({ where, create }) => { sup.add(where.toHash); return create; },
    },
    emailLog: {
      create: async ({ data }) => {
        if (data.idempotencyKey && logs.some((l) => l.idempotencyKey === data.idempotencyKey)) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
        const row = { ...data };
        logs.push(row);
        return row;
      },
      createManyAndReturn: async ({ data }) => {
        const out = [];
        for (const d of data) {
          if (logs.some((l) => l.idempotencyKey === d.idempotencyKey)) continue;
          logs.push({ ...d });
          out.push({ id: d.id, userId: d.userId });
        }
        return out;
      },
      update: async ({ where, data }) => { const r = logs.find((l) => l.id === where.id); Object.assign(r, data); return r; },
      updateMany: async ({ where, data }) => { for (const l of logs) if (where.id.in.includes(l.id)) Object.assign(l, data); return { count: 1 }; },
      findFirst: async ({ where }) => logs.find((l) => l.providerId === where.providerId) || null,
    },
    emailCampaign: {
      findUnique: async ({ where }) => camps.find((c) => c.id === where.id) || null,
      findMany: async ({ where }) => camps.filter((c) => where.status.in.includes(c.status)),
      update: async ({ where, data }) => {
        campaignUpdates.push(structuredClone(data));
        const row = camps.find((c) => c.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
}

function fakeTransport({ fail = false, failBatchAt = -1 } = {}) {
  const calls = [];
  const batches = [];
  let n = 0;
  return {
    configured: true,
    calls,
    batches,
    async send(msg, opts) {
      calls.push({ msg, opts });
      if (fail) throw new Error('Resend exploded');
      n += 1;
      return { id: `re_${n}` };
    },
    async sendBatch(messages, opts) {
      batches.push({ messages, opts });
      if (batches.length - 1 === failBatchAt) throw new Error('batch rejected');
      return messages.map(() => { n += 1; return `re_${n}`; });
    },
  };
}

const on = async () => true;
const deps = (db, transport, featureEnabled = on) => ({ db, transport, featureEnabled });
const immediate = { schedule: (fn) => fn() };

beforeEach(() => resetEmailCachesForTests());

/* ───────── Rendering ───────── */
describe('email templates', () => {
  it('escapes variables and admin text, keeps only https/mailto links', () => {
    const r = renderEmail({
      content: {
        subject: 'Hi {{name}}',
        preheader: 'p',
        heading: 'გამარჯობა, {{name}}!',
        body: 'Hello <script>alert(1)</script> **bold** [ok](https://medicard.ge/x) [bad](javascript:alert(1)) [mail](mailto:{{supportEmail}}) [evil]({{name}})',
        ctaLabel: 'Go',
        ctaUrl: 'javascript:alert(1)',
      },
      vars: { name: '<img src=x onerror=alert(1)>', supportEmail: 'support@medicard.ge' },
      allowed: CAMPAIGN_VARS,
    });
    assert.ok(!r.html.includes('<script>'));
    assert.ok(!r.html.includes('<img src=x'));
    assert.ok(r.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(r.html.includes('<strong'));
    assert.ok(r.html.includes('href="https://medicard.ge/x"'));
    assert.ok(r.html.includes('href="mailto:support@medicard.ge"'));
    assert.ok(!/href="javascript/i.test(r.html));
    assert.ok(!r.html.includes('>Go</a>'), 'CTA with an unsafe URL is dropped');
    assert.equal(r.subject, 'Hi <img src=x onerror=alert(1)>', 'subject is plain text (not HTML)');
  });

  it('drops variables outside the allow-list', () => {
    const r = renderEmail({ content: { subject: '{{name}} {{code}}', body: 'x {{code}} y' }, vars: { name: 'ნინო', code: '123456' }, allowed: ['name'] });
    assert.equal(r.subject, 'ნინო');
    assert.ok(!r.html.includes('123456'));
    assert.ok(!r.text.includes('123456'));
  });

  it('renders lists, the code box and a plain-text alternative', () => {
    const t = DEFAULT_TEMPLATES.password_reset;
    const r = renderEmail({ content: t, vars: { name: 'ნინო', code: '482913', minutes: '10', supportEmail: 'support@medicard.ge' }, allowed: t.vars });
    assert.ok(r.html.includes('482913'));
    assert.ok(r.html.includes('mc-code'));
    assert.ok(r.text.includes('482913'));
    assert.ok(!r.text.includes('<'));
    assert.ok(!r.subject.includes('482913'), 'the code never goes into the subject (it is logged)');
    const w = renderEmail({ content: DEFAULT_TEMPLATES.welcome, vars: { name: 'ნინო', appUrl: 'https://medicard.ge', supportEmail: 'support@medicard.ge', appStoreUrl: 'https://medicard.ge/#download', playStoreUrl: 'https://medicard.ge/#download' }, allowed: DEFAULT_TEMPLATES.welcome.vars });
    assert.ok(w.html.includes('<ul'));
    assert.equal((w.html.match(/<li /g) || []).length, 3);
    assert.ok(w.text.includes('• '));
    assert.ok(w.html.includes('https://medicard.ge/icon.png'));
    assert.ok(w.html.includes('ეს სერვისული წერილია'));
    assert.ok(!w.html.includes('გამოწერის გაუქმება'), 'transactional mail has no unsubscribe link');
  });

  it('marketing mail carries the unsubscribe link in html and text', () => {
    const r = renderEmail({ content: { subject: 's', body: 'b' }, vars: {}, allowed: CAMPAIGN_VARS, category: 'marketing', unsubscribeUrl: 'https://medicard.ge/unsubscribe?t=abc' });
    assert.ok(r.html.includes('href="https://medicard.ge/unsubscribe?t=abc"'));
    assert.ok(r.text.includes('https://medicard.ge/unsubscribe?t=abc'));
  });

  it('validates the variable allow-list and required variables', () => {
    assert.deepEqual(validateTemplateVars({ subject: '{{name}}', body: '{{weight}}' }, { vars: CAMPAIGN_VARS }).unknown, ['weight']);
    const reset = DEFAULT_TEMPLATES.password_reset;
    assert.deepEqual(validateTemplateVars({ subject: 'x', body: 'no code' }, { vars: reset.vars, required: reset.required }).missing, ['code']);
    for (const t of Object.values(DEFAULT_TEMPLATES)) assert.ok(validateTemplateVars(t, { vars: t.vars, required: t.required }).ok, t.key);
  });

  it('merges DB overrides over code defaults', () => {
    const m = mergeTemplate('welcome', { key: 'welcome', enabled: false, subject: 'ახალი', body: null });
    assert.equal(m.subject, 'ახალი');
    assert.equal(m.body, DEFAULT_TEMPLATES.welcome.body);
    assert.equal(m.enabled, false);
    assert.equal(m.overridden, true);
    assert.equal(safeUrl('http://x.ge'), '');
    assert.equal(safeUrl('https://x.ge/a?b=1'), 'https://x.ge/a?b=1');
  });

  it('addresses: synthetic phone logins are not mailable, masks hide the local part', () => {
    assert.equal(isDeliverableEmail('995599123456@phone.medicard.ge'), false);
    assert.equal(isDeliverableEmail('Nino@Gmail.com'), true);
    assert.equal(maskEmail('Giorgi@gmail.com'), 'g***@gmail.com');
    assert.equal(hashEmail(' A@B.ge '), hashEmail('a@b.ge'));
  });
});

/* ───────── Sending ───────── */
describe('email sending', () => {
  it('welcome goes out once per user ever', async () => {
    const db = fakeDb();
    const transport = fakeTransport();
    const user = { id: 'u1', email: 'nino@example.com', fullName: 'ნინო ბერიძე' };
    queueWelcomeEmail(user, deps(db, transport), immediate);
    const first = await queueWelcomeEmail.lastRun;
    queueWelcomeEmail(user, deps(db, transport), immediate);
    const second = await queueWelcomeEmail.lastRun;
    assert.equal(first.status, 'sent');
    assert.deepEqual([second.status, second.reason], ['skipped', 'duplicate']);
    assert.equal(transport.calls.length, 1);
    assert.equal(transport.calls[0].opts.idempotencyKey, 'welcome:u1');
    assert.equal(transport.calls[0].msg.replyTo, 'support@medicard.ge');
    assert.ok(transport.calls[0].msg.html.includes('ნინო'));
    const log = db.logs[0];
    assert.equal(log.status, 'sent');
    assert.equal(log.toMasked, 'n***@example.com');
    assert.equal(log.toHash, hashEmail('nino@example.com'));
    assert.ok(!JSON.stringify(db.logs).includes('nino@example.com'), 'no full address in the log');
  });

  it('sign-up is never blocked: a throwing Resend is captured, nothing rejects', async () => {
    const db = fakeDb();
    const scheduled = [];
    const accepted = queueWelcomeEmail({ id: 'u2', email: 'a@example.com', fullName: 'A' }, deps(db, fakeTransport({ fail: true })), { schedule: (fn) => scheduled.push(fn) });
    assert.equal(accepted, true);
    assert.equal(db.logs.length, 0, 'nothing runs before the response (scheduled for later)');
    scheduled.forEach((fn) => fn());
    const result = await queueWelcomeEmail.lastRun;
    assert.equal(result.status, 'failed');
    assert.equal(db.logs[0].status, 'failed');
    assert.match(db.logs[0].error, /Resend exploded/);
  });

  it('welcome skips phone-only accounts and a missing API key without throwing', async () => {
    assert.equal(queueWelcomeEmail({ id: 'u3', email: '995599000000@phone.medicard.ge' }, {}, immediate), false);
    const db = fakeDb();
    queueWelcomeEmail({ id: 'u4', email: 'b@example.com' }, deps(db, { configured: false }), immediate);
    assert.deepEqual(await queueWelcomeEmail.lastRun, { status: 'skipped', reason: 'not_configured' });
    assert.equal(db.logs.length, 0);
  });

  it('suppressed addresses get nothing, transactional included', async () => {
    const db = fakeDb({ suppressed: [hashEmail('dead@example.com')] });
    const transport = fakeTransport();
    const r = await sendEmail({ to: 'dead@example.com', templateKey: 'account_deleted' }, deps(db, transport));
    assert.deepEqual([r.status, r.reason], ['skipped', 'suppressed']);
    const reset = await sendPasswordResetCode({ to: 'dead@example.com', code: '123456', fullName: 'X' }, deps(db, transport));
    assert.equal(reset.reason, 'suppressed');
    assert.equal(transport.calls.length, 0);
    assert.ok(db.logs.every((l) => l.status === 'suppressed'));
  });

  it('kill switch and per-template switch stop sending; password reset reports it', async () => {
    const off = async () => false;
    const db = fakeDb({ templates: [{ key: 'welcome', enabled: false }] });
    const transport = fakeTransport();
    assert.equal((await sendEmail({ to: 'c@example.com', templateKey: 'account_deleted' }, deps(db, transport, off))).reason, 'disabled');
    assert.equal((await sendEmail({ to: 'c@example.com', templateKey: 'welcome' }, deps(db, transport))).reason, 'template_disabled');
    await assert.rejects(sendPasswordResetCode({ to: 'c@example.com', code: '1', fullName: '' }, deps(db, transport, off)), { code: 'EMAIL_DISABLED' });
    assert.equal(transport.calls.length, 0);
  });

  it('password reset keeps its contract: dev-log without a key, throws on provider failure', async () => {
    assert.deepEqual(await sendPasswordResetCode({ to: 'd@example.com', code: '111111' }, { transport: { configured: false } }), { id: 'dev-log' });
    const db = fakeDb();
    await assert.rejects(sendPasswordResetCode({ to: 'd@example.com', code: '111111' }, deps(db, fakeTransport({ fail: true }))), /Resend exploded/);
    const transport = fakeTransport();
    const ok = await sendPasswordResetCode({ to: 'd@example.com', code: '222222', fullName: 'ნინო' }, deps(fakeDb(), transport));
    assert.equal(ok.id, 're_1');
    assert.ok(transport.calls[0].msg.html.includes('222222'));
    assert.ok(transport.calls[0].msg.text.includes('222222'));
  });

  it('account deletion confirmation is not linked to the deleted user row', async () => {
    const db = fakeDb();
    queueAccountDeletedEmail({ userId: 'gone', email: 'e@example.com', fullName: 'E' }, deps(db, fakeTransport()), immediate);
    assert.equal((await queueAccountDeletedEmail.lastRun).status, 'sent');
    assert.equal(db.logs[0].userId, null);
    assert.equal(db.logs[0].idempotencyKey, 'account_deleted:gone');
  });

  it('transport backs off on 429 and sends the Idempotency-Key', async () => {
    const seen = [];
    const sleeps = [];
    let n = 0;
    const fetchImpl = async (url, init) => {
      seen.push({ url, key: init.headers['Idempotency-Key'] });
      n += 1;
      if (n === 1) return { status: 429, ok: false, headers: { get: () => '2' }, json: async () => ({}) };
      return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ id: 'abc' }) };
    };
    const t = createResendTransport({ apiKey: 're_test', fetchImpl, sleep: async (ms) => { sleeps.push(ms); } });
    assert.deepEqual(await t.send({ from: 'f', to: 'x@example.com', subject: 's', html: 'h', text: 't' }, { idempotencyKey: 'k1' }), { id: 'abc' });
    assert.deepEqual(sleeps, [2000]);
    assert.equal(seen.length, 2);
    assert.ok(seen.every((s) => s.key === 'k1'));
  });
});

/* ───────── Webhook ───────── */
describe('resend webhook', () => {
  const secret = `whsec_${Buffer.from('super-secret-key-for-tests').toString('base64')}`;
  const payload = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
  const now = Date.UTC(2026, 8, 28, 10);
  const ts = String(Math.floor(now / 1000));
  const headers = (sig, t = ts) => ({ 'svix-id': 'msg_1', 'svix-timestamp': t, 'svix-signature': sig });

  it('accepts a valid signature and rejects invalid, stale or missing ones', () => {
    const sig = `v1,${signSvixPayload({ secret, id: 'msg_1', timestamp: ts, payload })}`;
    assert.deepEqual(verifySvixSignature({ secret, headers: headers(`v0,xx ${sig}`), payload, now }), { ok: true });
    assert.equal(verifySvixSignature({ secret, headers: headers(sig), payload: `${payload} `, now }).ok, false);
    assert.equal(verifySvixSignature({ secret, headers: headers('v1,AAAA'), payload, now }).reason, 'mismatch');
    assert.equal(verifySvixSignature({ secret, headers: headers(sig), payload, now: now + 10 * 60 * 1000 }).reason, 'stale');
    assert.equal(verifySvixSignature({ secret, headers: {}, payload, now }).reason, 'missing_headers');
    assert.equal(verifySvixSignature({ secret: '', headers: headers(sig), payload, now }).reason, 'no_secret');
  });

  it('the endpoint refuses everything while RESEND_WEBHOOK_SECRET is unset', async () => {
    const { env } = await import('../config/env.js');
    const saved = env.RESEND_WEBHOOK_SECRET;
    env.RESEND_WEBHOOK_SECRET = '';
    const { emailWebhookRouter } = await import('../routes/email.routes.js');
    const app = express();
    app.use('/api/email', emailWebhookRouter);
    const server = app.listen(0);
    try {
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/api/email/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
      assert.equal(res.status, 503);
      env.RESEND_WEBHOOK_SECRET = secret;
      const bad = await fetch(`http://127.0.0.1:${port}/api/email/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers('v1,AAAA', String(Math.floor(Date.now() / 1000))) }, body: payload });
      assert.equal(bad.status, 401);
    } finally {
      env.RESEND_WEBHOOK_SECRET = saved;
      server.close();
    }
  });

  it('updates status forward only and suppresses hard bounces and complaints', async () => {
    const db = fakeDb();
    db.logs.push({ id: 'l1', providerId: 're_1', status: 'sent', toHash: hashEmail('x@example.com') });
    await applyEmailWebhookEvent({ type: 'email.clicked', data: { email_id: 're_1' } }, { db });
    await applyEmailWebhookEvent({ type: 'email.delivered', data: { email_id: 're_1' } }, { db });
    assert.equal(db.logs[0].status, 'clicked');
    await applyEmailWebhookEvent({ type: 'email.bounced', data: { email_id: 're_2', to: ['soft@example.com'], bounce: { type: 'Transient' } } }, { db });
    assert.equal(db.sup.size, 0);
    await applyEmailWebhookEvent({ type: 'email.bounced', data: { email_id: 're_1', to: ['x@example.com'], bounce: { type: 'Permanent', message: 'no mailbox' } } }, { db });
    assert.equal(db.logs[0].status, 'bounced');
    assert.ok(db.sup.has(hashEmail('x@example.com')));
    await applyEmailWebhookEvent({ type: 'email.complained', data: { email_id: 're_9', to: ['angry@example.com'] } }, { db });
    assert.ok(db.sup.has(hashEmail('angry@example.com')));
    assert.equal(suppressionReason({ type: 'email.opened' }), null);
    assert.deepEqual(await applyEmailWebhookEvent({ type: 'contact.created', data: {} }, { db }), { ignored: true });
  });
});

/* ───────── Unsubscribe ───────── */
describe('unsubscribe token', () => {
  it('round-trips and rejects tampering', () => {
    const token = signUnsubscribeToken('3f2c1a9e-0000-4000-8000-000000000001', { secret: 'a'.repeat(32) });
    assert.equal(verifyUnsubscribeToken(token, { secret: 'a'.repeat(32) }), '3f2c1a9e-0000-4000-8000-000000000001');
    assert.equal(verifyUnsubscribeToken(token, { secret: 'b'.repeat(32) }), null);
    const other = signUnsubscribeToken('other-user', { secret: 'a'.repeat(32) });
    assert.equal(verifyUnsubscribeToken(`${token.split('.')[0]}.${other.split('.')[1]}`, { secret: 'a'.repeat(32) }), null);
    assert.equal(verifyUnsubscribeToken('garbage', { secret: 'a'.repeat(32) }), null);
    assert.equal(verifyUnsubscribeToken('', { secret: 'a'.repeat(32) }), null);
  });
});

/* ───────── Campaign worker ───────── */
function recipients(n, extra = []) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: `u${String(i).padStart(4, '0')}`, email: `user${i}@example.com`, fullName: `User ${i}`, status: 'ACTIVE', optIn: true }));
  return [...rows, ...extra].sort((a, b) => (a.id < b.id ? -1 : 1));
}
const loaderFor = (rows, calls = []) => async ({ cursor, limit }) => {
  calls.push(cursor);
  return rows.filter((r) => !cursor || r.id > cursor).slice(0, limit);
};
const campaignRow = (over = {}) => ({
  id: 'c1', subject: 'სიახლე', preheader: '', heading: 'გამარჯობა, {{name}}', body: 'ტექსტი', ctaLabel: '', ctaUrl: '',
  segment: 'ALL_OPTED_IN', status: 'queued', targetCount: 0, sentCount: 0, failedCount: 0, createdAt: new Date(),
  data: { progress: { v: 1, asOf: new Date().toISOString(), cursor: null } }, ...over,
});

describe('email campaign worker', () => {
  it('sends in batches of 100 with unsubscribe headers and saves progress', async () => {
    const db = fakeDb({ campaigns: [campaignRow()] });
    const transport = fakeTransport();
    const sleeps = [];
    const result = await runEmailCampaign(db.camps[0], { db, transport, loadRecipients: loaderFor(recipients(250)), featureEnabled: on, sleep: async (ms) => sleeps.push(ms) });
    assert.equal(result.done, true);
    assert.deepEqual(transport.batches.map((b) => b.messages.length), [100, 100, 50]);
    assert.equal(db.camps[0].status, 'sent');
    assert.equal(db.camps[0].sentCount, 250);
    assert.equal(db.camps[0].data.progress.cursor, 'u0249');
    assert.equal(db.camps[0].data.progress.done, true);
    assert.equal(sleeps.length, 3);
    const m = transport.batches[0].messages[0];
    assert.match(m.headers['List-Unsubscribe'], /^<https:\/\/medicard\.ge\/unsubscribe\?t=/);
    assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.ok(m.html.includes('გამოწერის გაუქმება'));
    assert.ok(db.logs.every((l) => l.status === 'sent' && l.providerId && l.category === 'marketing'));
    assert.equal(new Set(db.logs.map((l) => l.idempotencyKey)).size, 250);
  });

  it('mails only opted-in, active, deliverable, non-suppressed people', async () => {
    const extra = [
      { id: 'u9001', email: 'nooptin@example.com', fullName: 'N', status: 'ACTIVE', optIn: false },
      { id: 'u9002', email: 'blocked@example.com', fullName: 'B', status: 'BLOCKED', optIn: true },
      { id: 'u9003', email: '995599000000@phone.medicard.ge', fullName: 'P', status: 'ACTIVE', optIn: true },
      { id: 'u9004', email: 'bounced@example.com', fullName: 'S', status: 'ACTIVE', optIn: true },
    ];
    const db = fakeDb({ campaigns: [campaignRow()], suppressed: [hashEmail('bounced@example.com')] });
    const transport = fakeTransport();
    const result = await runEmailCampaign(db.camps[0], { db, transport, loadRecipients: loaderFor(recipients(3, extra)), featureEnabled: on, sleep: async () => {} });
    const sentTo = transport.batches.flatMap((b) => b.messages.map((x) => x.to));
    assert.deepEqual(sentTo.sort(), ['user0@example.com', 'user1@example.com', 'user2@example.com']);
    assert.equal(result.skipped, 4);
    assert.equal(isSendableRecipient(extra[0]), false);
  });

  it('resumes from the saved cursor after a restart without mailing anyone twice', async () => {
    const rows = recipients(250);
    const db = fakeDb({ campaigns: [campaignRow()] });
    const transport = fakeTransport();
    let leases = 0;
    const paused = await runEmailCampaign(db.camps[0], { db, transport, loadRecipients: loaderFor(rows), featureEnabled: on, sleep: async () => {}, keepLease: async () => (leases += 1) <= 1 });
    assert.equal(paused.paused, 'lease');
    assert.equal(db.camps[0].data.progress.cursor, 'u0099');
    const cursors = [];
    const done = await runEmailCampaign(db.camps[0], { db, transport, loadRecipients: loaderFor(rows, cursors), featureEnabled: on, sleep: async () => {} });
    assert.equal(done.done, true);
    assert.equal(cursors[0], 'u0099');
    const all = transport.batches.flatMap((b) => b.messages.map((x) => x.to));
    assert.equal(all.length, 250);
    assert.equal(new Set(all).size, 250);
    assert.equal(db.camps[0].sentCount, 250);
  });

  it('stops between batches when cancelled, pauses while the kill switch is off', async () => {
    const db = fakeDb({ campaigns: [campaignRow()] });
    const transport = fakeTransport();
    let batches = 0;
    const loader = async (args) => {
      batches += 1;
      if (batches === 2) db.camps[0].status = 'cancelled';
      return loaderFor(recipients(500))(args);
    };
    const result = await runEmailCampaign(db.camps[0], { db, transport, loadRecipients: loader, featureEnabled: on, sleep: async () => {} });
    assert.equal(result.cancelled, true);
    assert.ok(transport.batches.length <= 2);
    assert.equal(db.camps[0].status, 'cancelled');

    const db2 = fakeDb({ campaigns: [campaignRow({ id: 'c2' })] });
    const off = await runEmailCampaign(db2.camps[0], { db: db2, transport, loadRecipients: loaderFor(recipients(5)), featureEnabled: async () => false, sleep: async () => {} });
    assert.equal(off.paused, 'disabled');
    assert.equal(db2.camps[0].status, 'sending', 'stays resumable');
  });

  it('a failed batch is counted and logged, the rest continues', async () => {
    const db = fakeDb({ campaigns: [campaignRow()] });
    const transport = fakeTransport({ failBatchAt: 0 });
    await runEmailCampaign(db.camps[0], { db, transport, loadRecipients: loaderFor(recipients(150)), featureEnabled: on, sleep: async () => {} });
    assert.equal(db.camps[0].failedCount, 100);
    assert.equal(db.camps[0].sentCount, 50);
    assert.equal(db.logs.filter((l) => l.status === 'failed').length, 100);
    assert.equal(db.camps[0].status, 'sent');
  });

  it('processEmailCampaigns needs the lease', async () => {
    const db = fakeDb({ campaigns: [campaignRow()] });
    assert.deepEqual(await processEmailCampaigns({ db, lease: async () => false }), { skipped: 'lease' });
    const transport = fakeTransport();
    const r = await processEmailCampaigns({ db, lease: async () => true, transport, loadRecipients: loaderFor(recipients(3)), featureEnabled: on, sleep: async () => {} });
    assert.deepEqual(r, { processed: 1 });
    assert.equal(transport.batches.length, 1);
  });
});

/* ───────── Install script ───────── */
describe('email install script', () => {
  it('ships only additive statements', () => {
    const statements = emailStatements(read('../../prisma/20260928-email.sql'));
    assert.ok(statements.length >= 10);
    for (const col of ALLOWED_USER_COLUMNS) assert.ok(statements.includes(col));
    assert.throws(() => emailStatements('DROP TABLE "EmailLog";'));
    assert.throws(() => emailStatements('CREATE TABLE IF NOT EXISTS "User" (id TEXT);'));
    assert.throws(() => emailStatements('ALTER TABLE "User" DROP COLUMN "email";'));
    assert.throws(() => emailStatements('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT true;'));
    assert.throws(() => emailStatements('DELETE FROM "EmailLog";'));
    const pkg = JSON.parse(read('../../../package.json'));
    // release runs `npm run db:install` (see installChain.test.js); the chain holds the script.
    assert.match(pkg.scripts['db:install'], /install-email\.mjs/);
    const schema = read('../../prisma/schema.prisma');
    for (const model of ['EmailTemplate', 'EmailLog', 'EmailSuppression', 'EmailCampaign']) assert.match(schema, new RegExp(`^model ${model} \\{`, 'm'));
    assert.match(schema, /emailMarketingOptIn\s+Boolean\s+@default\(false\) @ignore/);
  });
});
