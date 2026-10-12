import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, isValidWebhookSecret, webhookSecret } from './director/telegram.js';
import { wakeBrain } from './director/trigger.js';
import { initiativeTransitionAllowed, memoryValue, writeMemory } from './director/store.js';

test('only the owner approves initiatives; the Director moves its own work', () => {
  assert.equal(initiativeTransitionAllowed('idea', 'proposed', false), true);
  assert.equal(initiativeTransitionAllowed('proposed', 'approved', false), false, 'approval is the owner\'s');
  assert.equal(initiativeTransitionAllowed('proposed', 'approved', true), true);
  assert.equal(initiativeTransitionAllowed('idea', 'active', false), false, 'no work before approval');
  assert.equal(initiativeTransitionAllowed('approved', 'active', false), true);
  assert.equal(initiativeTransitionAllowed('active', 'done', false), true);
  assert.equal(initiativeTransitionAllowed('idea', 'done', false), false);
  assert.equal(initiativeTransitionAllowed('active', 'dropped', false), true);
  assert.equal(initiativeTransitionAllowed('idea', 'bogus', true), false);
});

test('memory keeps objects as JSON, not "[object Object]"', () => {
  assert.equal(memoryValue({ users: 5, funnel: [0, 1] }), '{"users":5,"funnel":[0,1]}');
  assert.equal(memoryValue('plain text'), 'plain text');
  assert.equal(memoryValue(42), '42');
  assert.equal(memoryValue(null), null);
  assert.equal(memoryValue(''), null);
});
import { isWorkingHours } from './director/hours.js';
import { faqText } from './director/knowledge.js';
import { canAutoSend, linksAreSafe, AUTO_REPLIES_PER_THREAD, ACK_TEXT, ACK_TEXT_EN, afterHoursAck, writesGeorgian } from './director/supportAgent.js';
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

test('after-hours ACK only for mail that reached support@, never in a conversation we started (2026-10-09)', () => {
  const support = { mailbox: 'support@medicard.ge', weStarted: false, subject: 'აპი', text: 'გამარჯობა, ვერ შევდივარ' };
  assert.deepEqual(afterHoursAck(support, 'support@medicard.ge'), { send: true, lang: 'ka', body: ACK_TEXT });
  // Tasso: an English answer to the owner's letter from ceo@ — both rules forbid the ACK, also
  // when the reply did not thread onto the letter (it did not: the provider swapped our Message-ID).
  const tasso = { mailbox: 'ceo@medicard.ge', weStarted: true, subject: 'Re: Partnership', text: 'Hi George, thanks for reaching out.' };
  assert.deepEqual(afterHoursAck(tasso, 'support@medicard.ge'), { send: false, reason: 'ours' });
  assert.deepEqual(afterHoursAck({ ...tasso, weStarted: false }, 'support@medicard.ge'), { send: false, reason: 'mailbox' });
  assert.deepEqual(afterHoursAck({ ...support, weStarted: true }, 'support@medicard.ge'), { send: false, reason: 'ours' }, 'a letter sent from support@');
  assert.deepEqual(afterHoursAck({ ...support, mailbox: 'ceo@medicard.ge' }, 'support@medicard.ge'), { send: false, reason: 'mailbox' }, 'mail sent straight to ceo@');
  assert.equal(afterHoursAck({ ...support, mailbox: null }, 'support@medicard.ge').send, false, 'unknown mailbox');
  assert.equal(afterHoursAck({ ...support, mailbox: 'Support@Medicard.ge' }, 'support@medicard.ge').send, true, 'case-insensitive');
  assert.equal(afterHoursAck(support).send, true, 'defaults to SUPPORT_FROM (support@)');
});

test('after-hours ACK is English for a sender who does not write Georgian', () => {
  const at = (subject, text) => afterHoursAck({ mailbox: 'support@medicard.ge', weStarted: false, subject, text }, 'support@medicard.ge');
  const en = at('Question about the app', 'Hello, how do I export my lab results?');
  assert.deepEqual(en, { send: true, lang: 'en', body: ACK_TEXT_EN });
  assert.match(ACK_TEXT_EN, /MEDICARD team$/);
  assert.doesNotMatch(ACK_TEXT_EN, /[\u10A0-\u10FF]/, 'no Georgian letters in the English ACK');
  assert.equal(at('Вопрос', 'Здравствуйте, не могу войти').lang, 'en', 'Russian → English');
  assert.equal(at('', 'MEDICARD app-ში login არ მუშაობს, error 500').lang, 'ka', 'Georgian with English product words');
});

test('writesGeorgian reads the sender\'s own words, not quotes or a signature', () => {
  assert.equal(writesGeorgian({ text: 'გამარჯობა!\n\nSent from my iPhone' }), true);
  assert.equal(writesGeorgian({ text: 'Thank you, we will send the price list tomorrow.\n\nBest regards,\nნინო ბერიძე' }), false, 'Georgian name in the signature');
  assert.equal(writesGeorgian({ text: 'Sure, Monday works.\n\nOn Fri, Oct 9, 2026 at 18:00 George <ceo@medicard.ge> wrote:\n> გამარჯობა, თანამშრომლობა გვინდა' }), false, 'our quoted Georgian letter');
  assert.equal(writesGeorgian({ text: 'Sure.\n> გამარჯობა\n> როგორ ხარ' }), false);
  assert.equal(writesGeorgian({ text: 'Noted, thanks.\n\n________________________________\nFrom: George Shengelia <ceo@medicard.ge>\nSent: Friday\n\nგამარჯობა, თანამშრომლობის შესახებ გწერთ' }), false, 'Outlook history');
  assert.equal(writesGeorgian({ text: 'Will do.\n-- \nნინო ბერიძე\nშპს „ფარმა“, თბილისი' }), false, '"-- " signature');
  assert.equal(writesGeorgian({ text: 'ვერ შევდივარ\n\nОтправлено с iPhone' }), true);
  assert.equal(writesGeorgian({ text: 'MEDICARD-ში ვერ ვხედავ ჩემს lab results, iPhone 15, iOS 18' }), true);
  assert.equal(writesGeorgian({ subject: 'Re: შეკითხვა', text: '' }), true, 'empty body → subject');
  assert.equal(writesGeorgian({ subject: 'Re: Invoice', text: '   ' }), false);
  assert.equal(writesGeorgian({ subject: '', text: '' }), true, 'nothing to judge → Georgian');
  assert.equal(writesGeorgian({ subject: '', text: '12345 !!!' }), true);
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
