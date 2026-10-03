import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  ENGAGE_FAMILY_FEATURES,
  FEATURE_KEYS,
  engageFamilyOnIn,
  featureForHref,
  featureForPath,
  featureOnIn,
  hrefAvailableIn,
  sanitizeFeatureState,
  type FeatureKey,
} from './featureRoutes.ts';
import { ROUTE_ROOTS, detailParagraphs, isAllowedAppRoute } from './announcementRules.ts';
import { ENGAGE_FAMILIES, type EngageFamily } from './mediNotificationBrain.shared.ts';
import { engageDestination } from './notificationPlan.ts';
import { mediRoute, legacyChatRouteToMedi } from './mediModes.ts';

const serverFlags = readFileSync(new URL('../../../server/src/lib/featureFlags.js', import.meta.url), 'utf8');
const serverNews = readFileSync(new URL('../../../server/src/lib/announcements.js', import.meta.url), 'utf8');
const EMPTY = sanitizeFeatureState(null);

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
      [['chat', '[mode]'], 'medi'],
      [['news', '[id]'], 'news'],
      // Medi's tools have switches of their own; the server reports them off while Medi is off.
      [['symptoms'], 'symptoms'],
      [['symptoms', 'results'], 'symptoms'],
      [['module', 'skin'], 'skin'],
      [['module', 'skincare'], 'skin'],
      [['module', 'imaging'], 'imaging'],
      [['module', 'lab'], 'labs'],
      [['module', 'other'], 'medi'],
      [['lab'], 'labs'],
      [['lab', '[date]'], 'labs'],
      [['lab', 'param', '[key]'], 'labs'],
      [['lab', 'analyze'], 'labs'],
      [['visits'], 'visits'],
      [['visits', 'editor'], 'visits'],
      [['medications'], 'medications'],
      [['medications', 'add', 'search'], 'medications'],
      [['record', '[id]'], 'records'],
      [['health-metrics'], null],
      [['health-metrics', 'index'], null],
      [['health-metrics', 'hydration', 'log'], 'hydration'],
      [['health-metrics', 'steps', 'goal', 'set'], 'steps'],
      [['health-metrics', 'weight', 'goal', 'target'], 'weight'],
      [['weather'], 'weather'],
      [['week'], 'weeklyReport'],
      [['profile', 'health-passport'], 'healthPassport'],
      [['profile', 'invite'], 'invites'],
      [['profile', 'invite-code'], 'invites'],
      [['invite', '[code]'], 'invites'],
      [['profile', 'notifications'], null],
      [['profile', 'streak'], null],
      [['explore'], null],
    ];
    for (const [segments, key] of cases) assert.equal(featureForPath(segments), key, segments.join('/'));
  });

  it('expo-router groups are not part of the route', () => {
    assert.equal(featureForPath(['(tabs)', 'medications']), 'medications');
    assert.equal(featureForPath(['(tabs)', 'records']), 'records');
    assert.equal(featureForPath(['(tabs)', 'home']), null);
    assert.equal(featureForPath(['(tabs)', 'profile']), null);
    assert.equal(featureForPath(['(auth)', 'sign-in']), null);
    assert.equal(featureForPath([]), null);
    assert.equal(featureForHref('/(tabs)/medications'), 'medications');
    assert.equal(featureForHref('/(tabs)/records'), 'records');
    assert.equal(featureForHref('/(tabs)/home'), null);
    assert.equal(featureForHref('/(tabs)/profile?action=question'), null);
  });

  it('reads Medi’s mode from the link', () => {
    assert.equal(featureForHref('/assistant'), 'medi');
    assert.equal(featureForHref('/assistant?mode=medi'), 'medi');
    assert.equal(featureForHref('/assistant?mode=doctor'), 'mediDoctor');
    assert.equal(featureForHref('/assistant?mode=deep'), 'mediDeep');
    assert.equal(featureForHref('/assistant?sessionId=s1&mode=CONSILIUM'), 'mediDeep');
    assert.equal(featureForHref(mediRoute({ mode: 'deep', sessionId: 's1', prefill: 'a&mode=doctor' })), 'mediDeep');
    assert.equal(featureForHref(mediRoute({ prefill: 'mode=deep' })), 'medi');
    assert.equal(featureForHref('/chat/doctor?sessionId=s1'), 'mediDoctor');
    assert.equal(featureForHref('/chat/consilium'), 'mediDeep');
    // Legacy chat links resolve exactly like the redirect does.
    for (const route of ['/chat/doctor', '/chat/DOCTOR?prefill=x', '/chat/consilium?sessionId=s', '/chat/CONSILIUM', '/chat/assistant']) {
      assert.equal(featureForHref(route), featureForHref(legacyChatRouteToMedi(route)), route);
    }
    assert.equal(featureForHref('/symptoms'), 'symptoms');
    assert.equal(featureForHref('/health-metrics'), null);
    assert.equal(featureForHref('/health-metrics/weight'), 'weight');
    assert.equal(featureForHref('/weather?from=push'), 'weather');
    assert.equal(featureForHref('/visits/editor?id=v1#top'), 'visits');
    assert.equal(featureForHref('/profile/invite-code?code=ABC123'), 'invites');
    assert.equal(featureForHref(''), null);
  });

  it('hides only entries of paused modules', () => {
    const state = sanitizeFeatureState({ flags: { cycle: false, mediVet: false } });
    assert.equal(hrefAvailableIn(state, '/cycle'), false);
    assert.equal(hrefAvailableIn(state, '/pets'), true);
    assert.equal(hrefAvailableIn(state, '/pets/abc/chat'), false);
    assert.equal(hrefAvailableIn(state, '/nutrition'), true);
    assert.equal(hrefAvailableIn(state, '/visits'), true);
  });

  it('a paused Medi mode hides only that mode', () => {
    const deepOff = sanitizeFeatureState({ flags: { mediDeep: false } });
    assert.equal(hrefAvailableIn(deepOff, '/assistant'), true);
    assert.equal(hrefAvailableIn(deepOff, '/assistant?mode=doctor'), true);
    assert.equal(hrefAvailableIn(deepOff, '/assistant?mode=deep'), false);
    // Medi off: the server reports every child off too (effective state), lab results stay.
    const mediOff = sanitizeFeatureState({
      flags: { medi: false, mediDoctor: false, mediDeep: false, symptoms: false, imaging: false, skin: false, voice: false },
    });
    for (const href of ['/assistant', '/assistant?mode=doctor', '/assistant?mode=deep', '/symptoms', '/module/imaging', '/module/skin', '/module/skincare']) {
      assert.equal(hrefAvailableIn(mediOff, href), false, href);
    }
    assert.equal(hrefAvailableIn(mediOff, '/lab'), true);
    // MEDISCAN: each choice follows its own switch; the screen without a choice stays reachable.
    assert.equal(hrefAvailableIn(mediOff, '/scan?type=imaging'), false);
    assert.equal(hrefAvailableIn(mediOff, '/scan?type=skin'), false);
    assert.equal(hrefAvailableIn(mediOff, '/scan?type=lab'), true);
    assert.equal(hrefAvailableIn(mediOff, '/scan'), true);
    assert.equal(hrefAvailableIn(mediOff, '/(tabs)/records'), true);
  });

  it('new module switches hide their own entries', () => {
    const all = sanitizeFeatureState({
      flags: Object.fromEntries(
        ['visits', 'medications', 'records', 'labs', 'hydration', 'steps', 'weight', 'weather', 'weeklyReport', 'healthPassport', 'invites'].map((k) => [k, false]),
      ),
    });
    for (const href of [
      '/visits', '/(tabs)/medications', '/medications/add', '/(tabs)/records', '/record/r1', '/lab', '/module/lab',
      '/health-metrics/hydration', '/health-metrics/steps', '/health-metrics/weight', '/weather', '/week',
      '/profile/health-passport', '/profile/invite', '/profile/invite-code', '/invite/ABC123',
    ]) {
      assert.equal(hrefAvailableIn(all, href), false, href);
    }
    for (const href of ['/health-metrics', '/(tabs)/home', '/(tabs)/profile', '/profile/notifications', '/explore', '/assistant']) {
      assert.equal(hrefAvailableIn(all, href), true, href);
    }
  });

  it('every app switch exists on the server', () => {
    for (const key of FEATURE_KEYS) assert.match(serverFlags, new RegExp(`key: '${key}'`), key);
  });
});

