import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentPageKey, decideNavigation, historyPages, hrefKey, type NavIntent, type NavRoute, type NavState } from './navigationPolicy.ts';

let seq = 0;
const stack = (key: string, routes: NavRoute[], index = routes.length - 1): NavState => ({ key, type: 'stack', index, routes });
const screen = (name: string, params?: Record<string, unknown>, state?: NavState): NavRoute => ({ key: `${name}-${++seq}`, name, params, state });
const tabs = (...names: string[]) => screen('(tabs)', undefined, stack('tabs', names.map((name) => screen(name))));
// The shape expo-router really hands out (read from the web build): the app stack sits under `__root`.
const root = (...routes: NavRoute[]) => stack('container', [screen('__root', undefined, stack('root', routes))]);

const decide = (intent: NavIntent, href: string | { pathname: string; params?: Record<string, unknown> }, state: NavState, extra: { recent?: { key: string; at: number } | null; pending?: boolean; now?: number } = {}) =>
  decideNavigation({ intent, href, root: state, recent: extra.recent ?? null, pending: extra.pending ?? false, now: extra.now ?? 10_000 }).decision;

describe('page keys', () => {
  it('drops groups and index, sorts the query', () => {
    assert.equal(hrefKey('/(tabs)/home'), '/home');
    assert.equal(hrefKey('/run/index'), '/run');
    assert.equal(hrefKey('/run?b=2&a=1#x'), '/run?a=1&b=2');
    assert.equal(hrefKey('/lab/param/' + encodeURIComponent('Hb A1c')), '/lab/param/Hb A1c');
    assert.equal(hrefKey({ pathname: '/pets/[id]/care/complete', params: { id: 7, scheduleId: 's1' } }), '/pets/7/care/complete?scheduleId=s1');
  });

  it('leaves relative and external links alone', () => {
    assert.equal(hrefKey('details'), null);
    assert.equal(hrefKey('https://medicard.ge'), null);
    assert.equal(hrefKey('//medicard.ge'), null);
    assert.equal(hrefKey({ pathname: '/run/[id]', params: {} }), null);
  });

  it('reads the page on screen and the pages under it from the navigation state', () => {
    const state = root(tabs('home'), screen('run', undefined, stack('run', [screen('index'), screen('[id]', { id: 'w1', video: '1' })])));
    assert.equal(currentPageKey(state), '/run/w1?video=1');
    assert.deepEqual(historyPages(state).map((page) => page.key), ['/run', '/home']);
  });

  it('follows a nested screen that has not mounted yet', () => {
    const state = root(tabs('home'), screen('lab', { screen: '[date]', params: { date: '2026-10-01' } }));
    assert.equal(currentPageKey(state), '/lab/2026-10-01');
  });
});

describe('MEDIRUN finish (owner 2026-10-10)', () => {
  const finished = () => root(tabs('home'), screen('run', undefined, stack('run', [screen('index'), screen('summary')])));

  it('„Back to MEDIRUN“ returns to the hub instead of stacking a second one', () => {
    assert.deepEqual(decide('replace', '/run', finished()), { kind: 'pop', pop: { target: 'run', count: 1 } });
  });

  it('the badge cannot open a second summary right after the map did', () => {
    const recent = { key: '/run/summary', at: 9_800 };
    assert.deepEqual(decide('push', '/run/summary', finished(), { recent }), { kind: 'skip', reason: 'repeat' });
  });

  it('„MEDICARD home“ returns to the one tab root', () => {
    assert.deepEqual(decide('replace', '/(tabs)/home', finished()), {
      kind: 'tab', tab: 'home', query: '', pops: [{ target: 'root', count: 1 }], switchTab: false,
    });
  });
});

describe('replace after a save', () => {
  it('a pet weight goes back to the list under it', () => {
    const weight = stack('weight', [screen('index'), screen('new')]);
    const pet = stack('pet', [screen('index'), screen('weight', undefined, weight)]);
    const state = root(tabs('home'), screen('pets', undefined, stack('pets', [screen('index'), screen('[id]', { id: '7' }, pet)])));
    assert.deepEqual(decide('replace', '/pets/7/weight', state), { kind: 'pop', pop: { target: 'weight', count: 1 } });
  });

  it('finds the page further down, and a new page still replaces', () => {
    const state = root(tabs('home'), screen('visits', undefined, stack('visits', [screen('index'), screen('[id]', { id: 'v1' }), screen('editor', { id: 'v1' })])));
    assert.deepEqual(decide('replace', '/visits', state), { kind: 'pop', pop: { target: 'visits', count: 2 } });
    assert.deepEqual(decide('replace', '/visits/v2', state), { kind: 'pass' });
  });

  it('a replace of the page on screen keeps its remount meaning', () => {
    const state = root(tabs('home'), screen('cycle', undefined, stack('cycle', [screen('index')])));
    assert.deepEqual(decide('replace', '/cycle', state), { kind: 'pass' });
  });
});

