import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableHomeLayouts,
  homeLayoutAvailable,
  omitHomeLayoutKeys,
  parseHomeLayout,
  recommendedHomeLayout,
  resolveHomeLayout,
  storedHomeLayout,
} from './homeLayout.ts';

const ON = { flags: {}, messages: {} };
const off = (...keys: string[]) => ({ flags: Object.fromEntries(keys.map((k) => [k, false])), messages: {} });

test('only the four known ids parse', () => {
  assert.equal(parseHomeLayout('women'), 'women');
  assert.equal(parseHomeLayout('WOMEN'), null);
  assert.equal(parseHomeLayout('cycle'), null);
  assert.equal(parseHomeLayout(undefined), null);
  assert.deepEqual(storedHomeLayout({ homeLayout: 'active', homeLayoutOfferDone: true }), { layout: 'active', offerDone: true });
  assert.deepEqual(storedHomeLayout(null), { layout: null, offerDone: false });
});

test('the women’s layout is offered to women only; standard is always last', () => {
  assert.deepEqual(availableHomeLayouts('FEMALE'), ['women', 'active', 'weight', 'standard']);
  assert.deepEqual(availableHomeLayouts('MALE'), ['active', 'weight', 'standard']);
  assert.deepEqual(availableHomeLayouts(null), ['active', 'weight', 'standard']);
});

test('a layout whose modules are paused cannot be shown; standard always can', () => {
  assert.equal(homeLayoutAvailable('women', 'FEMALE', ON), true);
  assert.equal(homeLayoutAvailable('women', 'MALE', ON), false);
  assert.equal(homeLayoutAvailable('women', 'FEMALE', off('cycle')), false);
  assert.equal(homeLayoutAvailable('active', 'MALE', off('steps', 'hydration')), true);
  assert.equal(homeLayoutAvailable('active', 'MALE', off('steps', 'hydration', 'medirun')), false);
  assert.equal(homeLayoutAvailable('weight', 'MALE', off('nutrition')), true);
  assert.equal(homeLayoutAvailable('weight', 'MALE', off('nutrition', 'weight')), false);
  assert.equal(homeLayoutAvailable('standard', 'MALE', off('homeLayouts')), true);
  assert.equal(homeLayoutAvailable('active', 'MALE', off('homeLayouts')), false);
});

test('resolution: the choice wins, standard while it cannot be shown, kill switch shows standard', () => {
  const base = { offerDone: true, gender: 'FEMALE', features: ON };
  assert.equal(resolveHomeLayout({ ...base, chosen: 'women' }).layout, 'women');
  assert.equal(resolveHomeLayout({ ...base, chosen: 'women', features: off('cycle') }).layout, 'standard');
  assert.equal(resolveHomeLayout({ ...base, chosen: 'women', features: off('cycle') }).chosen, 'women');
  assert.equal(resolveHomeLayout({ ...base, chosen: 'women', gender: 'MALE' }).layout, 'standard');
  assert.equal(resolveHomeLayout({ ...base, chosen: 'active', features: off('homeLayouts') }).layout, 'standard');
  assert.equal(resolveHomeLayout({ ...base, chosen: null }).layout, 'standard');
});

test('the one-time offer: women without a choice, not answered, cycle not locked', () => {
  const offer = (o: Partial<Parameters<typeof resolveHomeLayout>[0]>) =>
    resolveHomeLayout({ chosen: null, offerDone: false, gender: 'FEMALE', features: ON, cycleLocked: false, ...o }).offer;
  assert.equal(offer({}), true);
  assert.equal(offer({ offerDone: true }), false);
  assert.equal(offer({ chosen: 'standard' }), false);
  assert.equal(offer({ gender: 'MALE' }), false);
  assert.equal(offer({ cycleLocked: true }), false);
  assert.equal(offer({ features: off('cycle') }), false);
  assert.equal(offer({ features: off('homeLayouts') }), false);
});

test('recommendation badge: women → women’s, nutrition goal → nutrition & weight, else standard', () => {
  assert.equal(recommendedHomeLayout('general', 'FEMALE', ON), 'women');
  assert.equal(recommendedHomeLayout('nutrition', 'FEMALE', ON), 'women');
  assert.equal(recommendedHomeLayout('nutrition', 'MALE', ON), 'weight');
  assert.equal(recommendedHomeLayout('medications', 'MALE', ON), 'standard');
  assert.equal(recommendedHomeLayout('general', 'FEMALE', off('cycle')), 'standard');
});

test('full-profile writers drop only the layout keys', () => {
  const extra = { homeLayout: 'women', homeLayoutOfferDone: true, avatarId: 'a', primaryGoal: 'cycle' };
  assert.deepEqual(omitHomeLayoutKeys(extra), { avatarId: 'a', primaryGoal: 'cycle' });
  assert.equal(extra.homeLayout, 'women');
});
