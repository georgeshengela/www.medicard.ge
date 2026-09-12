import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_PROVENANCE,
  PREDICTED_NUMERAL_PREFIX,
  alertPresentation,
  calendarDayA11y,
  classifyCycleDay,
  confidencePresentation,
  dayProvenance,
  getCycleCalendarDayVisualState,
  gaugeA11ySummary,
  isBleedFlowValue,
  isSpottingFlowValue,
  journalCycleLengthReady,
  mergeLoggedFlowOntoMarks,
  mergeOwnerClassifiedPeriodOntoMarks,
  recentSymptomIds,
} from './cyclePresentation.js';

const COPY = {
  today: 'დღეს',
  selected: 'არჩეული',
  loggedPeriod: 'მენსტრუაცია',
  spotting: 'ლაქები',
  predictedPeriod: 'სავარაუდო მენსტრუაცია',
  fertile: 'სავარაუდო ნაყოფიერი',
  ovulation: 'სავარაუდო ოვულაცია',
  symptoms: 'აღრიცხული',
};

test('display-log flow paints bleed cells even when engine calendar omitted the day', () => {
  const merged = mergeLoggedFlowOntoMarks(
    { '2026-09-20': { fertile: true, estimated: true } },
    [{ date: '2026-09-11', flow: 'heavy' }],
  );
  assert.equal(merged['2026-09-11'].flow, 'heavy');
  const layers = classifyCycleDay(merged['2026-09-11'], { showFertility: false, showPredicted: false });
  assert.equal(layers.loggedPeriod, true);
  assert.equal(layers.fertile, false);
  assert.equal(layers.predictedPeriod, false);
  assert.equal(merged['2026-09-20'].fertile, true);
});

test('logged period and predicted period are different classes', () => {
  const logged = classifyCycleDay({ period: true, predicted: false, flow: 'medium' });
  const predicted = classifyCycleDay({ period: true, predicted: true });
  assert.equal(logged.loggedPeriod, true);
  assert.equal(logged.predictedPeriod, false);
  assert.equal(predicted.loggedPeriod, false);
  assert.equal(predicted.predictedPeriod, true);
  assert.equal(dayProvenance(logged), CYCLE_PROVENANCE.LOGGED);
  assert.equal(dayProvenance(predicted), CYCLE_PROVENANCE.PREDICTED);
});

test('a logged bleed flow wins over a predicted mark on the same day', () => {
  const layers = classifyCycleDay({ period: true, predicted: true, flow: 'heavy' });
  assert.equal(layers.loggedPeriod, true);
  assert.equal(layers.predictedPeriod, false);
});

test('spotting is a logged dot, not a fill and not a period', () => {
  const layers = classifyCycleDay({ flow: 'spotting', logged: true });
  assert.equal(layers.spotting, true);
  assert.equal(layers.loggedPeriod, false);
  assert.equal(layers.symptomDot, false);
  assert.equal(dayProvenance(layers), CYCLE_PROVENANCE.LOGGED);
});

test('fertile and ovulation are predicted provenance', () => {
  const fertile = classifyCycleDay({ fertile: true });
  const ovulation = classifyCycleDay({ fertile: true, ovulation: true });
  assert.equal(dayProvenance(fertile), CYCLE_PROVENANCE.PREDICTED);
  assert.equal(dayProvenance(ovulation), CYCLE_PROVENANCE.PREDICTED);
  assert.equal(ovulation.fertile, false, 'ovulation day uses the sparkle slot, not fertile dots');
  assert.equal(ovulation.ovulation, true);
});

test('explicit showPredicted:false hides predicted layers but keeps logged period', () => {
  const layers = classifyCycleDay(
    { period: true, predicted: true, fertile: true, ovulation: true, flow: 'medium' },
    { showPredicted: false },
  );
  assert.equal(layers.loggedPeriod, true);
  assert.equal(layers.predictedPeriod, false);
  assert.equal(layers.fertile, false);
  assert.equal(layers.ovulation, false);
});