describe('pushes', () => {
  const hubThenGrand = () => root(tabs('home'), screen('run', undefined, stack('run', [screen('index'), screen('grand')])));

  it('the page already on screen does not open twice', () => {
    assert.deepEqual(decide('push', '/run/grand', hubThenGrand()), { kind: 'skip', reason: 'here' });
  });

  it('the page right underneath is reached by going back', () => {
    assert.deepEqual(decide('push', '/run', hubThenGrand()), { kind: 'pop', pop: { target: 'run', count: 1 } });
  });

  it('a page further down is opened as usual (only replace jumps back)', () => {
    const state = root(tabs('home'), screen('run', undefined, stack('run', [screen('index'), screen('grand'), screen('cities')])));
    assert.deepEqual(decide('push', '/run', state), { kind: 'pass' });
  });

  it('one-shot intents with a query always open fresh (Medi handoff)', () => {
    const state = root(tabs('home'), screen('assistant', { mode: 'doctor', handoff: '1' }), screen('lab', undefined, stack('lab', [screen('index')])));
    assert.deepEqual(decide('push', '/assistant?mode=doctor&handoff=1', state), { kind: 'pass' });
  });

  it('a second identical push while the first is still queued is dropped; others pass', () => {
    const state = hubThenGrand();
    const recent = { key: '/run/cities', at: 9_900 };
    assert.deepEqual(decide('push', '/run/cities', state, { recent, pending: true }), { kind: 'skip', reason: 'repeat' });
    assert.deepEqual(decide('push', '/run', state, { recent, pending: true }), { kind: 'pass' });
    assert.deepEqual(decide('push', '/run/cities', state, { recent, now: 9_900 + 800 }), { kind: 'pass' });
  });
});

describe('tabs are roots', () => {
  it('the tab bar switches in place', () => {
    assert.deepEqual(decide('replace', '/(tabs)/records', root(tabs('home'))), { kind: 'tab', tab: 'records', query: '', pops: [], switchTab: true });
    assert.deepEqual(decide('replace', '/(tabs)/home', root(tabs('home'))), { kind: 'skip', reason: 'here' });
  });

  it('the Home avatar opens Profile as a tab, not on top of Home', () => {
    assert.deepEqual(decide('push', '/(tabs)/profile', root(tabs('home'))), { kind: 'tab', tab: 'profile', query: '', pops: [], switchTab: true });
  });

  it('a flow can peek at another tab and come back; Home always returns to the root', () => {
    const state = root(tabs('home'), screen('symptoms', undefined, stack('symptoms', [screen('index'), screen('details')])));
    assert.deepEqual(decide('push', '/(tabs)/medications', state), { kind: 'pass' });
    assert.deepEqual(decide('push', '/(tabs)/home', state), { kind: 'tab', tab: 'home', query: '', pops: [{ target: 'root', count: 1 }], switchTab: false });
  });

  it('the tab bar on a peeked tab returns to the first tab root', () => {
    const state = root(tabs('home'), screen('symptoms'), tabs('medications'));
    assert.deepEqual(decide('replace', '/(tabs)/profile', state), { kind: 'tab', tab: 'profile', query: '', pops: [{ target: 'root', count: 2 }], switchTab: true });
  });

  it('dismissTo a tab (coach → personal mode) does the same', () => {
    const state = root(tabs('profile'), screen('coach', undefined, stack('coach', [screen('index'), screen('profile')])));
    assert.deepEqual(decide('dismissTo', '/(tabs)/home', state), { kind: 'tab', tab: 'home', query: '', pops: [{ target: 'root', count: 1 }], switchTab: true });
  });

  it('folds tabs that an older build stacked inside (tabs)', () => {
    const state = root(screen('(tabs)', undefined, stack('tabs', [screen('home'), screen('profile')])));
    assert.deepEqual(decide('replace', '/(tabs)/records', state), { kind: 'tab', tab: 'records', query: '', pops: [{ target: 'tabs', count: 1 }], switchTab: true });
  });

  it('before sign-in there is no tab root to return to', () => {
    assert.deepEqual(decide('replace', '/(tabs)/home', root(screen('(auth)'))), { kind: 'pass' });
  });
});
