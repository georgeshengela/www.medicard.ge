import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, isValidWebhookSecret, webhookSecret } from './director/telegram.js';
import { wakeBrain } from './director/trigger.js';
import { memoryValue, writeMemory } from './director/store.js';

test('memory keeps objects as JSON, not "[object Object]"', () => {
  assert.equal(memoryValue({ users: 5, funnel: [0, 1] }), '{"users":5,"funnel":[0,1]}');
  assert.equal(memoryValue('plain text'), 'plain text');
  assert.equal(memoryValue(42), '42');
  assert.equal(memoryValue(null), null);
  assert.equal(memoryValue(''), null);
});
import { isWorkingHours } from './director/hours.js';
import { faqText } from './director/knowledge.js';
import { canAutoSend, linksAreSafe, AUTO_REPLIES_PER_THREAD } from './director/supportAgent.js';
import { giftFromPayload } from './director/actions.js';

test('working hours are Mon–Fri 10:00–19:00 Tbilisi (UTC+4)', () => {
  assert.equal(isWorkingHours(new Date('2026-09-28T06:00:00Z')), true, 'Mon 10:00');
  assert.equal(isWorkingHours(new Date('2026-09-28T05:59:00Z')), false, 'Mon 09:59');
  assert.equal(isWorkingHours(new Date('2026-09-28T14:59:00Z')), true, 'Mon 18:59');
  assert.equal(isWorkingHours(new Date('2026-09-28T15:00:00Z')), false, 'Mon 19:00');
  assert.equal(isWorkingHours(new Date('2026-10-03T08:00:00Z')), false, 'Saturday');
  assert.equal(isWorkingHours(new Date('2026-10-04T08:00:00Z')), false, 'Sunday');
});

test('automatic support replies only for answerable help questions with safe links', () => {
  const ok = { category: 'help', answerable: true, reply: 'გამარჯობა! ანგარიშის წაშლა: https://medicard.ge/delete-account' };
  assert.equal(canAutoSend(ok, 0), true);
  assert.equal(canAutoSend({ ...ok, category: 'account' }, 0), false, 'account questions go to the owner');
  assert.equal(canAutoSend({ ...ok, category: 'business' }, 0), false);
  assert.equal(canAutoSend({ ...ok, answerable: false }, 0), false);
  assert.equal(canAutoSend({ ...ok, reply: 'კი' }, 0), false, 'too short');
  assert.equal(canAutoSend({ ...ok, reply: `${ok.reply} https://evil.example/x` }, 0), false, 'foreign link');
  assert.equal(canAutoSend(ok, AUTO_REPLIES_PER_THREAD), false, 'long threads go to the owner');
  assert.equal(linksAreSafe('see https://www.medicard.ge/privacy and https://medicard.ge'), true);
  assert.equal(linksAreSafe('https://medicard.ge.evil.com'), false);
});

test('MEDIRUN gift payload is bounded and must be in Georgia', () => {
  const now = new Date('2026-09-28T10:00:00Z');
  const g = giftFromPayload({ latitude: 41.7151, longitude: 44.8271, title: 'ტესტი', stock: 999, days: 500 }, now);
  assert.equal(g.stock, 100);
  assert.equal(g.endsAt.getTime() - now.getTime(), 60 * 86400000);
  assert.equal(g.published, true);
  assert.equal(g.rewardKind, 'DIGITAL');
  assert.match(g.id, /^[a-zA-Z0-9_-]+$/);
  assert.throws(() => giftFromPayload({ latitude: 48.85, longitude: 2.35, title: 'Paris' }, now), /inside Georgia/);
});

test('FAQ is read from the landing page section', () => {
  const html = '<section class="x" id="faq"><details><summary>რა არის Medi?</summary><p>AI ასისტენტი &amp; მეგზური.</p></details></section><section id="other">x</section>';
  assert.equal(faqText(html), 'რა არის Medi?\nAI ასისტენტი & მეგზური.');
  assert.equal(faqText('<p>no faq</p>'), '');
});

test('chunkText keeps every chunk under the limit and loses no words', () => {
  const para = 'სიტყვა '.repeat(300).trim();
  const text = [para, para, para].join('\n\n');
  const chunks = chunkText(text, 1000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 1000 && c.length > 0));
  assert.equal(chunks.join(' ').split(/\s+/).length, text.split(/\s+/).length);
  assert.deepEqual(chunkText('  short  '), ['short']);
  assert.deepEqual(chunkText(''), []);
});

test('webhook secret is derived from the bot token and compared exactly', () => {
  const saved = { t: process.env.TELEGRAM_BOT_TOKEN, s: process.env.DIRECTOR_TELEGRAM_SECRET };
  try {
    delete process.env.DIRECTOR_TELEGRAM_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    assert.equal(webhookSecret(), '');
    assert.equal(isValidWebhookSecret(''), false, 'no token → nothing is valid');

    process.env.TELEGRAM_BOT_TOKEN = '123:abc';
    const secret = webhookSecret();
    assert.match(secret, /^[0-9a-f]{64}$/, 'Telegram allows A-Z a-z 0-9 _ - only, up to 256 chars');
    assert.equal(isValidWebhookSecret(secret), true);
    assert.equal(isValidWebhookSecret(secret.slice(1)), false);
    assert.equal(isValidWebhookSecret(undefined), false);

    process.env.TELEGRAM_BOT_TOKEN = '123:other';
    assert.notEqual(webhookSecret(), secret, 'rotating the bot token rotates the secret');
  } finally {
    if (saved.t === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = saved.t;
    if (saved.s !== undefined) process.env.DIRECTOR_TELEGRAM_SECRET = saved.s;
  }
});

test('wakeBrain is a no-op when the routine is not configured', async () => {
  const saved = process.env.DIRECTOR_ROUTINE_URL;
  delete process.env.DIRECTOR_ROUTINE_URL;
  try {
    assert.deepEqual(await wakeBrain('test'), { ok: false, skipped: 'not-configured' });
  } finally {
    if (saved !== undefined) process.env.DIRECTOR_ROUTINE_URL = saved;
  }
});

test('memory keys are validated before touching the database', async () => {
  const db = { $executeRawUnsafe: async () => { throw new Error('db must not be reached'); } };
  for (const bad of ['', ' ', '../x', 'a b', 'x'.repeat(65), '-lead']) {
    await assert.rejects(writeMemory(bad, 'v', db), /invalid memory key/);
  }
});