test('low confidence still paints estimated ovulation and next period', () => {
  const showPredicted = !confidencePresentation('low').hidePredictedOverlays;
  const ovulation = classifyCycleDay({ fertile: true, ovulation: true }, { showPredicted });
  const nextPeriod = classifyCycleDay({ period: true, predicted: true }, { showPredicted });
  assert.equal(ovulation.ovulation, true);
  assert.equal(nextPeriod.predictedPeriod, true);
});

test('contraception suppression removes fertility layers entirely', () => {
  const layers = classifyCycleDay(
    { fertile: true, ovulation: true, logged: true },
    { showFertility: false },
  );
  assert.equal(layers.fertile, false);
  assert.equal(layers.ovulation, false);
  assert.equal(layers.symptomDot, true, 'logged symptoms still visible');
});

test('symptom dot only when logged and not a bleed/spotting day', () => {
  assert.equal(classifyCycleDay({ logged: true }).symptomDot, true);
  assert.equal(classifyCycleDay({ logged: true, flow: 'medium' }).symptomDot, false);
  assert.equal(classifyCycleDay({ logged: true, flow: 'spotting' }).symptomDot, false);
});

test('canonical flow values only', () => {
  assert.equal(isBleedFlowValue('light'), true);
  assert.equal(isBleedFlowValue('medium'), true);
  assert.equal(isBleedFlowValue('heavy'), true);
  assert.equal(isBleedFlowValue('spotting'), false);
  assert.equal(isBleedFlowValue('none'), false);
  assert.equal(isSpottingFlowValue('spotting'), true);
});

test('predicted numeral prefix stays the estimate marker', () => {
  assert.equal(PREDICTED_NUMERAL_PREFIX, '~');
});

test('calendar visual state keeps selection out of health symbols', () => {
  const logged = getCycleCalendarDayVisualState({
    layers: classifyCycleDay({ period: true, flow: 'medium' }),
    isSelected: true,
    isToday: false,
  });
  assert.equal(logged.baseState, 'loggedPeriod');
  assert.equal(logged.fill, 'loggedPeriod');
  assert.equal(logged.ring, 'selected');
  assert.equal(logged.isLogged, true);

  const predicted = getCycleCalendarDayVisualState({
    layers: classifyCycleDay({ period: true, predicted: true }),
    isSelected: true,
  });
  assert.equal(predicted.baseState, 'predictedPeriod');
  assert.equal(predicted.fill, 'none');
  assert.equal(predicted.showPredictedDash, true);
  assert.equal(predicted.ring, 'selected');

  const ovulation = getCycleCalendarDayVisualState({
    layers: classifyCycleDay({ ovulation: true, fertile: true }),
    isSelected: true,
  });
  assert.equal(ovulation.semanticIndicator, 'ovulationSparkle');
  assert.equal(ovulation.fill, 'selectedSoft');
  assert.notEqual(ovulation.baseState, 'selected');

  const todaySelected = getCycleCalendarDayVisualState({
    layers: classifyCycleDay({}),
    isSelected: true,
    isToday: true,
  });
  assert.equal(todaySelected.ring, 'today');
  assert.equal(todaySelected.fill, 'selectedSoft');
});

test('calendar a11y label labels predicted as predicted, logged as fact', () => {
  const predicted = calendarDayA11y({
    dayLabel: '15 სექტემბერი',
    isToday: false,
    isSelected: false,
    layers: classifyCycleDay({ period: true, predicted: true }),
    copy: COPY,
  });
  assert.match(predicted, /სავარაუდო მენსტრუაცია/);
  assert.doesNotMatch(predicted, /^15 სექტემბერი, მენსტრუაცია$/);

  const logged = calendarDayA11y({
    dayLabel: '8 სექტემბერი',
    isToday: true,
    isSelected: false,
    layers: classifyCycleDay({ period: true, predicted: false, flow: 'medium', logged: true }),
    copy: COPY,
  });
  assert.match(logged, /დღეს/);
  assert.match(logged, /მენსტრუაცია/);
  assert.doesNotMatch(logged, /სავარაუდო მენსტრუაცია/);
});

