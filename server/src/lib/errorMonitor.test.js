import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIMITS, buildEvent, createAlertThrottle, createErrorRecorder, errorMonitorEnabled, fingerprintOf, firstAppFrame,
  newErrorText, normalizeMessage, parseClientErrorReport, scrubStack, scrubText, spikeText, reviewState, tokenUserId, userHashOf,
} from './errorMonitor.js';
import { errorStatements } from '../../scripts/install-errors.mjs';
import jwt from 'jsonwebtoken';

const V8_STACK = `TypeError: Cannot read properties of undefined (reading 'dose')
    at scheduleDose (/opt/render/project/src/server/src/lib/medications.js:120:14)
    at async Promise.all (index 0)
    at Layer.handle [as handle_request] (/opt/render/project/src/server/node_modules/express/lib/router/layer.js:95:5)
    at C:\\Users\\User\\Desktop\\www.medicard\\server\\src\\routes\\meds.js:44:9`;

const HERMES_STACK = `Error: boom
    at renderRow (address at /data/app/ge.medicard/base.apk/index.android.bundle:1:234567)
map@[native code]
HomeScreen@https://medicard.ge/_expo/static/js/web/entry-abc123.js?platform=web&token=secret:12:3400`;

test('install SQL is additive and only touches ErrorEvent', () => {
  const sql = readFileSync(new URL('../../prisma/20260929-errors.sql', import.meta.url), 'utf8');
  assert.equal(errorStatements(sql).length, 4);
  assert.throws(() => errorStatements('DROP TABLE "User";'));
  assert.throws(() => errorStatements('CREATE TABLE IF NOT EXISTS "User" (id TEXT);'));
});

test('scrubText removes emails, phones, tokens, ids and query strings', () => {
  const token = jwt.sign({ sub: 'u1' }, 'x');
  const text = scrubText(`user giorgi@example.com phone +995 555 12 34 56 token ${token} id 3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b cuid ckz8x9y0a0000qwertyuiopas url https://medicard.ge/api/x?email=a@b.ge&q=1 key opaque_QWERTYUIOPASDFGHJKLZXCVBNM1234567890`);
  assert.doesNotMatch(text, /giorgi|555 12|eyJ|3f2b8c1e|ckz8x9|email=|opaque_QWERTY/);
  assert.match(text, /\[email\]/);
  assert.match(text, /\[num\]/);
  assert.match(text, /\[token\]/);
  assert.match(text, /:id/);
  assert.match(text, /https:\/\/medicard\.ge\/api\/x /);
  assert.equal(scrubText('ENOENT: open /opt/render/project/src/server/uploads/a.pdf'), 'ENOENT: open a.pdf');
  assert.match(scrubStack('    at fn@https://x.ge/a/b.js:1:2'), /^fn \(b\.js:1\)$/);
});

test('short numbers stay, message is capped at 300 chars', () => {
  assert.equal(scrubText('status 404 after 3 retries'), 'status 404 after 3 retries');
  const long = scrubText('x'.repeat(5000));
  assert.ok(long.length <= LIMITS.messageChars);
});

test('scrubStack keeps ≤ 15 frames as function (file:line) with basenames only', () => {
  const s = scrubStack(V8_STACK);
  assert.match(s, /^scheduleDose \(medications\.js:120\)/);
  assert.match(s, /Layer\.handle \(layer\.js:95\)/);
  assert.match(s, /<anon> \(meds\.js:44\)/);
  assert.doesNotMatch(s, /opt\/render|Users|TypeError/);
  const big = Array.from({ length: 40 }, (_, i) => `    at fn${i} (/a/b/f${i}.js:${i}:1)`).join('\n');
  assert.equal(scrubStack(big).split('\n').length, LIMITS.stackFrames);
  assert.ok(scrubStack(big).length <= LIMITS.stackChars);
  const h = scrubStack(HERMES_STACK);
  assert.match(h, /renderRow \(index\.android\.bundle:1\)/);
  assert.match(h, /HomeScreen \(entry-abc123\.js:12\)/);
  assert.doesNotMatch(h, /token=secret|data\/app/);
});

test('first app frame skips vendor frames and ignores line numbers', () => {
  const vendorFirst = `Error: x\n    at next (/srv/node_modules/express/lib/router/index.js:1:1)\n    at saveMeal (/srv/src/lib/nutrition.js:9:2)`;
  assert.equal(firstAppFrame(vendorFirst), 'saveMeal@nutrition.js');
  const moved = vendorFirst.replace('9:2', '77:5');
  assert.equal(firstAppFrame(moved), firstAppFrame(vendorFirst));
});