describe('module switches and the Notification Brain', () => {
  it('a paused module stops only its own families', () => {
    const state = sanitizeFeatureState({ flags: { weather: false, weeklyReport: false, visits: false, hydration: false, steps: false } });
    for (const family of ['weatherWellness', 'weekly', 'feature', 'visitFollowup', 'hydration', 'stepsQuiet']) {
      assert.equal(engageFamilyOnIn(state, family), false, family);
      assert.equal(engageFamilyOnIn(EMPTY, family), true, family);
    }
    for (const family of ['birthday', 'checkin', 'morning', 'reengage', 'insight', 'questSmart', 'constructor', '']) {
      assert.equal(engageFamilyOnIn(state, family), true, family);
    }
  });

  it('each switchable family has a topic no other family uses and opens its own module', () => {
    const families = Object.keys(ENGAGE_FAMILIES) as EngageFamily[];
    for (const [family, key] of ENGAGE_FAMILY_FEATURES) {
      assert.ok(family in ENGAGE_FAMILIES, `${family} is not an engage family`);
      const topic = ENGAGE_FAMILIES[family as EngageFamily].topic;
      const sharing = families.filter((other) => other !== family && ENGAGE_FAMILIES[other].topic === topic);
      assert.deepEqual(sharing, [], `${family} shares topic ${topic}`);
      assert.equal(featureForHref(engageDestination(family, { visitId: 'v1' })), key, family);
    }
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