test('postpartum calendar a11y uses bleed label, not menstruation', () => {
  const postpartumCopy = { ...COPY, loggedPeriod: 'სისხლდენა' };
  const label = calendarDayA11y({
    dayLabel: '11 სექტემბერი',
    isToday: false,
    isSelected: true,
    layers: classifyCycleDay({ flow: 'medium' }, { showPredicted: false, showFertility: false }),
    copy: postpartumCopy,
  });
  assert.match(label, /სისხლდენა/);
  assert.doesNotMatch(label, /მენსტრუაცია/);
});

test('owner-classified postpartum bleed is a fact badge, not prediction', () => {
  const merged = mergeOwnerClassifiedPeriodOntoMarks(
    { '2026-09-10': { flow: 'heavy' } },
    ['2026-09-10'],
  );
  const layers = classifyCycleDay(merged['2026-09-10'], { showPredicted: false });
  assert.equal(layers.loggedPeriod, true);
  assert.equal(layers.ownerClassifiedPeriod, true);
  assert.equal(layers.predictedPeriod, false);
  const label = calendarDayA11y({
    dayLabel: '10 სექტემბერი',
    isToday: false,
    isSelected: false,
    layers,
    copy: { ...COPY, loggedPeriod: 'სისხლდენა', classifiedPeriod: 'მენსტრუაციად მონიშნული სისხლდენა' },
  });
  assert.match(label, /სისხლდენა/);
  assert.match(label, /მენსტრუაციად მონიშნული სისხლდენა/);
  assert.doesNotMatch(label, /სავარაუდო მენსტრუაცია/);
});

test('gauge a11y summary is a concise sentence set', () => {
  const label = gaugeA11ySummary({
    dayLabel: 'ციკლის მე-18 დღე',
    phaseLabel: 'სავარაუდო ლუტეალური ფაზა',
    nextPeriodLabel: 'მენსტრუაცია სავარაუდოდ 10 დღეში',
  });
  assert.equal(
    label,
    'ციკლის მე-18 დღე. სავარაუდო ლუტეალური ფაზა. მენსტრუაცია სავარაუდოდ 10 დღეში',
  );
});

test('confidence is server-provided and never a danger tone', () => {
  for (const level of ['low', 'medium', 'high', undefined, 'weird']) {
    const p = confidencePresentation(level);
    assert.equal(p.tone, 'neutral');
  }
  assert.equal(confidencePresentation('high').softenPrediction, false);
  assert.equal(confidencePresentation('low').softenPrediction, true);
  assert.equal(confidencePresentation(undefined).level, 'low');
  assert.equal(confidencePresentation('low').hidePredictedOverlays, false);
  assert.equal(confidencePresentation('high').hidePredictedOverlays, false);
});

test('late alerts are calm, never danger', () => {
  const late = alertPresentation({
    level: 'warn',
    messageKa: 'მენსტრუაცია ბოლო პატერნზე გვიანია. ეს შეფასებაა, არა დიაგნო�ოლო პატერნზე გვიანია. ეს შეფასებაა, არა დიაგნოზი.',
    late: { status: 'late' },
  });
  assert.equal(late.tone, 'calm');
  assert.equal(late.late, true);
  const urgent = alertPresentation({ level: 'urgent', messageKa: 'სხვა' });
  assert.equal(urgent.tone, 'urgent');
});

test('recent symptoms are last unique ids, not invented ranks', () => {
  const ids = recentSymptomIds(
    [
      { date: '2026-09-01', symptoms: ['bloating', 'fatigue'] },
      { date: '2026-09-07', symptoms: ['nausea', 'bloating'] },
      { date: '2026-09-03', symptoms: ['headache'] },
    ],
    4,
  );
  assert.deepEqual(ids, ['nausea', 'bloating', 'headache', 'fatigue']);
});

test('journal cycle-length trend waits for 3 gaps', () => {
  assert.equal(journalCycleLengthReady(2), false);
  assert.equal(journalCycleLengthReady(3), true);
});
