import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler, isClientAbort, isHiddenPath } from './error.js';

test('a visitor closing the connection is not a server error', () => {
  const aborted = Object.assign(new Error('Request aborted'), { code: 'ECONNABORTED' });
  assert.equal(isClientAbort(aborted, {}), true);
  assert.equal(isClientAbort(new Error('boom'), { socket: { destroyed: true } }), true);
  // An outbound timeout shares the code but is a real failure.
  assert.equal(isClientAbort(Object.assign(new Error('timeout of 5000ms exceeded'), { code: 'ECONNABORTED' }), {}), false);
  let status = null, ended = false;
  const res = { headersSent: false, destroyed: false, end() { ended = true; }, status(s) { status = s; return this; }, json() { return this; } };
  errorHandler(aborted, { socket: {} }, res, () => {});
  assert.equal(ended, true);
  assert.equal(status, null, 'no 500, so nothing reaches the error monitor');
});

test('hidden-file probes are recognised, .well-known is not', () => {
  for (const p of ['/.git/index', '/.git/HEAD', '/.env', '/server/.env', '/a/.htaccess']) assert.equal(isHiddenPath(p), true, p);
  for (const p of ['/', '/app', '/run/summary', '/.well-known/assetlinks.json', '/file.v2.js']) assert.equal(isHiddenPath(p), false, p);
});
