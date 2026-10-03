// „თვალყურის დევნება“ / Tracking (`expectsBleeding: false`) and „ნაყოფიერი დღეების ჩვენება“
// (`fertilityDisplay`) — brief §9 wave 2 item 17, [კ-7]. No database: raw-SQL storage is exercised
// with a fake client, the route through its exported zod schema.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCycleAiUserPrompt, buildPredictions, detectLatePeriod } from './cycle.js';
import {
  applyFertilityDisplay,
  interpretContraception,
  presentPredictions,
  presentTodayPhase,
  contraceptionInsightsFilter,
} from './cycleContraception.js';
import {
  applyForecastEligibilityToPredictions,
  evaluateForecastEligibility,
  FORECAST_ELIGIBILITY_REASON,
  FORECAST_GATE_KIND_POSTPARTUM_RETURN,
  publicForecastEligibility,
} from './cyclePostpartumReturnForecast.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { cycleTrackingPatch, readCycleTrackingPrefs, writeCycleTrackingPrefs } from './cycleTrackingPrefs.js';
import { cycleTrackingStatements } from '../../scripts/install-cycle-tracking.mjs';

const LMP = '2026-08-01';
const TODAY = '2026-08-12';

function ready() {
  return buildPredictions({
    lastPeriodStart: LMP,
    avgCycleLength: 28,
    avgPeriodLength: 5,
    cycleCount: 4,
    logs: [{ date: LMP, flow: 'medium' }],
    today: TODAY,
  });
}

const contraFor = (mode, prefs, method = null) =>
  applyFertilityDisplay(interpretContraception({ mode, contraceptionMethod: method }), { mode, prefs });

describe('storage: SQL, install guard, raw reads with defaults', () => {
  it('the SQL file only adds the two defaulted columns', () => {
    const sql = readFileSync(new URL('../../prisma/20261003-cycle-tracking.sql', import.meta.url), 'utf8');
    assert.equal(cycleTrackingStatements(sql).length, 2);
    assert.throws(() => cycleTrackingStatements('DROP TABLE "CycleProfile";'), /non-additive/);
    assert.throws(
      () => cycleTrackingStatements('ALTER TABLE "CycleProfile" DROP COLUMN "expectsBleeding";'),
      /non-additive/,
    );
  });

  it('schema.prisma keeps the fields @ignore (raw SQL only)', () => {
    const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
    assert.match(schema, /expectsBleeding\s+Boolean\s+@default\(true\) @ignore/);
    assert.match(schema, /fertilityDisplay\s+String\s+@default\("auto"\) @ignore/);
  });

  it('a database without the columns still serves the defaults', async () => {
    const db = { $queryRaw: async () => { throw new Error('column "expectsBleeding" does not exist'); } };
    const warn = console.warn;
    console.warn = () => {};
    try {
      assert.deepEqual(await readCycleTrackingPrefs(db, 'u1'), { expectsBleeding: true, fertilityDisplay: 'auto' });
    } finally {
      console.warn = warn;
    }
    const stored = { $queryRaw: async () => [{ expectsBleeding: false, fertilityDisplay: 'off' }] };
    assert.deepEqual(await readCycleTrackingPrefs(stored, 'u1'), { expectsBleeding: false, fertilityDisplay: 'off' });
    const none = { $queryRaw: async () => [] };
    assert.deepEqual(await readCycleTrackingPrefs(none, 'u1'), { expectsBleeding: true, fertilityDisplay: 'auto' });
  });

  it('writes only the given fields and fails with a bilingual 503', async () => {
    const calls = [];
    const db = { $executeRaw: async (strings, ...values) => { calls.push(values); return 1; } };
    await writeCycleTrackingPrefs(db, 'u1', { expectsBleeding: false });
    assert.deepEqual(calls[0], [false, null, 'u1']);
    await writeCycleTrackingPrefs(db, 'u1', null);
    assert.equal(calls.length, 1);
    const broken = { $executeRaw: async () => { throw new Error('missing column'); } };
    const error = console.error;
    console.error = () => {};
    try {
      await assert.rejects(writeCycleTrackingPrefs(broken, 'u1', { fertilityDisplay: 'off' }), (err) => {
        assert.equal(err.status, 503);
        assert.ok(err.messageEn);
        return true;
      });
    } finally {
      console.error = error;
    }
    assert.deepEqual(cycleTrackingPatch({ expectsBleeding: true, fertilityDisplay: 'off', mode: 'TRACK_PERIOD' }), {
      expectsBleeding: true,
      fertilityDisplay: 'off',
    });
    assert.equal(cycleTrackingPatch({ mode: 'TRACK_PERIOD' }), null);
  });
});

