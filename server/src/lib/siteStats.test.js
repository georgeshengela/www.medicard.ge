import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeSiteStats } from './siteStats.js';

test('site stats: only whole numbers leave, bigint and junk become safe', () => {
  const out = shapeSiteStats({ steps: 28166754n, medicines: '10014', offers: 12450.7, answers: null, cycleLogs: -3, coins: 'x', waterMl: 410999 });
  assert.deepEqual(out, { steps: 28166754, medicines: 10014, offers: 12450, mediAnswers: 0, cycleLogs: 0, coins: 0, waterLiters: 410 });
});

test('site stats: no people count in the public shape', () => {
  const keys = Object.keys(shapeSiteStats({}));
  assert.ok(!keys.some((k) => /user|people|member/i.test(k)));
});
