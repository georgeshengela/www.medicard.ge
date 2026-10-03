import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeSectionOrder, HOME_LAYOUT_ORDER, HOME_LAYOUT_SPOTLIGHT } from './homeSectionOrder.ts';

test('women-only section is opt-in and does not reorder common destinations', () => {
  const standard = buildHomeSectionOrder();
  const withCycle = buildHomeSectionOrder({ includeCycle: true });
  assert.equal(standard.includes('cycle'), false);
  assert.equal(withCycle.filter((id) => id === 'cycle').length, 1);
  assert.deepEqual(withCycle.filter((id) => id !== 'cycle'), standard);
});

test('today first, then daily habits, then discovery; every section is unique', () => {
  const order = buildHomeSectionOrder({ includeCycle: true });
  assert.equal(order[0], 'dashboard');
  assert.ok(order.indexOf('hero') < order.indexOf('ask'));
  assert.ok(order.indexOf('nextDose') < order.indexOf('cycle'));
  assert.ok(order.indexOf('cycle') < order.indexOf('nutrition'));
  assert.ok(order.indexOf('nutrition') < order.indexOf('checkup'));
  assert.ok(order.indexOf('checkup') < order.indexOf('services'));
  assert.equal(order.at(-1), 'disclaimer');
  assert.equal(new Set(order).size, order.length);
});

test('caller mutation cannot alter subsequent home composition', () => {
  const order = buildHomeSectionOrder();
  const baseline = [...order];
  order.reverse();
  assert.deepEqual(buildHomeSectionOrder(), baseline);
});

test('the onboarding goal moves its section right after ask Medi, nothing disappears', () => {
  const base = buildHomeSectionOrder({ includeCycle: true });
  const nutrition = buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'nutrition' });
  assert.equal(nutrition[nutrition.indexOf('ask') + 1], 'news');
  assert.equal(nutrition[nutrition.indexOf('ask') + 2], 'nutrition');
  assert.deepEqual([...nutrition].sort(), [...base].sort());
  const cycle = buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'cycle' });
  assert.equal(cycle[cycle.indexOf('ask') + 1], 'cycle');
  assert.deepEqual(buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'general' }), base);
  assert.deepEqual(buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'medications' }), base); // already right after ask
  // A man who somehow has the cycle goal does not get a cycle section.
  assert.ok(!buildHomeSectionOrder({ includeCycle: false, primaryGoal: 'cycle' }).includes('cycle'));
});

test('the trainer block sits with what is due today, before women’s health and nutrition', () => {
  const order = buildHomeSectionOrder({ includeCycle: true });
  assert.equal(order.indexOf('coach'), order.indexOf('nextDose') + 1);
  assert.ok(order.indexOf('coach') < order.indexOf('cycle'));
});

test('news sits directly above nutrition, wherever nutrition goes', () => {
  for (const primaryGoal of [undefined, 'nutrition', 'cycle', 'medications'] as const) {
    const order = buildHomeSectionOrder({ includeCycle: true, primaryGoal });
    assert.equal(order.indexOf('news') + 1, order.indexOf('nutrition'), String(primaryGoal));
  }
});

test('an admin-paused module drops its section and nothing else', () => {
  const base = buildHomeSectionOrder({ includeCycle: true });
  const paused = buildHomeSectionOrder({ includeCycle: true, hidden: new Set(['cycle', 'nutrition', 'coach']) });
  assert.deepEqual(paused, base.filter((id) => !['cycle', 'nutrition', 'coach'].includes(id)));
  // The goal of a paused module does not bring it back.
  assert.ok(!buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'nutrition', hidden: new Set(['nutrition']) }).includes('nutrition'));
});

test('standard keeps today’s Home and only gains the layout switch row before the disclaimer', () => {
  const order = buildHomeSectionOrder({ includeCycle: true });
  assert.deepEqual(order, [
    'dashboard', 'hero', 'ask', 'nextDose', 'coach', 'cycle', 'news', 'nutrition', 'checkup', 'profileNudge', 'services', 'customize', 'disclaimer',
  ]);
  assert.deepEqual(buildHomeSectionOrder({ layout: 'standard', includeCycle: true }), order);
});

test('a paused "ask Medi" never puts the goal block or the offer above the header', () => {
  for (const primaryGoal of ['nutrition', 'cycle', 'medications'] as const) {
    const order = buildHomeSectionOrder({ includeCycle: true, primaryGoal, hidden: new Set(['ask']), offer: true });
    assert.equal(order[0], 'dashboard', primaryGoal);
    assert.equal(order.at(-1), 'disclaimer', primaryGoal);
  }
});