test('fingerprint groups the same bug with different ids/numbers and splits different bugs', () => {
  const a = fingerprintOf({ source: 'server', kind: 'error', name: 'TypeError', message: 'User ckz8x9y0a0000qwertyuiopas not found after 3 tries', stack: V8_STACK });
  const b = fingerprintOf({ source: 'server', kind: 'error', name: 'TypeError', message: 'User ckq1w2e3r4t5y6u7i8o9p0as not found after 5 tries', stack: V8_STACK });
  const c = fingerprintOf({ source: 'app', kind: 'error', name: 'TypeError', message: 'User ckz8x9y0a0000qwertyuiopas not found after 3 tries', stack: V8_STACK });
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(normalizeMessage('Timeout after 3000 ms'), 'timeout after # ms');
});

test('parseClientErrorReport validates the contract', () => {
  assert.equal(parseClientErrorReport(null), null);
  assert.equal(parseClientErrorReport({}), null);
  assert.equal(parseClientErrorReport({ events: [] }), null);
  assert.equal(parseClientErrorReport({ events: [{ kind: 'oops', name: 'E', message: 'm' }] }), null);
  assert.equal(parseClientErrorReport({ events: [{ kind: 'crash', name: 1, message: 'm' }] }), null);
  assert.equal(parseClientErrorReport({ events: [{ kind: 'crash', name: 'E', message: 'm', stack: {} }] }), null);
  const ok = parseClientErrorReport({ events: Array.from({ length: 14 }, () => ({ kind: 'render', name: 'E', message: 'm', fatal: 'yes', userId: 'spoof' })) });
  assert.equal(ok.length, 10);
  assert.equal(ok[0].fatal, false);
  assert.equal('userId' in ok[0], false);
});

test('buildEvent scrubs, hashes the user and trusts only the header platform/version', () => {
  const now = Date.UTC(2026, 8, 29, 12);
  const e = buildEvent(
    { kind: 'crash', name: 'Error', message: 'fail for a@b.ge', stack: HERMES_STACK, route: '/pets/ckz8x9y0a0000qwertyuiopas/chat?x=1', at: new Date(now - 60_000).toISOString() },
    { source: 'app', platform: 'IOS', appVersion: '1.0.0.17.20<script>', userId: 'user-1', now },
  );
  assert.equal(e.platform, 'ios');
  assert.equal(e.appVersion, '1.0.0.17.20');
  assert.equal(e.route, '/pets/:id/chat');
  assert.equal(e.message, 'fail for [email]');
  assert.equal(e.fatal, true);
  assert.equal(e.userHash, userHashOf('user-1'));
  assert.match(e.userHash, /^[0-9a-f]{16}$/);
  assert.equal(e.createdAt.getTime(), now - 60_000);
  const future = buildEvent({ kind: 'error', name: 'E', message: 'm', at: '2099-01-01T00:00:00Z' }, { source: 'app', platform: 'tv', now });
  assert.equal(future.createdAt.getTime(), now);
  assert.equal(future.platform, null);
  const server = buildEvent({ kind: 'error', name: 'E', message: 'm', route: 'GET /api/users/ckz8x9y0a0000qwertyuiopas?q=me' }, { source: 'server', now });
  assert.equal(server.route, 'GET /api/users/:id');
});

test('tokenUserId trusts only a valid non-admin token', () => {
  const secret = 's3cret';
  const req = (t) => ({ headers: { authorization: `Bearer ${t}` } });
  assert.equal(tokenUserId(req(jwt.sign({ sub: 'u42' }, secret)), secret), 'u42');
  assert.equal(tokenUserId(req(jwt.sign({ sub: 'a1', role: 'admin' }, secret)), secret), null);
  assert.equal(tokenUserId(req(jwt.sign({ sub: 'u42' }, 'other')), secret), null);
  assert.equal(tokenUserId({ headers: {} }, secret), null);
});

test('alert throttle: 6 h per fingerprint, 10 new per hour, spikes every 2 h', () => {
  let t = 0;
  const th = createAlertThrottle({ now: () => t });
  assert.equal(th.allowNew('a'), true);
  assert.equal(th.allowNew('a'), false);
  for (let i = 0; i < 9; i += 1) assert.equal(th.allowNew(`f${i}`), true);
  assert.equal(th.allowNew('eleventh'), false);
  t += 61 * 60_000;
  assert.equal(th.allowNew('eleventh'), true);
  assert.equal(th.allowNew('a'), false);
  t += 6 * 60 * 60_000;
  assert.equal(th.allowNew('a'), true);
  assert.equal(th.allowSpike('a'), true);
  assert.equal(th.allowSpike('a'), false);
  t += 2 * 60 * 60_000;
  assert.equal(th.allowSpike('a'), true);
});

