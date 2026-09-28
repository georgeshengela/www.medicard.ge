import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, isValidWebhookSecret, webhookSecret } from './director/telegram.js';
import { wakeBrain } from './director/trigger.js';
import { writeMemory } from './director/store.js';

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