const LAYOUTS = ['standard', 'women', 'active', 'weight'] as const;

test('every layout: header first, disclaimer last, switch row, ask Medi and doses near the top, unique ids', () => {
  for (const layout of LAYOUTS) {
    for (const includeCycle of [true, false]) {
      const order = buildHomeSectionOrder({ layout, includeCycle });
      assert.equal(order[0], 'dashboard', layout);
      assert.equal(order.at(-1), 'disclaimer', layout);
      assert.equal(order.at(-2), 'customize', layout);
      assert.equal(new Set(order).size, order.length, layout);
      assert.ok(order.includes('ask') && order.indexOf('ask') <= 3, `${layout} ask`);
      assert.ok(order.includes('nextDose') && order.indexOf('nextDose') <= 4, `${layout} nextDose`);
      assert.ok(order.includes('news'), `${layout} news`);
    }
  }
});

test('cycle sections are for women only, each layout leads with its own hero', () => {
  for (const layout of LAYOUTS) {
    const order = buildHomeSectionOrder({ layout, includeCycle: false });
    for (const id of ['cycle', 'cycleHero', 'cycleAhead', 'cycleTips', 'cycleStats'] as const) assert.ok(!order.includes(id), `${layout} ${id}`);
  }
  assert.equal(buildHomeSectionOrder({ layout: 'women', includeCycle: true })[1], 'cycleHero');
  assert.equal(buildHomeSectionOrder({ layout: 'active', includeCycle: true })[1], 'moveHero');
  assert.equal(buildHomeSectionOrder({ layout: 'weight', includeCycle: true })[1], 'energy');
  // Women who pick another layout keep their cycle glance.
  assert.ok(buildHomeSectionOrder({ layout: 'active', includeCycle: true }).includes('cycle'));
  assert.ok(buildHomeSectionOrder({ layout: 'weight', includeCycle: true }).includes('cycle'));
});

test('women: the cycle, what is ahead and tips come before her day; numbers and check-ups after it', () => {
  const order = buildHomeSectionOrder({ layout: 'women', includeCycle: true });
  const at = (id: (typeof order)[number]) => order.indexOf(id);
  assert.ok(at('cycleHero') < at('cycleAhead') && at('cycleAhead') < at('cycleTips') && at('cycleTips') < at('dayPair'));
  assert.equal(at('nutritionLite'), at('dayPair') + 1);
  assert.ok(at('dayPair') < at('cycleStats') && at('cycleStats') < at('womenCare') && at('womenCare') < at('services'));
  for (const layout of ['standard', 'active', 'weight'] as const) {
    assert.ok(!HOME_LAYOUT_ORDER[layout].includes('womenCare') && !HOME_LAYOUT_ORDER[layout].includes('cycleAhead'), layout);
  }
});

test('the onboarding goal reorders standard only', () => {
  for (const layout of ['women', 'active', 'weight'] as const) {
    assert.deepEqual(
      buildHomeSectionOrder({ layout, includeCycle: true, primaryGoal: 'nutrition' }),
      buildHomeSectionOrder({ layout, includeCycle: true }),
    );
  }
});

test('the one-time offer sits right after the doses due', () => {
  for (const layout of LAYOUTS) {
    const order = buildHomeSectionOrder({ layout, includeCycle: true, offer: true });
    assert.equal(order[order.indexOf('nextDose') + 1], 'layoutOffer', layout);
    assert.ok(!buildHomeSectionOrder({ layout, includeCycle: true }).includes('layoutOffer'));
  }
  const noDoses = buildHomeSectionOrder({ includeCycle: true, offer: true, hidden: new Set(['nextDose']) });
  assert.equal(noDoses[noDoses.indexOf('ask') + 1], 'layoutOffer');
});

test('at most one spotlight per layout', () => {
  for (const layout of LAYOUTS) {
    const spot = HOME_LAYOUT_SPOTLIGHT[layout];
    if (spot) assert.ok(HOME_LAYOUT_ORDER[layout].includes(spot), layout);
    for (const other of Object.values(HOME_LAYOUT_SPOTLIGHT)) {
      if (other && other !== spot) assert.ok(!HOME_LAYOUT_ORDER[layout].includes(other), `${layout} also has ${other}`);
    }
  }
});
