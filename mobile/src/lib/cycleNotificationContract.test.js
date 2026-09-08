import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCycleCandidates,
  CYCLE_SUPPRESSION,
  cycleCandidateId,
  cycleDeliveryDecision,
  cyclePushPayload,
  getEffectiveCycleMask,
  LATE_NOTIFY_ELIGIBLE,
  maskedCopyIsSafe,
  pickCycleScheduleSet,
  redactCyclePushLog,
  revalidateCycleCandidate,
} from './cycleNotificationContract.js';

const today = '2026-09-15';

function prefs(over = {}) {
  return {
    enabled: true,
    periodDaysBefore: 2,
    ovulation: true,
    dailyLog: true,
    pms: true,
    opk: false,
    bbt: false,
    ...over,
  };
}

function predictions() {
  return {
    nextPeriodStart: '2026-09-20',
    ovulationDate: '2026-09-06',
    fertileWindow: { start: '2026-09-01', end: '2026-09-07' },
    estimated: true,
    confidence: 'high',
  };
}

describe('effective Cycle mask', () => {
  it('privacy false / mask false → unmasked', () => {
    assert.deepEqual(getEffectiveCycleMask({ privacyEnabled: false, maskNotifications: false }), {
      masked: false,
      source: null,
    });
  });

  it('privacy false / mask true → masked by explicit preference', () => {
    assert.equal(getEffectiveCycleMask({ privacyEnabled: false, maskNotifications: true }).source, 'maskNotifications');
  });

  it('privacy true / mask false → masked without rewriting stored mask', () => {
    const effective = getEffectiveCycleMask({ privacyEnabled: true, maskNotifications: false });
    assert.equal(effective.masked, true);
    assert.equal(effective.source, 'privacyEnabled');
  });

  it('privacy true / mask true → masked; turning privacy off would not clear stored mask', () => {
    assert.equal(getEffectiveCycleMask({ privacyEnabled: true, maskNotifications: true }).source, 'maskNotifications');
    assert.equal(getEffectiveCycleMask({ privacyEnabled: false, maskNotifications: true }).masked, true);
  });

  it('global discreet also masks Cycle copy', () => {
    assert.equal(
      getEffectiveCycleMask({ privacyEnabled: false, maskNotifications: false, discreet: true }).source,
      'discreet',
    );
  });
});

describe('masked Cycle copy', () => {
  it('cycle-masked fallback has no period/fertility/pregnancy words', () => {
    assert.equal(maskedCopyIsSafe('Medi-სგან შეხსენება', 'როცა დრო გექნება, შემომიარე 💚'), true);
    assert.equal(maskedCopyIsSafe('სავარაუდო ოვულაცია', 'ნაყოფიერი ფანჯარა'), false);
  });

  it('redacts Cycle title/body from analytics logs', () => {
    const redacted = redactCyclePushLog({
      key: 'cycle-ovulation',
      title: 'სავარაუდო ოვულაცია',
      body: 'ნაყოფიერი ფანჯარა',
    });
    assert.equal(redacted.title, '[cycle-redacted]');
    assert.doesNotMatch(redacted.body, /ოვულაც|ნაყოფიერ/);
  });
});

describe('Cycle candidates', () => {
  it('builds stable identities and never enables late push', () => {
    const rows = buildCycleCandidates({
      today,
      mode: 'TRACK_PERIOD',
      predictions: predictions(),
      prefs: prefs(),
      lateStatus: { status: 'late' },
    });
    const late = rows.find((row) => row.type === 'late');
    assert.equal(late.notifyEligible, LATE_NOTIFY_ELIGIBLE);
    assert.equal(late.notifyEligible, false);
    const start = rows.find((row) => row.type === 'period_start');
    assert.equal(start.candidateId, 'cycle:period_start:2026-09-20');
    assert.equal(start.estimated, true);
    assert.equal(start.predicted, true);
  });

  it('does not emit fertility candidates when markers are suppressed', () => {
    const rows = buildCycleCandidates({
      today,
      mode: 'TRY_TO_CONCEIVE',
      predictions: predictions(),
      prefs: prefs({ ovulation: true, opk: true }),
      showFertilityMarkers: false,
    });
    assert.equal(rows.some((row) => ['ovulation', 'fertile', 'opk'].includes(row.type)), false);
    assert.ok(rows.some((row) => row.type === 'period_start'));
  });

  it('suppresses fertility and period predictions in pregnancy mode', () => {
    const rows = buildCycleCandidates({
      today,
      mode: 'PREGNANCY',
      predictions: predictions(),
      prefs: prefs(),
      showFertilityMarkers: true,
    });
    assert.equal(rows.some((row) => row.type === 'ovulation' || row.type === 'period_start'), false);
  });

  it('picks one candidate per civil day by priority', () => {
    const rows = buildCycleCandidates({
      today: '2026-09-01',
      mode: 'TRY_TO_CONCEIVE',
      predictions: predictions(),
      prefs: prefs({ opk: true }),
      showFertilityMarkers: true,
    });
    const chosen = pickCycleScheduleSet(rows, '2026-09-01');
    const onFertileDay = chosen.filter((row) => row.eventDate === '2026-09-01');
    assert.equal(onFertileDay.length, 1);
    assert.equal(onFertileDay[0].type, 'fertile');
  });

  it('keeps payload free of cycleDay, symptoms, and sexual fields', () => {
    const payload = cyclePushPayload(
      {
        candidateId: 'cycle:ovulation:2026-09-06',
        type: 'ovulation',
        eventDate: '2026-09-06',
        templateKey: 'cycle-ovulation',
        route: '/cycle/log',
        estimated: true,
        predicted: true,
        revalidationKey: 'ovulationDate',
      },
      { masked: true },
    );
    assert.equal(payload.cycleDay, undefined);
    assert.equal(payload.symptoms, undefined);
    assert.equal(payload.ovulationDate, undefined);
    assert.equal(payload.templateKey, 'cycle-masked');
    assert.equal(payload.route, '/cycle/log');
  });
});

