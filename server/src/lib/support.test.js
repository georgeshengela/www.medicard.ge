// Support inbox (admin #/support). In-memory fakes only — nothing here touches a database.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { sanitizeEmailHtml, htmlToText, safeHref } from './support/sanitize.js';
import {
  buildReplyHeaders,
  isAutoMessage,
  isOwnDomain,
  normalizeSubject,
  parseAddress,
  parseAddressList,
  parseMessageIds,
  replySubject,
  subjectKey,
} from './support/threading.js';
import {
  applyInboundEmailEvent,
  fetchMessageBody,
  linkUserId,
  noticeContent,
  notifyAddress,
  processInboundBodies,
  processSupportNotice,
  purgeOldSupportThreads,
} from './support/inbound.js';
import { renderSupportLetter, renderSupportReply, sendSupportLetter, sendSupportReply, senderForMailbox, snippetSchema, supportSenders, threadPatchSchema, replySchema } from './support/reply.js';
import { isAllowedDownloadUrl } from './support/resendInbound.js';
import { renderEmail, signSvixPayload } from './email/index.js';
import { supportStatements } from '../../scripts/install-support.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ───────── Fake Prisma (only the operators the support code uses) ───────── */
function matches(row, where, tables) {
  for (const [key, cond] of Object.entries(where || {})) {
    if (key === 'OR') { if (!cond.some((w) => matches(row, w, tables))) return false; continue; }
    if (key === 'thread') { if (!matches(tables.threads.find((t) => t.id === row.threadId) || {}, cond, tables)) return false; continue; }
    const v = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
      const cmp = (x) => (x instanceof Date ? x.getTime() : x);
      if ('equals' in cond && (cond.mode === 'insensitive' ? String(v ?? '').toLowerCase() !== String(cond.equals).toLowerCase() : v !== cond.equals)) return false;
      if ('in' in cond && !cond.in.includes(v)) return false;
      if ('not' in cond && (cond.not === null ? v == null : v === cond.not)) return false;
      if ('gte' in cond && !(v != null && cmp(v) >= cmp(cond.gte))) return false;
      if ('gt' in cond && !(v != null && cmp(v) > cmp(cond.gt))) return false;
      if ('lte' in cond && !(v != null && cmp(v) <= cmp(cond.lte))) return false;
      if ('lt' in cond && !(v != null && cmp(v) < cmp(cond.lt))) return false;
      if ('contains' in cond && !String(v ?? '').toLowerCase().includes(String(cond.contains).toLowerCase())) return false;
    } else if ((v ?? null) !== cond && !(v instanceof Date && cond instanceof Date && v.getTime() === cond.getTime())) return false;
  }
  return true;
}
const sortBy = (rows, orderBy) => {
  if (!orderBy) return rows;
  const [[k, dir]] = Object.entries(orderBy);
  return [...rows].sort((a, b) => ((a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (dir === 'desc' ? -1 : 1)));
};

function fakeDb({ users = [] } = {}) {
  const tables = { threads: [], messages: [] };
  const table = (rows, { unique = [] } = {}) => ({
    findUnique: async ({ where }) => rows.find((r) => matches(r, where, tables)) || null,
    findFirst: async ({ where, orderBy } = {}) => sortBy(rows.filter((r) => matches(r, where, tables)), orderBy)[0] || null,
    findMany: async ({ where, orderBy, take, include } = {}) => sortBy(rows.filter((r) => matches(r, where, tables)), orderBy).slice(0, take ?? Infinity).map((r) => (include?.messages
      ? { ...r, messages: tables.messages.filter((m) => m.threadId === r.id && matches(m, include.messages.where, tables)) }
      : r)),
    count: async ({ where } = {}) => rows.filter((r) => matches(r, where, tables)).length,
    create: async ({ data }) => {
      for (const u of unique) if (data[u] != null && rows.some((r) => r[u] === data[u])) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      const row = { ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }) => { const row = rows.find((r) => matches(r, where, tables)); Object.assign(row, data); return row; },
    updateMany: async ({ where, data }) => { const hit = rows.filter((r) => matches(r, where, tables)); hit.forEach((r) => Object.assign(r, data)); return { count: hit.length }; },
    delete: async ({ where }) => { const i = rows.findIndex((r) => matches(r, where, tables)); return rows.splice(i, 1)[0]; },
    deleteMany: async ({ where }) => {
      const gone = rows.filter((r) => matches(r, where, tables));
      for (const g of gone) rows.splice(rows.indexOf(g), 1);
      for (const i of [...tables.messages.keys()].reverse()) if (gone.some((t) => t.id === tables.messages[i].threadId)) tables.messages.splice(i, 1);
      return { count: gone.length };
    },
  });
  const db = {
    tables,
    supportThread: table(tables.threads),
    supportMessage: table(tables.messages, { unique: ['resendId'] }),
    user: table(users),
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

const NOW = new Date('2026-09-28T10:00:00Z');
const received = (id, over = {}) => ({
  type: 'email.received',
  created_at: NOW.toISOString(),
  data: {
    email_id: id,
    created_at: NOW.toISOString(),
    from: 'Nino Beridze <Nino@Example.com>',
    to: ['support@medicard.ge'],
    cc: [],
    bcc: [],
    received_for: [],
    message_id: `<${id}@mail.example.com>`,
    subject: 'აპი არ იხსნება',
    attachments: [{ id: 'att-1', filename: 'screen.png', content_type: 'image/png', content_disposition: 'attachment' }],
    ...over,
  },
});

/* ───────── Sanitizer ───────── */
describe('support sanitizer', () => {
  it('strips scripts, styles, handlers, forms, comments and dangerous links', () => {
    const { html } = sanitizeEmailHtml(`<html><head><title>t</title><style>p{color:red}</style><script>alert(1)</script></head><body>
      <!--[if mso]><p>mso</p><![endif]-->
      <p onclick="steal()" onmouseover="x()" style="color:#333">Hello <b>there</b></p>
      <a href="javascript:alert(1)">js</a> <a href="  https://medicard.ge/x ">ok</a> <a href="data:text/html,x">data</a>
      <form action="https://evil"><input name="p"><button>go</button></form>
      <iframe src="https://evil"></iframe><object data="x"></object><svg><script>1</script></svg>
      <div style="background:url(https://track.example/p)">bg</div><img src=x onerror=alert(1)>
      <custom-tag>unwrapped</custom-tag></body></html>`);
    assert.doesNotMatch(html, /<script|<style|onclick|onmouseover|onerror|<iframe|<object|<form|<input|<button|<svg|javascript:|data:text|url\(|<!--|mso|<title/i);
    assert.match(html, /<p style="color:#333">Hello <b>there<\/b><\/p>/);
    assert.match(html, /<a href="https:\/\/medicard\.ge\/x" target="_blank" rel="noopener noreferrer nofollow">ok<\/a>/);
    assert.match(html, /<a>js<\/a>/);
    assert.match(html, /unwrapped/);
    assert.doesNotMatch(html, /custom-tag/);
  });

  it('removes remote images (pixels silently), keeps inline data images', () => {
    const r = sanitizeEmailHtml('<p>x</p><img src="https://t.example/open.gif" width="1" height="1"><img src="https://cdn.example/logo.png" alt="Logo"><img src="data:image/png;base64,iVBORw0KGgo=" alt="inline">');
    assert.equal(r.blockedImages, 2);
    assert.doesNotMatch(r.html, /t\.example|cdn\.example/);
    assert.match(r.html, /\[სურათი: Logo\]/);
    assert.match(r.html, /src="data:image\/png;base64,iVBORw0KGgo="/);
  });

  it('caps size: drops data images first, then gives up on HTML', () => {
    const big = `<p>hi</p><img src="data:image/png;base64,${'A'.repeat(5000)}">`;
    const r = sanitizeEmailHtml(big, { maxBytes: 1000 });
    assert.equal(r.truncated, true);
    assert.equal(r.html, '<p>hi</p>');
    assert.equal(sanitizeEmailHtml(`<p>${'x'.repeat(3000)}</p>`, { maxBytes: 1000 }).html, null);
    assert.equal(htmlToText('<p>a</p><p>b<br>c</p>'), 'a\nb\nc');
    assert.equal(safeHref('java\tscript:alert(1)'), '');
    assert.equal(safeHref('mailto:a@b.ge'), 'mailto:a@b.ge');
  });
});

/* ───────── Threading helpers ───────── */
describe('support threading helpers', () => {
  it('normalizes Re:/Fwd:/AW:/Re[2]: prefixes and builds reply subjects', () => {
    assert.equal(normalizeSubject('Re: RE: Fwd:  აპი   არ იხსნება'), 'აპი არ იხსნება');
    assert.equal(normalizeSubject('AW: WG: Re[2]: Hello'), 'Hello');
    assert.equal(subjectKey('FW: Hello World'), subjectKey('re: hello world'));
    assert.equal(replySubject('აპი არ იხსნება'), 'Re: აპი არ იხსნება');
    assert.equal(replySubject('Re: already'), 'Re: already');
    assert.equal(replySubject('Fwd: forwarded'), 'Re: forwarded');
    assert.equal(replySubject(''), 'Re: შენი წერილი');
  });

  it('parses addresses and Message-ID lists', () => {
    assert.deepEqual(parseAddress('"Beridze, Nino" <Nino@Example.COM>'), { email: 'nino@example.com', name: 'Beridze, Nino' });
    assert.deepEqual(parseAddress('plain@x.ge'), { email: 'plain@x.ge', name: '' });
    assert.deepEqual(parseAddressList('"A, B" <a@x.ge>, c@y.ge').map((a) => a.email), ['a@x.ge', 'c@y.ge']);
    assert.deepEqual(parseMessageIds('<a@x> <b@y>\r\n <a@x>'), ['<a@x>', '<b@y>']);
    assert.equal(isOwnDomain('support@medicard.ge'), true);
    assert.equal(isOwnDomain('x@mail.medicard.ge'), true);
    assert.equal(isOwnDomain('995555@phone.medicard.ge'), false);
    assert.equal(isOwnDomain('a@notmedicard.ge'), false);
  });

  it('reply headers: In-Reply-To = last Message-ID, References = chain + it (root kept when long)', () => {
    assert.deepEqual(buildReplyHeaders({ messageId: '<3@x>', references: '<1@x> <2@x>', inReplyTo: '<2@x>' }), { 'In-Reply-To': '<3@x>', References: '<1@x> <2@x> <3@x>' });
    assert.deepEqual(buildReplyHeaders({ messageId: '<2@x>', inReplyTo: '<1@x>' }), { 'In-Reply-To': '<2@x>', References: '<1@x> <2@x>' });
    assert.deepEqual(buildReplyHeaders({ messageId: '<1@x>' }), { 'In-Reply-To': '<1@x>', References: '<1@x>' });
    assert.deepEqual(buildReplyHeaders(null), {});
    const long = Array.from({ length: 30 }, (_, i) => `<${i}@x>`).join(' ');
    const h = buildReplyHeaders({ messageId: '<last@x>', references: long });
    const ids = parseMessageIds(h.References);
    assert.equal(ids.length, 20);
    assert.equal(ids[0], '<0@x>');
    assert.equal(ids.at(-1), '<last@x>');
    assert.doesNotMatch(buildReplyHeaders({ messageId: '<1@x>\r\nBcc: evil@x' }).References, /\r|\n/);
  });
});

/* ───────── Webhook → store ───────── */
describe('support inbound webhook', () => {
  it('email.received is idempotent by Resend id and stores metadata only', async () => {
    const db = fakeDb();
    let kicks = 0;
    const kick = () => { kicks += 1; };
    const first = await applyInboundEmailEvent(received('r1'), { db, now: NOW, kick });
    assert.equal(first.stored, true);
    assert.equal(first.newThread, true);
    const again = await applyInboundEmailEvent(received('r1'), { db, now: NOW, kick });
    assert.equal(again.duplicate, true);
    assert.equal(db.tables.messages.length, 1);
    assert.equal(db.tables.threads.length, 1);
    assert.equal(kicks, 1);
    const [t] = db.tables.threads;
    const [m] = db.tables.messages;
    assert.equal(t.counterpartEmail, 'nino@example.com');
    assert.equal(t.counterpartName, 'Nino Beridze');
    assert.equal(t.mailbox, 'support@medicard.ge');
    assert.equal(t.status, 'new');
    assert.equal(t.messageCount, 1);
    assert.equal(m.bodyStatus, 'pending');
    assert.equal(m.messageId, '<r1@mail.example.com>');
    assert.deepEqual(m.attachments.map((a) => [a.id, a.filename]), [['att-1', 'screen.png']]);
    assert.deepEqual(await applyInboundEmailEvent({ type: 'email.received', data: {} }, { db, kick }), { ignored: true, reason: 'no_id' });
  });

  it('threads by sender + normalized subject; other senders get their own thread; replies re-open', async () => {
    const db = fakeDb();
    const kick = () => {};
    const a = await applyInboundEmailEvent(received('r1'), { db, now: NOW, kick });
    await db.supportThread.update({ where: { id: a.threadId }, data: { status: 'waiting', unread: false } });
    const b = await applyInboundEmailEvent(received('r2', { subject: 'Re: აპი არ იხსნება' }), { db, now: new Date(NOW.getTime() + 60_000), kick });
    assert.equal(b.threadId, a.threadId);
    assert.equal(b.newThread, false);
    const t = db.tables.threads[0];
    assert.equal(t.status, 'open');
    assert.equal(t.unread, true);
    assert.equal(t.messageCount, 2);
    const c = await applyInboundEmailEvent(received('r3', { from: 'other@example.com', subject: 'Re: აპი არ იხსნება' }), { db, now: NOW, kick });
    assert.notEqual(c.threadId, a.threadId);
    const d = await applyInboundEmailEvent(received('r4', { subject: 'სხვა თემა' }), { db, now: NOW, kick });
    assert.notEqual(d.threadId, a.threadId);
  });

  it('links a User by case-insensitive email, never a synthetic phone login', async () => {
    const db = fakeDb({ users: [{ id: 'u1', email: 'nino@example.com' }, { id: 'u2', email: '599000000@phone.medicard.ge' }] });
    const r = await applyInboundEmailEvent(received('r1', { from: 'NINO@EXAMPLE.COM' }), { db, now: NOW, kick: () => {} });
    assert.equal(db.tables.threads.find((t) => t.id === r.threadId).userId, 'u1');
    assert.equal(await linkUserId(db, '599000000@phone.medicard.ge'), null);
    assert.equal(await linkUserId(db, 'nobody@example.com'), null);
  });
});

/* ───────── Body fetch ───────── */
describe('support body fetch', () => {
  const client = (impl) => ({ configured: true, getReceived: impl });

  it('stores sanitized bodies, flags auto-replies and re-threads by References', async () => {
    const db = fakeDb();
    const kick = () => {};
    const a = await applyInboundEmailEvent(received('r1'), { db, now: NOW, kick });
    // Reply with a changed subject lands in a new thread until headers are known.
    const b = await applyInboundEmailEvent(received('r2', { subject: 'სრულიად სხვა სათაური' }), { db, now: new Date(NOW.getTime() + 1000), kick });
    assert.notEqual(b.threadId, a.threadId);
    const msg = db.tables.messages.find((m) => m.resendId === 'r2');
    const out = await fetchMessageBody(msg, {
      db,
      now: NOW,
      client: client(async () => ({
        html: '<p onclick="x()">გამარჯობა</p><script>alert(1)</script><img src="https://t.example/p.gif" width="1" height="1">',
        text: null,
        headers: { 'In-Reply-To': '<r1@mail.example.com>', References: '<r1@mail.example.com>' },
        attachments: [],
      })),
    });
    assert.equal(out, 'ok');
    assert.equal(msg.bodyStatus, 'ok');
    assert.equal(msg.htmlBody, '<p>გამარჯობა</p>');
    assert.equal(msg.textBody, 'გამარჯობა');
    assert.equal(msg.isAuto, false);
    assert.equal(msg.threadId, a.threadId, 'moved into the referenced thread');
    assert.equal(db.tables.threads.length, 1, 'the one-message thread is gone');
    assert.equal(db.tables.threads[0].messageCount, 2);
  });

  it('a third party cannot join another person\'s thread with a known Message-ID', async () => {
    const db = fakeDb();
    const kick = () => {};
    const a = await applyInboundEmailEvent(received('r1'), { db, now: NOW, kick });
    const x = await applyInboundEmailEvent(received('rx', { from: 'intruder@evil.example', subject: 'hi' }), { db, now: NOW, kick });
    const msg = db.tables.messages.find((m) => m.resendId === 'rx');
    await fetchMessageBody(msg, { db, now: NOW, client: client(async () => ({ text: 'x', headers: { 'in-reply-to': '<r1@mail.example.com>' } })) });
    assert.equal(msg.threadId, x.threadId);
    assert.notEqual(msg.threadId, a.threadId);
  });

  it('Sending-access key → restricted (metadata only); transient errors back off; auto-replies flagged', async () => {
    const db = fakeDb();
    await applyInboundEmailEvent(received('r1'), { db, now: NOW, kick: () => {} });
    const msg = db.tables.messages[0];
    assert.equal(await fetchMessageBody(msg, { db, now: NOW, client: client(async () => { throw Object.assign(new Error('restricted'), { code: 'RESTRICTED' }); }) }), 'restricted');
    assert.equal(msg.bodyStatus, 'restricted');
    msg.bodyStatus = 'pending';
    assert.equal(await fetchMessageBody(msg, { db, now: NOW, client: client(async () => { throw Object.assign(new Error('down'), { code: 'NETWORK' }); }) }), 'retry');
    assert.equal(msg.bodyStatus, 'pending');
    assert.equal(msg.bodyAttempts, 1);
    assert.ok(msg.bodyNextAt > NOW);
    await fetchMessageBody(msg, { db, now: NOW, client: client(async () => ({ text: 'I am away', headers: { 'Auto-Submitted': 'auto-replied' } })) });
    assert.equal(msg.isAuto, true);
    assert.equal(msg.textBody, 'I am away');
  });
});

describe('support body fetch after adding RESEND_INBOUND_API_KEY', () => {
  it('re-reads rows the sending key could not read, but not rows the inbound key itself refused', async () => {
    const { env } = await import('../config/env.js');
    const saved = env.RESEND_INBOUND_API_KEY;
    const db = fakeDb();
    await applyInboundEmailEvent(received('r1'), { db, now: NOW, kick: () => {} });
    await applyInboundEmailEvent(received('r2', { subject: 'Other' }), { db, now: NOW, kick: () => {} });
    const [m1, m2] = db.tables.messages;
    Object.assign(m1, { bodyStatus: 'restricted', bodyError: 'RESTRICTED', bodyNextAt: null });
    Object.assign(m2, { bodyStatus: 'restricted', bodyError: 'RESTRICTED_INBOUND_KEY', bodyNextAt: null });
    const calls = [];
    try {
      env.RESEND_INBOUND_API_KEY = 're_test_full_access';
      const counts = await processInboundBodies({ db, now: NOW, pause: async () => {}, client: { getReceived: async (id) => { calls.push(id); return { text: 'hello', headers: {} }; } } });
      assert.deepEqual(calls, ['r1']);
      assert.equal(counts.ok, 1);
      assert.equal(m1.bodyStatus, 'ok');
      assert.equal(m2.bodyStatus, 'restricted');
      // A refusal of the dedicated key is recorded as such (not retried every minute).
      m1.bodyStatus = 'pending';
      await fetchMessageBody(m1, { db, now: NOW, client: { getReceived: async () => { throw Object.assign(new Error('403'), { code: 'RESTRICTED' }); } } });
      assert.equal(m1.bodyError, 'RESTRICTED_INBOUND_KEY');
    } finally {
      env.RESEND_INBOUND_API_KEY = saved;
    }
  });
});

/* ───────── Loop protection + owner notice ───────── */
describe('support loop protection and owner notice', () => {
  it('detects auto-replies, lists, daemons and our own domain', () => {
    assert.equal(isAutoMessage({ headers: { 'auto-submitted': 'auto-replied' }, fromEmail: 'a@x.ge' }), true);
    assert.equal(isAutoMessage({ headers: { 'Auto-Submitted': 'no' }, fromEmail: 'a@x.ge' }), false);
    assert.equal(isAutoMessage({ headers: { Precedence: 'bulk' }, fromEmail: 'a@x.ge' }), true);
    assert.equal(isAutoMessage({ headers: { 'X-Autoreply': 'yes' }, fromEmail: 'a@x.ge' }), true);
    assert.equal(isAutoMessage({ headers: { 'List-Id': '<news.x.ge>' }, fromEmail: 'a@x.ge' }), true);
    assert.equal(isAutoMessage({ headers: {}, fromEmail: 'MAILER-DAEMON@google.com' }), true);
    assert.equal(isAutoMessage({ headers: {}, fromEmail: 'no-reply@x.ge' }), true);
    assert.equal(isAutoMessage({ headers: {}, fromEmail: 'noreply@medicard.ge' }), true);
    assert.equal(isAutoMessage({ headers: {}, fromEmail: 'nino@gmail.com' }), false);
  });

  it('never notifies an address on our own domain', () => {
    assert.equal(notifyAddress('support@medicard.ge'), '');
    assert.equal(notifyAddress('owner@x.medicard.ge'), '');
    assert.equal(notifyAddress('not-an-email'), '');
    assert.equal(notifyAddress(' Owner@Gmail.com '), 'owner@gmail.com');
  });

  it('one digest per 10 minutes, subject only, auto and own-domain threads stay quiet', async () => {
    const db = fakeDb();
    const kick = () => {};
    await applyInboundEmailEvent(received('r1', { subject: 'Help [click](https://evil.example)' }), { db, now: NOW, kick });
    await applyInboundEmailEvent(received('r2', { from: 'b@example.com', subject: 'Second' }), { db, now: NOW, kick });
    await applyInboundEmailEvent(received('r3', { from: 'noreply@medicard.ge', subject: 'Bounce' }), { db, now: NOW, kick });
    await applyInboundEmailEvent(received('r4', { from: 'ooo@example.com', subject: 'Away' }), { db, now: NOW, kick });
    for (const m of db.tables.messages) m.bodyStatus = 'ok';
    db.tables.messages.find((m) => m.resendId === 'r4').isAuto = true;

    const sent = [];
    const send = async (msg) => { sent.push(msg); return { status: 'sent' }; };
    assert.deepEqual(await processSupportNotice({ db, now: NOW, to: '', send }), { skipped: 'off' });
    const r = await processSupportNotice({ db, now: NOW, to: 'owner@gmail.com', send });
    assert.equal(r.sent, 2);
    assert.equal(r.quiet, 2);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'owner@gmail.com');
    // Service layout, not the "support answer" footer (the owner is not a correspondent).
    assert.equal(sent[0].category, 'transactional');
    assert.equal(sent[0].from, undefined, 'sent from the default noreply sender, never from support@');
    assert.match(sent[0].content.subject, /\(2\)/);
    assert.doesNotMatch(sent[0].content.body, /\[click\]\(https/);
    assert.match(sent[0].content.ctaUrl, /^https:\/\/medicard\.ge\/admin\/#\/support$/);

    await applyInboundEmailEvent(received('r5', { from: 'c@example.com', subject: 'Third' }), { db, now: new Date(NOW.getTime() + 60_000), kick });
    db.tables.messages.find((m) => m.resendId === 'r5').bodyStatus = 'ok';
    assert.deepEqual(await processSupportNotice({ db, now: new Date(NOW.getTime() + 5 * 60_000), to: 'owner@gmail.com', send }), { skipped: 'rate' });
    const later = await processSupportNotice({ db, now: new Date(NOW.getTime() + 11 * 60_000), to: 'owner@gmail.com', send });
    assert.equal(later.sent, 1);
    assert.equal(sent.length, 2);
    assert.equal(noticeContent([{ subject: 'One' }]).subject, 'ახალი წერილი მხარდაჭერაზე: One');
  });

  it('waits for the body (auto detection) up to 10 minutes before deciding', async () => {
    const db = fakeDb();
    await applyInboundEmailEvent(received('r1'), { db, now: NOW, kick: () => {} });
    const sent = [];
    const send = async (msg) => { sent.push(msg); return { status: 'sent' }; };
    assert.equal((await processSupportNotice({ db, now: new Date(NOW.getTime() + 60_000), to: 'owner@gmail.com', send })).sent, 0);
    assert.equal((await processSupportNotice({ db, now: new Date(NOW.getTime() + 11 * 60_000), to: 'owner@gmail.com', send })).sent, 1);
  });
});

/* ───────── Replies ───────── */
describe('support replies', () => {
  it('sends from support with threading headers and Re: subject, then logs outbound', async () => {
    const db = fakeDb();
    const a = await applyInboundEmailEvent(received('r1', { subject: 'Fwd: აპი არ იხსნება' }), { db, now: NOW, kick: () => {} });
    const inbound = db.tables.messages[0];
    inbound.references = '<root@mail.example.com>';
    const calls = [];
    const send = async (msg) => { calls.push(msg); return { status: 'sent', providerId: 're_out_1' }; };
    const out = await sendSupportReply({ threadId: a.threadId, body: 'გამარჯობა!\n\nუკვე გავასწორეთ.', admin: { id: 'adm1' } }, { db, send, now: NOW });
    const [c] = calls;
    assert.equal(c.to, 'nino@example.com');
    assert.equal(c.category, 'support');
    assert.match(c.from, /support@medicard\.ge/);
    assert.equal(c.replyTo, 'support@medicard.ge');
    assert.equal(c.content.subject, 'Re: აპი არ იხსნება');
    assert.deepEqual(c.extraHeaders, { 'In-Reply-To': '<r1@mail.example.com>', References: '<root@mail.example.com> <r1@mail.example.com>' });
    assert.match(c.idempotencyKey, /^support:/);
    assert.equal(out.message.direction, 'outbound');
    assert.equal(out.message.providerId, 're_out_1');
    const t = db.tables.threads[0];
    assert.equal(t.status, 'waiting');
    assert.equal(t.unread, false);
    assert.equal(t.messageCount, 2);
  });

  it('refuses our own domain and reports suppressed / disabled sends without storing', async () => {
    const db = fakeDb();
    const own = await applyInboundEmailEvent(received('r1', { from: 'noreply@medicard.ge' }), { db, now: NOW, kick: () => {} });
    await assert.rejects(sendSupportReply({ threadId: own.threadId, body: 'x' }, { db, send: async () => ({ status: 'sent' }) }), /საკუთარ დომენზე/);
    const ext = await applyInboundEmailEvent(received('r2'), { db, now: NOW, kick: () => {} });
    await assert.rejects(sendSupportReply({ threadId: ext.threadId, body: 'x' }, { db, send: async () => ({ status: 'skipped', reason: 'suppressed' }) }), /დაბლოკილია/);
    await assert.rejects(sendSupportReply({ threadId: ext.threadId, body: 'x' }, { db, send: async () => ({ status: 'skipped', reason: 'disabled' }) }), (e) => e.status === 503);
    assert.equal(db.tables.messages.filter((m) => m.direction === 'outbound').length, 0);
  });

  it('reply layout is the light support variant (no marketing or account footer)', () => {
    const r = renderSupportReply({ subject: 'Hello' }, 'გამარჯობა **ნინო**\n\n[ბმული](javascript:alert(1)) <script>x</script>');
    assert.equal(r.subject, 'Re: Hello');
    assert.match(r.html, /მხარდაჭერის პასუხი/);
    assert.doesNotMatch(r.html, /unsubscribe|გამოწერის გაუქმება|სერვისული წერილია|<script/i);
    assert.doesNotMatch(r.html, /href="javascript/);
    assert.match(renderEmail({ content: { subject: 's', body: 'b' }, category: 'transactional' }).html, /სერვისული წერილია/);
  });
});

/* ───────── New letters (owner → partners) ───────── */
describe('support letters', () => {
  it('lists support@ and the letter mailbox; only own-domain senders are allowed', async () => {
    const senders = supportSenders();
    assert.deepEqual(senders.map((s) => [s.email, s.category]), [['support@medicard.ge', 'support'], ['ceo@medicard.ge', 'letter']]);
    assert.equal(senderForMailbox('CEO@medicard.ge').category, 'letter');
    assert.equal(senderForMailbox('info@medicard.ge').email, 'support@medicard.ge');
    const db = fakeDb();
    await assert.rejects(sendSupportLetter({ from: 'ceo@gmail.com', to: 'a@b.com', subject: 's', body: 'b' }, { db, send: async () => ({ status: 'sent' }) }), /ამ მისამართიდან/);
    await assert.rejects(sendSupportLetter({ from: 'ceo@medicard.ge', to: 'x@medicard.ge', subject: 's', body: 'b' }, { db, send: async () => ({ status: 'sent' }) }), /საკუთარ დომენზე/);
    await assert.rejects(sendSupportLetter({ from: 'ceo@medicard.ge', to: 'a@b.com', subject: 's', body: 'b' }, { db, send: async () => ({ status: 'skipped', reason: 'suppressed' }) }), /დაბლოკილია/);
    assert.equal(db.tables.threads.length, 0);
  });

  it('sends a plain letter from ceo@ with our Message-ID; the answer threads back and is answered from ceo@', async () => {
    const db = fakeDb();
    const calls = [];
    const send = async (msg) => { calls.push(msg); return { status: 'sent', providerId: `re_${calls.length}` }; };
    const out = await sendSupportLetter({ from: 'ceo@medicard.ge', to: 'Sales@Tasso.example', toName: 'Tasso', subject: 'Partnership inquiry', body: 'Hello,\n\n1. Pricing\n2. Branding', admin: { id: 'adm1' } }, { db, send, now: NOW });
    const [c] = calls;
    assert.equal(c.category, 'letter');
    assert.equal(c.from, 'George Shengelia <ceo@medicard.ge>');
    assert.equal(c.replyTo, 'ceo@medicard.ge');
    assert.equal(c.to, 'sales@tasso.example');
    const own = c.extraHeaders['Message-ID'];
    assert.match(own, /^<[0-9a-f-]+@medicard\.ge>$/);
    const t = db.tables.threads[0];
    assert.equal(out.thread.id, t.id);
    assert.equal(t.mailbox, 'ceo@medicard.ge');
    assert.equal(t.status, 'waiting');
    assert.equal(t.counterpartEmail, 'sales@tasso.example');
    assert.equal(db.tables.messages[0].messageId, own);

    // A follow-up before any answer threads onto our first letter, still from ceo@.
    await sendSupportReply({ threadId: t.id, body: 'Following up.' }, { db, send, now: new Date(NOW.getTime() + 60_000) });
    assert.equal(calls[1].category, 'letter');
    assert.match(calls[1].from, /ceo@medicard\.ge/);
    assert.equal(calls[1].extraHeaders['In-Reply-To'], own);

    // Their answer (Re: + References) lands in the same thread.
    const r = await applyInboundEmailEvent(received('t1', { from: 'Sales <sales@tasso.example>', to: ['ceo@medicard.ge'], subject: 'RE: Partnership inquiry', attachments: [] }), { db, now: new Date(NOW.getTime() + 3_600_000), kick: () => {} });
    assert.equal(r.threadId, t.id);
    assert.equal(db.tables.threads.length, 1);
  });

  it('letter layout is a plain email: no brand chrome, footer note or unsafe links', () => {
    const r = renderSupportLetter({ from: 'ceo@medicard.ge', subject: 'Hi', body: 'Hello **Tasso**\n\n1. One\n2. Two\n\n[x](javascript:alert(1)) <script>x</script>' });
    assert.equal(r.from, 'ceo@medicard.ge');
    assert.match(r.html, /<ol /);
    assert.doesNotMatch(r.html, /მხარდაჭერის პასუხი|სერვისული წერილია|unsubscribe|<script|href="javascript/i);
    assert.match(r.text, /Hello Tasso/);
  });
});

/* ───────── Validation, retention, install, webhook route ───────── */
describe('support validation, retention and install', () => {
  it('validates snippets, replies and thread patches', () => {
    assert.equal(snippetSchema.safeParse({ title: 'მადლობა', body: 'მადლობა წერილისთვის!' }).success, true);
    assert.equal(snippetSchema.safeParse({ title: '   ', body: 'x' }).success, false);
    assert.equal(snippetSchema.safeParse({ title: 'x'.repeat(81), body: 'x' }).success, false);
    assert.equal(snippetSchema.safeParse({ title: 'x', body: '' }).success, false);
    assert.equal(snippetSchema.safeParse({ title: 'x', body: 'y'.repeat(20_001) }).success, false);
    assert.equal(replySchema.parse({ body: ' hi ' }).status, 'waiting');
    assert.equal(replySchema.safeParse({ body: 'hi', status: 'deleted' }).success, false);
    assert.equal(threadPatchSchema.safeParse({}).success, false);
    assert.equal(threadPatchSchema.safeParse({ status: 'closed' }).success, true);
    assert.equal(threadPatchSchema.safeParse({ assignedAdminId: null }).success, true);
  });

  it('purges only closed threads older than 2 years', async () => {
    const db = fakeDb();
    const old = new Date(NOW.getTime() - 800 * 86400_000);
    db.tables.threads.push({ id: 't1', status: 'closed', lastMessageAt: old }, { id: 't2', status: 'open', lastMessageAt: old }, { id: 't3', status: 'closed', lastMessageAt: NOW });
    db.tables.messages.push({ id: 'm1', threadId: 't1' }, { id: 'm2', threadId: 't2' });
    assert.equal(await purgeOldSupportThreads({ db, now: NOW }), 1);
    assert.deepEqual(db.tables.threads.map((t) => t.id), ['t2', 't3']);
    assert.deepEqual(db.tables.messages.map((m) => m.id), ['m2']);
  });

  it('install script ships only additive Support* statements and runs in db:install', () => {
    const statements = supportStatements(read('../../prisma/20260928-support.sql'));
    assert.ok(statements.length >= 10);
    assert.throws(() => supportStatements('DROP TABLE "SupportThread";'));
    assert.throws(() => supportStatements('CREATE TABLE IF NOT EXISTS "User" (id TEXT);'));
    assert.throws(() => supportStatements('ALTER TABLE "SupportThread" ADD COLUMN x TEXT;'));
    assert.throws(() => supportStatements('DELETE FROM "SupportMessage";'));
    assert.throws(() => supportStatements('CREATE INDEX IF NOT EXISTS "SupportX_idx" ON "User"(email);'));
    const pkg = JSON.parse(read('../../../package.json'));
    assert.match(pkg.scripts['db:install'], /install-support\.mjs/);
    const schema = read('../../prisma/schema.prisma');
    for (const model of ['SupportThread', 'SupportMessage', 'SupportSnippet']) assert.match(schema, new RegExp(`^model ${model} \\{`, 'm'));
    assert.equal(isAllowedDownloadUrl('https://inbound-cdn.resend.com/a/b?sig=1'), true);
    assert.equal(isAllowedDownloadUrl('http://inbound-cdn.resend.com/a'), false);
    assert.equal(isAllowedDownloadUrl('https://169.254.169.254/latest'), false);
    assert.equal(isAllowedDownloadUrl('https://resend.com.evil.example/x'), false);
  });

  it('webhook route: signed email.received is dispatched, unsigned is refused', async () => {
    const { env } = await import('../config/env.js');
    const saved = env.RESEND_WEBHOOK_SECRET;
    const secret = `whsec_${Buffer.from('support-webhook-test-secret').toString('base64')}`;
    env.RESEND_WEBHOOK_SECRET = secret;
    const routes = await import('../routes/email.routes.js');
    const savedDispatch = routes.webhookHandlers.dispatch;
    const seen = [];
    routes.webhookHandlers.dispatch = async (event) => { seen.push(event); return { stored: true }; };
    const app = express();
    app.use('/api/email', routes.emailWebhookRouter);
    const server = app.listen(0);
    try {
      const { port } = server.address();
      const payload = JSON.stringify(received('r-http'));
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = `v1,${signSvixPayload({ secret, id: 'msg_s1', timestamp: ts, payload })}`;
      const url = `http://127.0.0.1:${port}/api/email/webhook`;
      const ok = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'svix-id': 'msg_s1', 'svix-timestamp': ts, 'svix-signature': sig }, body: payload });
      assert.equal(ok.status, 200);
      assert.equal((await ok.json()).stored, true);
      assert.equal(seen.length, 1);
      assert.equal(seen[0].type, 'email.received');
      assert.equal(seen[0].data.email_id, 'r-http');
      const bad = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
      assert.equal(bad.status, 401);
      assert.equal(seen.length, 1);
      routes.webhookHandlers.dispatch = async () => { throw Object.assign(new Error('relation "SupportThread" does not exist'), { code: 'P2021' }); };
      const ts2 = String(Math.floor(Date.now() / 1000));
      const sig2 = `v1,${signSvixPayload({ secret, id: 'msg_s2', timestamp: ts2, payload })}`;
      const notInstalled = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'svix-id': 'msg_s2', 'svix-timestamp': ts2, 'svix-signature': sig2 }, body: payload });
      assert.equal(notInstalled.status, 503);
    } finally {
      routes.webhookHandlers.dispatch = savedDispatch;
      env.RESEND_WEBHOOK_SECRET = saved;
      server.close();
    }
  });
});

it('splitQuoted folds Gmail quoted history (English and Georgian) and keeps plain mails whole', async () => {
  const { splitQuoted, previewText } = await import('./support/quote.js');
  const en = splitQuoted('ანუ გამოდის რომ ესეა\n\nOn Mon, Sep 28, 2026 at 2:57 AM MEDICARD <support@medicard.ge>\nwrote:\n\n>\n> kai gavigeee\n');
  assert.equal(en.main, 'ანუ გამოდის რომ ესეა');
  assert.match(en.quoted, /^On Mon/);
  const ka = splitQuoted('გამარჯობა\n\n2026 წლის 28 სექ., 02:57-ზე MEDICARD <support@medicard.ge> დაწერა:\n> ძველი');
  assert.equal(ka.main, 'გამარჯობა');
  assert.equal(splitQuoted('just text').quoted, '');
  assert.equal(splitQuoted('> only quoted').main, '> only quoted');
  assert.equal(previewText('new line\n> old one'), 'new line');
});