function fakeStore({ seen = false, count = 0 } = {}) {
  const rows = [];
  return {
    rows,
    async insert(row) { rows.push(row); },
    async seenSince() { return typeof seen === 'function' ? seen() : seen; },
    async countSince() { return typeof count === 'function' ? count(rows) : count; },
  };
}
const ev = (fp, extra = {}) => ({ fingerprint: fp, source: 'server', kind: 'error', name: 'TypeError', message: 'boom', route: 'GET /api/x', platform: null, appVersion: null, fatal: false, userHash: null, createdAt: new Date(), stackTop: null, ...extra });

test('recorder folds repeats within 10 s into the next row count', async () => {
  let t = 1_000_000;
  const store = fakeStore({ seen: true });
  const rec = createErrorRecorder({ store, notify: async () => {}, now: () => t });
  assert.equal(await rec.record(ev('fp1')), true);
  assert.equal(await rec.record(ev('fp1')), false);
  assert.equal(await rec.record(ev('fp1')), false);
  t += 10_000;
  assert.equal(await rec.record(ev('fp1')), true);
  assert.deepEqual(store.rows.map((r) => r.count), [1, 3]);
  assert.equal(await rec.record(ev('fp2')), true);
});

test('recorder caps rows per minute', async () => {
  const t = 5 * 60_000;
  const store = fakeStore({ seen: true });
  const rec = createErrorRecorder({ store, notify: async () => {}, now: () => t });
  const results = await Promise.all(Array.from({ length: LIMITS.rowsPerMinute + 20 }, (_, i) => rec.record(ev(`f${i}`))));
  assert.equal(results.filter(Boolean).length, LIMITS.rowsPerMinute);
  assert.equal(rec.stats.dropped, 20);
});

test('recorder alerts once for a new fingerprint and once for a spike', async () => {
  let t = 1_000_000;
  const sent = [];
  let seen = false;
  const store = fakeStore({ seen: () => seen, count: () => 60 });
  const rec = createErrorRecorder({ store, notify: async (text) => { sent.push(text); }, now: () => t });
  await rec.record(ev('new1', { source: 'app', platform: 'ios', appVersion: '1.0.0.17.20', fatal: true }));
  seen = true;
  t += 11_000;
  await rec.record(ev('new1'));
  t += 61_000;
  await rec.record(ev('new1'));
  assert.equal(sent.filter((s) => s.startsWith('🐞')).length, 1);
  assert.match(sent[0], /აპი, ავარია/);
  assert.match(sent[0], /ios 1\.0\.0\.17\.20/);
  assert.equal(sent.filter((s) => s.startsWith('📈')).length, 1);
});

test('recorder never throws and respects enabled()', async () => {
  const rec = createErrorRecorder({ store: { insert: async () => { throw new Error('db down'); }, seenSince: async () => true, countSince: async () => 0 }, notify: async () => {} });
  assert.equal(await rec.record(ev('x')), false);
  const off = createErrorRecorder({ store: fakeStore(), enabled: () => false });
  assert.equal(await off.record(ev('x')), false);
  assert.equal(await rec.record(null), false);
});

test('recording is production-only unless forced', () => {
  assert.equal(errorMonitorEnabled('production', undefined), true);
  assert.equal(errorMonitorEnabled('development', undefined), false);
  assert.equal(errorMonitorEnabled('development', 'on'), true);
  assert.equal(errorMonitorEnabled('production', 'off'), false);
});

test('alert copy is short and carries only scrubbed fields', () => {
  const e = ev('x', { message: 'boom' });
  assert.match(newErrorText(e), /სერვერი/);
  assert.match(newErrorText(e), /GET \/api\/x/);
  assert.match(spikeText(e, 77), /77 შემთხვევა/);
});

test('reviewState hides a reviewed group until a newer event arrives', () => {
  assert.deepEqual(reviewState(null, '2026-10-09T10:00:00Z'), { reviewed: false, reviewedAt: null, returned: false });
  assert.equal(reviewState('2026-10-09T11:00:00Z', '2026-10-09T10:00:00Z').reviewed, true);
  const back = reviewState('2026-10-09T09:00:00Z', '2026-10-09T10:00:00Z');
  assert.equal(back.reviewed, false);
  assert.equal(back.returned, true);
});
