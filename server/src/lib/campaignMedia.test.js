import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  MEDIA_COOKIE, PRIVATE_PRESS_ROOT, campaignFilePath, campaignManifest, campaignMediaGate, mediaCookieOptions, readCookie,
  signMediaSession, verifyMediaSession,
} from './campaignMedia.js';

let server;
let base;
before(async () => {
  const app = express();
  app.use(campaignMediaGate({ isAdmin: async (id) => id === 'admin-1' }));
  app.use((_req, res) => res.status(200).send('public site'));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

const get = (p, cookie) => fetch(base + p, { redirect: 'manual', headers: cookie ? { cookie: `${MEDIA_COOKIE}=${cookie}` } : {} });

test('campaign files are not in public/', () => {
  assert.equal(existsSync(path.resolve(PRIVATE_PRESS_ROOT, '../../public/press/medirun-glow')), false);
  assert.ok(existsSync(path.join(PRIVATE_PRESS_ROOT, 'medirun-glow', 'plan.html')));
});

test('file names cannot leave the campaign folder', () => {
  assert.equal(campaignFilePath('medirun-glow', '../secret.html'), null);
  assert.equal(campaignFilePath('medirun-glow', '..%2Fx.jpg'), null);
  assert.equal(campaignFilePath('medirun-glow', 'a/b.jpg'), null);
  assert.equal(campaignFilePath('medirun-glow', 'x.js'), null);
  assert.equal(campaignFilePath('other', 'f01-key.jpg'), null);
  assert.ok(campaignFilePath('medirun-glow', 'f01-key.jpg'));
});

test('without an admin media session every private file is a 404', async () => {
  for (const p of ['/press/medirun-glow/', '/press/medirun-glow/index.html', '/press/medirun-glow/plan.html', '/press/medirun-glow/f01-key.jpg', '/press/medirun-glow/pa3-key.pdf']) {
    const res = await get(p);
    assert.equal(res.status, 404, p);
    assert.match(res.headers.get('x-robots-tag') || '', /noindex/);
  }
  assert.equal((await get('/press/medirun-glow/f01-key.jpg', 'garbage')).status, 404);
});

test('a session for a removed admin or a normal login token does not open files', async () => {
  assert.equal((await get('/press/medirun-glow/f01-key.jpg', signMediaSession('admin-gone'))).status, 404);
  assert.equal(verifyMediaSession('x.y.z'), null);
});

test('an admin media session serves files and sends the old gallery to admin', async () => {
  const cookie = signMediaSession('admin-1');
  const img = await get('/press/medirun-glow/f01-key.jpg', cookie);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.match(img.headers.get('cache-control'), /private/);
  const plan = await get('/press/medirun-glow/plan.html', cookie);
  assert.equal(plan.status, 200);
  assert.match(await plan.text(), /გაანათე თბილისი/);
  const old = await get('/press/medirun-glow/index.html', cookie);
  assert.equal(old.status, 302);
  assert.equal(old.headers.get('location'), '/admin/#/campaigns');
  assert.equal((await get('/press/medirun-glow/missing.jpg', cookie)).status, 404);
});

test('public /press folders are untouched', async () => {
  const res = await get('/press/campaign/d01-feed.jpg');
  assert.equal(await res.text(), 'public site');
});

test('cookie is HttpOnly, SameSite=Strict and scoped to /press', () => {
  const o = mediaCookieOptions();
  assert.equal(o.httpOnly, true);
  assert.equal(o.sameSite, 'strict');
  assert.equal(o.path, '/press');
  assert.equal(readCookie(`a=1; ${MEDIA_COOKIE}=tok%2E1`, MEDIA_COOKIE), 'tok.1');
});

test('manifest lists the plan and the print files that exist', () => {
  const [c] = campaignManifest();
  assert.equal(c.id, 'medirun-glow-2026');
  assert.equal(c.planUrl, '/press/medirun-glow/plan.html');
  assert.equal(c.prints.length, 5);
});
