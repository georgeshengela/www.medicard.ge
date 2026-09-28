import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  featureForHref,
  featureForPath,
  featureOnIn,
  hrefAvailableIn,
  sanitizeFeatureState,
  type FeatureKey,
} from './featureRoutes.ts';
import { ROUTE_ROOTS, detailParagraphs, isAllowedAppRoute } from './announcementRules.ts';

const serverFlags = readFileSync(new URL('../../../server/src/lib/featureFlags.js', import.meta.url), 'utf8');
const serverNews = readFileSync(new URL('../../../server/src/lib/announcements.js', import.meta.url), 'utf8');

describe('module switches in the app', () => {
  it('missing or malformed answers never hide a module', () => {
    const state = sanitizeFeatureState({ flags: { cycle: 'no', pets: false, x: 1 }, messages: { pets: 42, cycle: ' ok ' } });
    assert.deepEqual(state.flags, { pets: false });
    assert.deepEqual(state.messages, { cycle: 'ok' });
    assert.equal(featureOnIn(state, 'cycle'), true);
    assert.equal(featureOnIn(state, 'unknown'), true);
    assert.equal(featureOnIn(sanitizeFeatureState(null), 'medi'), true);
  });

  it('maps every gated route to its switch', () => {
    const cases: Array<[string[], FeatureKey | null]> = [
      [['cycle', 'pregnancy', 'timeline'], 'cycle'],
      [['nutrition', 'diary'], 'nutrition'],
      [['pets', '[id]', 'chat'], 'mediVet'],
      [['pets', '[id]', 'care'], 'pets'],
      [['run', 'active'], 'medirun'],
      [['medipulsi'], 'medirun'],
      [['medi-quest', 'rewards'], 'quest'],
      [['medi-companion'], 'quest'],
      [['coach', 'clients'], 'coach'],
      [['trainer'], 'coach'],
      [['assistant'], 'medi'],
      [['module', 'skin'], 'medi'],
      [['news', '[id]'], 'news'],
      [['(tabs)', 'home'], null],
      [['medications'], null],
      [['lab'], null],
    ];
    for (const [segments, key] of cases) assert.equal(featureForPath(segments), key, segments.join('/'));
    assert.equal(featureForHref('/(tabs)/medications'), null);
    assert.equal(featureForHref('/assistant?mode=deep'), 'medi');
  });

  it('hides only entries of paused modules', () => {
    const state = sanitizeFeatureState({ flags: { cycle: false, mediVet: false } });
    assert.equal(hrefAvailableIn(state, '/cycle'), false);
    assert.equal(hrefAvailableIn(state, '/pets'), true);
    assert.equal(hrefAvailableIn(state, '/pets/abc/chat'), false);
    assert.equal(hrefAvailableIn(state, '/nutrition'), true);
    assert.equal(hrefAvailableIn(state, '/visits'), true);
  });

  it('every app switch exists on the server', () => {
    const keys: FeatureKey[] = ['cycle', 'nutrition', 'nutritionAi', 'medi', 'pets', 'mediVet', 'medirun', 'quest', 'rewardsStore', 'coach', 'community', 'pharmacy', 'news'];
    for (const key of keys) assert.match(serverFlags, new RegExp(`key: '${key}'`), key);
  });
});

describe('news card rules', () => {
  it('route allow-list is identical to the server and every root is a real route', () => {
    const server = /ROUTE_ROOTS = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(serverNews)?.[1] ?? '';
    const serverRoots = [...server.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual([...ROUTE_ROOTS].sort(), serverRoots.sort());
    for (const root of ROUTE_ROOTS) {
      const base = new URL(`../../app/${root}`, import.meta.url);
      const found = existsSync(base) || existsSync(new URL(`../../app/${root}.tsx`, import.meta.url));
      assert.ok(found, `mobile/app/${root} does not exist`);
    }
  });

  it('accepts app routes and refuses everything else', () => {
    assert.equal(isAllowedAppRoute('/run'), true);
    assert.equal(isAllowedAppRoute('/assistant?mode=deep'), true);
    assert.equal(isAllowedAppRoute('/(tabs)/medications'), true);
    assert.equal(isAllowedAppRoute('/nowhere'), false);
    assert.equal(isAllowedAppRoute('//evil.com'), false);
    assert.equal(isAllowedAppRoute('https://medicard.ge'), false);
  });

  it('splits details into paragraphs and falls back to the short text', () => {
    assert.deepEqual(detailParagraphs({ details: 'ერთი\r\n\r\nორი\n \nსამი', body: 'x' }), ['ერთი', 'ორი', 'სამი']);
    assert.deepEqual(detailParagraphs({ details: '', body: 'მოკლე' }), ['მოკლე']);
    assert.deepEqual(detailParagraphs({ details: '', body: '' }), []);
  });
});