describe('Cycle candidate revalidation', () => {
  const live = {
    today,
    mode: 'TRACK_PERIOD',
    nextPeriodStart: '2026-09-20',
    ovulationDate: '2026-09-06',
    fertileWindowStart: '2026-09-01',
    periodDaysBefore: 2,
    showFertilityMarkers: true,
    prefsEnabled: true,
    globalEnabled: true,
    logs: [],
    typeEnabled: {
      period_soon: true,
      period_start: true,
      ovulation: true,
      fertile: true,
    },
  };

  it('A: unchanged ovulation stays valid', () => {
    const check = revalidateCycleCandidate(
      { type: 'ovulation', eventDate: '2026-09-06', candidateId: cycleCandidateId('ovulation', '2026-09-06') },
      live,
    );
    assert.equal(check.ok, true);
  });

  it('B: moved predicted date is stale', () => {
    const check = revalidateCycleCandidate(
      { type: 'ovulation', eventDate: '2026-09-06' },
      { ...live, ovulationDate: '2026-09-08' },
    );
    assert.equal(check.reason, CYCLE_SUPPRESSION.STALE_PREDICTION);
  });

  it('C: logged period start invalidates prediction reminders', () => {
    const check = revalidateCycleCandidate(
      { type: 'period_soon', eventDate: '2026-09-18' },
      { ...live, logs: [{ date: today, flow: 'medium' }] },
    );
    assert.equal(check.reason, CYCLE_SUPPRESSION.PERIOD_STARTED);
  });

  it('D: LIMITED contraception suppresses fertility candidates', () => {
    const check = revalidateCycleCandidate(
      { type: 'ovulation', eventDate: '2026-09-06' },
      { ...live, mode: 'TRY_TO_CONCEIVE', showFertilityMarkers: false },
    );
    assert.equal(check.reason, CYCLE_SUPPRESSION.CONTRACEPTION_SUPPRESSED);
  });

  it('E: pregnancy mode suppresses cycle predictions', () => {
    const check = revalidateCycleCandidate(
      { type: 'period_start', eventDate: '2026-09-20' },
      { ...live, mode: 'PREGNANCY' },
    );
    assert.equal(check.reason, CYCLE_SUPPRESSION.PREGNANCY_SUPPRESSED);
  });

  it('F: disabled reminder preference is USER_DISABLED', () => {
    const check = revalidateCycleCandidate(
      { type: 'ovulation', eventDate: '2026-09-06' },
      { ...live, typeEnabled: { ovulation: false } },
    );
    assert.equal(check.reason, CYCLE_SUPPRESSION.USER_DISABLED);
  });

  it('G: global notifications off', () => {
    const check = revalidateCycleCandidate(
      { type: 'period_start', eventDate: '2026-09-20' },
      { ...live, globalEnabled: false },
    );
    assert.equal(check.reason, CYCLE_SUPPRESSION.GLOBAL_DISABLED);
  });

  it('H: privacy enabled after schedule rewrites unmasked copy, does not suppress', () => {
    const decision = cycleDeliveryDecision(
      { type: 'period_start', eventDate: '2026-09-20', masked: false },
      live,
      getEffectiveCycleMask({ privacyEnabled: true, maskNotifications: false }),
    );
    assert.equal(decision.ok, true);
    assert.equal(decision.rewriteMasked, true);
    assert.equal(decision.deliver, true);
  });

  it('I: turning mask off after schedule does not unexpectedly unmask', () => {
    const decision = cycleDeliveryDecision(
      { type: 'period_start', eventDate: '2026-09-20', masked: true },
      live,
      getEffectiveCycleMask({ privacyEnabled: false, maskNotifications: false }),
    );
    assert.equal(decision.ok, true);
    assert.equal(decision.rewriteMasked, false);
    assert.equal(decision.deliver, true);
  });

  it('J: timezone change does not stale a matching civil event date', () => {
    const check = revalidateCycleCandidate(
      { type: 'period_start', eventDate: '2026-09-20' },
      { ...live, today: '2026-09-16' },
    );
    assert.equal(check.ok, true);
  });

  it('does not duplicate the same candidate identity', () => {
    const id = cycleCandidateId('period_start', '2026-09-20');
    const check = revalidateCycleCandidate(
      { type: 'period_start', eventDate: '2026-09-20', candidateId: id },
      { ...live, sentCandidateIds: [id] },
    );
    assert.equal(check.reason, CYCLE_SUPPRESSION.DUPLICATE);
  });
});