describe('PUT /api/cycle/profile validation', () => {
  it('accepts the two fields, keeps them optional for older builds, rejects junk', async () => {
    const { profileUpdateSchema } = await import('../routes/cycle.routes.js');
    assert.deepEqual(profileUpdateSchema.parse({}), {});
    assert.deepEqual(profileUpdateSchema.parse({ expectsBleeding: false, fertilityDisplay: 'off' }), {
      expectsBleeding: false,
      fertilityDisplay: 'off',
    });
    assert.equal(profileUpdateSchema.safeParse({ fertilityDisplay: 'on' }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ fertilityDisplay: 'hidden' }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ expectsBleeding: 'no' }).success, false);
  });
});

describe('forecast eligibility: Tracking', () => {
  it('TRACK_PERIOD + expectsBleeding false → not allowed, NOT_EXPECTING_BLEEDING', () => {
    const e = evaluateForecastEligibility({ mode: 'TRACK_PERIOD', expectsBleeding: false });
    assert.deepEqual(e, { allowed: false, reason: FORECAST_ELIGIBILITY_REASON.NOT_EXPECTING_BLEEDING });
    assert.deepEqual(publicForecastEligibility(e), e);
    // Wins over the postpartum-return gate too.
    assert.equal(
      evaluateForecastEligibility({
        mode: 'TRACK_PERIOD',
        expectsBleeding: false,
        forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
        forecastGateEpisodeId: 'ep',
      }).reason,
      FORECAST_ELIGIBILITY_REASON.NOT_EXPECTING_BLEEDING,
    );
  });

  it('defaults and other modes keep today’s answer', () => {
    assert.deepEqual(evaluateForecastEligibility({}), { allowed: true, reason: 'STANDARD' });
    assert.deepEqual(evaluateForecastEligibility({ mode: 'TRACK_PERIOD' }), { allowed: true, reason: 'STANDARD' });
    assert.deepEqual(evaluateForecastEligibility({ mode: 'TRY_TO_CONCEIVE', expectsBleeding: false }), {
      allowed: true,
      reason: 'STANDARD',
    });
  });

  it('a gated forecast keeps logged bleeding (a manual new cycle) and drops everything estimated', () => {
    const preds = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 4,
      logs: [{ date: LMP, flow: 'light' }],
      today: TODAY,
    });
    const gated = applyForecastEligibilityToPredictions(preds, { allowed: false, reason: 'NOT_EXPECTING_BLEEDING' });
    assert.equal(gated.nextPeriodStart, null);
    assert.equal(gated.fertileWindow, null);
    assert.equal(gated.ovulationDate, null);
    assert.equal(gated.calendar[LMP].period, true);
    assert.equal(Object.values(gated.calendar).some((m) => m.fertile || m.ovulation || m.predicted), false);
  });

  it('no late state and its own reason', () => {
    const late = detectLatePeriod({
      today: '2026-10-20',
      profile: { mode: 'TRACK_PERIOD' },
      logs: [{ date: LMP, flow: 'medium' }],
      predictions: { nextPeriodStart: '2026-08-29' },
      inferred: { periodRanges: [] },
      forecastEligibility: { allowed: false, reason: 'NOT_EXPECTING_BLEEDING' },
    });
    assert.equal(late.status, 'unknown');
    assert.equal(late.reason, 'not_expecting_bleeding');
    assert.equal(late.notifyEligible, false);
  });
});

