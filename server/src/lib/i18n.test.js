import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiLanguageDirective, langMiddleware, normalizeLang, parseLang, t } from './i18n.js';

test('parseLang accepts ka/en tags and rejects others', () => {
  assert.equal(parseLang('en'), 'en');
  assert.equal(parseLang('en-US'), 'en');
  assert.equal(parseLang('EN_gb'), 'en');
  assert.equal(parseLang('ka'), 'ka');
  assert.equal(parseLang('ka-GE'), 'ka');
  assert.equal(parseLang('ru'), null);
  assert.equal(parseLang(''), null);
  assert.equal(normalizeLang(undefined), 'ka');
});

test('middleware defaults to Georgian and marks explicit headers', () => {
  const req = { headers: {}, query: {} };
  langMiddleware(req, {}, () => {});
  assert.equal(req.lang, 'ka');
  assert.equal(req.langExplicit, false);
  const en = { headers: { 'x-medicard-lang': 'en' }, query: {} };
  langMiddleware(en, {}, () => {});
  assert.equal(en.lang, 'en');
  assert.equal(en.langExplicit, true);
});

test('t picks by request language; AI directive only for English', () => {
  assert.equal(t({ lang: 'en' }, 'ა', 'a'), 'a');
  assert.equal(t({ lang: 'ka' }, 'ა', 'a'), 'ა');
  assert.equal(t(null, 'ა', 'a'), 'ა');
  assert.equal(aiLanguageDirective('ka'), '');
  assert.match(aiLanguageDirective('en'), /English/);
});
