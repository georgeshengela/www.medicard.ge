import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ka } from '../i18n/ka.ts';
import { cycleLegendClosingLine, cycleLegendItems, cycleLegendLabel } from './cycleLegendItems.ts';

const keys = (items: { key: string }[]) => items.map((i) => i.key);

test('calendar legend lists the marks in paint order with the calendar a11y labels', () => {
  const items = cycleLegendItems();
  assert.deepEqual(keys(items), ['logged', 'predicted', 'fertile', 'ovulation', 'symptom', 'spotting', 'sex']);
  assert.ok(items.every((i) => i.kind === 'mark'));
  assert.equal(items[0].label, ka.cycle.legendPeriod);
  assert.equal(items[1].label, ka.cycle.legendPeriodPredicted);
  assert.equal(items[2].label, ka.cycle.legendFertile);
  assert.equal(items[3].label, ka.cycle.legendOvulation);
  assert.equal(items[4].label, ka.cycle.legendLogged);
  assert.equal(items[5].label, ka.cycle.legendSpotting);
});

test('ring legend puts the four phases first, in cycle order', () => {
  const items = cycleLegendItems({ phases: true });
  assert.deepEqual(keys(items).slice(0, 4), ['periodPhase', 'follicular', 'fertilePhase', 'luteal']);
  assert.ok(items.slice(0, 4).every((i) => i.kind === 'phase'));
  assert.equal(items[1].label, ka.cycle.dialFollicular);
  assert.equal(items[3].label, ka.cycle.dialLuteal);
  assert.deepEqual(keys(cycleLegendItems({ phases: true, marks: false })), ['periodPhase', 'follicular', 'fertilePhase', 'luteal']);
});

test('contraception hides every fertility item — phases and marks alike', () => {
  const items = cycleLegendItems({ phases: true, showFertility: false });
  assert.deepEqual(keys(items), ['periodPhase', 'follicular', 'logged', 'predicted', 'symptom', 'spotting', 'sex']);
});

test('low confidence keeps logged facts and drops every estimate', () => {
  assert.deepEqual(keys(cycleLegendItems({ showPredicted: false })), ['logged', 'symptom', 'spotting', 'sex']);
});

test('postpartum: neutral bleed label and the classified ring', () => {
  const items = cycleLegendItems({ showOwnerClassified: true, loggedBleedLabel: 'სისხლდენა' });
  assert.deepEqual(keys(items).slice(0, 2), ['logged', 'classified']);
  assert.equal(items[0].label, 'სისხლდენა');
  assert.equal(items[1].label, ka.cycle.postpartumLegendClassified);
});

test('`only` keeps the order and filters (Home tray: exactly the marks its week shows)', () => {
  const items = cycleLegendItems({ only: ['ovulation', 'logged', 'sex'] });
  assert.deepEqual(keys(items), ['logged', 'ovulation', 'sex']);
  assert.deepEqual(keys(cycleLegendItems({ only: [] })), []);
});

test('every estimate label says სავარაუდო and the closing line names both ring-only phases', () => {
  for (const key of ['predicted', 'fertile', 'ovulation'] as const) {
    assert.match(cycleLegendLabel(key), /სავარაუდო/);
  }
  const line = cycleLegendClosingLine();
  assert.match(line, /ფოლიკულური/);
  assert.match(line, /ლუთეალური/);
  assert.match(line, /რგოლზე/);
});

test('before 3 cycles the ring keeps its luteal arc without the fertile one (showLuteal)', () => {
  const keys = (opts: Parameters<typeof cycleLegendItems>[0]) => cycleLegendItems(opts).map((i) => i.key);
  assert.deepEqual(keys({ phases: true, marks: false, showFertility: false, showLuteal: true }), ['periodPhase', 'follicular', 'luteal']);
  assert.deepEqual(keys({ phases: true, marks: false, showFertility: false }), ['periodPhase', 'follicular']);
  assert.deepEqual(keys({ phases: true, marks: false }), ['periodPhase', 'follicular', 'fertilePhase', 'luteal']);
  // Trying to conceive before 3 cycles: the wide window has no ovulation day, so no ovulation row.
  assert.deepEqual(keys({ showOvulation: false }), ['logged', 'predicted', 'fertile', 'symptom', 'spotting', 'sex']);
});