describe('fertile-days display on the contraception presentation', () => {
  it('auto changes nothing (older bundles look the same)', () => {
    const c = contraFor('TRACK_PERIOD', {});
    assert.equal(c.presentation.showFertileWindow, true);
    assert.equal(c.presentation.fertilityHidden, false);
    assert.deepEqual(c.presentation.fertilityDisplay, { setting: 'auto', effective: 'on', forcedBy: null, userCanChange: true });
    const p = ready();
    assert.deepEqual(presentPredictions(p, c), { ...p, calendar: { ...p.calendar } });
  });

  it('her „off“ hides the three flags, predictions and phase words; the period forecast stays', () => {
    const c = contraFor('TRACK_PERIOD', { fertilityDisplay: 'off' });
    assert.equal(c.presentation.showFertileWindow, false);
    assert.equal(c.presentation.showOvulationDate, false);
    assert.equal(c.presentation.showFertilityMarkers, false);
    assert.equal(c.presentation.fertilityHidden, true);
    assert.equal(c.presentation.fertilityDisplay.forcedBy, null);
    const raw = ready();
    assert.ok(raw.fertileWindow && raw.ovulationRange);
    const p = presentPredictions(raw, c, 'ka', { avgCycleLength: 28 });
    assert.equal(p.nextPeriodStart, raw.nextPeriodStart);
    assert.equal(p.fertileWindow, null);
    assert.equal(p.ovulationDate, null);
    assert.equal(p.ovulationRange, null);
    assert.equal(p.fertility.hidden, true);
    assert.equal(p.phases.some((ph) => ph.fertileStart || ph.ovulation), false);
    for (const mark of Object.values(p.calendar)) {
      assert.equal(Boolean(mark.fertile || mark.ovulation), false);
      assert.equal(mark.phase === 'fertile' || mark.phase === 'ovulation', false);
    }
    // Engine output untouched.
    assert.ok(Object.values(raw.calendar).some((m) => m.fertile));
    const today = presentTodayPhase({ day: 16, phase: 'ovulation', phaseKa: 'ოვულაცია' }, c, 'ka', { avgCycleLength: 28 });
    assert.equal(today.phase, 'luteal');
    assert.deepEqual(
      contraceptionInsightsFilter([{ id: 'ttc_window' }, { id: 'phase_today' }], c).map((x) => x.id),
      ['phase_today'],
    );
  });

  it('trying to conceive forces it on; hormonal contraception forces it off through the existing rule', () => {
    const ttc = contraFor('TRY_TO_CONCEIVE', { fertilityDisplay: 'off' });
    assert.equal(ttc.presentation.showFertileWindow, true);
    assert.equal(ttc.presentation.fertilityHidden, false);
    assert.equal(ttc.presentation.fertilityDisplay.forcedBy, 'ttc');
    const pill = contraFor('TRACK_PERIOD', { fertilityDisplay: 'auto' }, 'COMBINED_PILL');
    assert.equal(pill.presentation.showFertileWindow, false);
    assert.equal(pill.presentation.fertilityHidden, false);
    assert.deepEqual(pill.presentation.fertilityDisplay, {
      setting: 'auto',
      effective: 'off',
      forcedBy: 'contraception',
      userCanChange: false,
    });
    // Hormonal IUD stays a caution method: her choice still applies.
    const iud = contraFor('TRACK_PERIOD', { fertilityDisplay: 'off' }, 'HORMONAL_IUD');
    assert.equal(iud.presentation.fertilityDisplay.userCanChange, true);
    assert.equal(iud.presentation.showFertileWindow, false);
  });

  it('Tracking hides fertility as well (forcedBy tracking)', () => {
    const c = contraFor('TRACK_PERIOD', { expectsBleeding: false });
    assert.equal(c.presentation.fertilityHidden, true);
    assert.equal(c.presentation.fertilityDisplay.forcedBy, 'tracking');
  });

  it('the AI prompt never mentions fertile days she turned off', () => {
    const c = contraFor('TRACK_PERIOD', { fertilityDisplay: 'off' });
    const predictions = presentPredictions(ready(), c, 'ka', { avgCycleLength: 28 });
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, conditions: [] },
      logs: [],
      predictions,
      user: { age: 30 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5 },
      today: TODAY,
      contraception: c,
      forecastEligibility: { allowed: true },
    });
    assert.equal(prompt.includes('სავარაუდო ნაყოფიერი ფანჯარა'), false);
    assert.match(prompt, /ნაყოფიერი დღეების ჩვენება გამორთო/);
  });
});

describe('partner view', () => {
  const profile = { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: LMP, isIrregular: false };
  const logs = [
    { date: '2026-05-02', flow: 'medium' },
    { date: '2026-05-30', flow: 'medium' },
    { date: '2026-06-27', flow: 'medium' },
    { date: '2026-07-25', flow: 'medium' },
    { date: LMP, flow: 'medium' },
  ];
  const permissions = { period: true, cyclePhase: true, fertileWindow: true, symptoms: false };

  it('without tracking options the payload is unchanged', () => {
    const a = buildPartnerPayload({ profile, logs, permissions, today: TODAY });
    const b = buildPartnerPayload({ profile, logs, permissions, today: TODAY, tracking: null });
    assert.deepEqual(a, b);
  });

  it('hidden fertile days share no window and no fertile phase word', () => {
    const p = buildPartnerPayload({ profile, logs, permissions, today: TODAY, tracking: { hideFertility: true } });
    assert.deepEqual(p.fertileWindow, { start: null, end: null, ovulationDate: null, ovulationRange: null, estimated: true });
    assert.notEqual(p.phase.phase, 'fertile');
    assert.notEqual(p.phase.phase, 'ovulation');
    assert.ok(p.period.nextPeriodStart);
    assert.equal(partnerPayloadHasLeak(p), false);
  });

  it('Tracking shares no next period and no phase; a logged bleed today still shows', () => {
    const p = buildPartnerPayload({
      profile,
      logs: [...logs, { date: TODAY, flow: 'light' }],
      permissions,
      today: TODAY,
      tracking: { trackingOnly: true },
    });
    assert.equal(p.period.nextPeriodStart, null);
    assert.equal(p.period.inPeriod, true);
    assert.equal(p.period.inPeriodEstimated, false);
    assert.equal(p.phase.phase, 'unknown');
    assert.equal(p.fertileWindow.start, null);
  });
});
