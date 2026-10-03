import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CYCLE_DAY_ACTIVITY_MAX_MS,
  CYCLE_WIDGET_FORBIDDEN,
  CYCLE_WIDGET_START_URL,
  activityKey,
  cycleDayActivityPlan,
  cycleExpectedDayDue,
  cycleWidgetDiscreet,
  cycleWidgetDiscreetForced,
  cycleWidgetSnapshot,
  cycleWidgetStartAllowed,
  cycleWidgetTimeline,
  neutralCycleWidget,
  type CycleWidgetProps,
} from './cycleWidgetSnapshot.ts';
import { cycleDark, cycleLight } from '../theme/cyclePalette.ts';

const TODAY = '2026-10-14';

/** A classic TRACK_PERIOD bundle on cycle day 12, next period in 16 days — sensitive fields filled in. */
function bundle(over: Record<string, any> = {}): any {
  const base: any = {
    profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-10-03', privacyEnabled: false, expectsBleeding: true, fertilityDisplay: 'auto', isIrregular: false },
    meta: { today: TODAY },
    phase: 'fertile',
    phaseKa: 'ნაყოფიერი ფანჯარა',
    cycleDay: 12,
    averages: { usedCycleLength: 28, cycleCount: 6 },
    forecastEligibility: { allowed: true, reason: 'STANDARD' },
    periodStatus: { state: 'ended', day: null, typicalLength: 5, autoEnded: true },
    predictions: {
      nextPeriodStart: '2026-10-30',
      nextPeriodEnd: '2026-11-03',
      ovulationDate: '2026-10-16',
      fertileWindow: { start: '2026-10-11', end: '2026-10-16' },
      calendar: {
        [TODAY]: { cycleDay: 12, phase: 'fertile', phaseKa: 'ნაყოფიერი ფანჯარა', fertile: true, predicted: true },
      },
      confidence: 'high',
      estimated: true,
    },
    logs: [
      {
        date: TODAY,
        flow: 'none',
        symptoms: ['cramps'],
        sexualActivity: true,
        libido: 5,
        bbt: 36.71,
        cervicalMucus: 'eggwhite',
        ovulationTest: 'positive',
        pregnancyTest: 'negative',
        notes: 'private journal text',
      },
    ],
    trends: { cycleLengths: [{ length: 28 }, { length: 29 }, { length: 27 }] },
  };
  return {
    ...base,
    ...over,
    profile: { ...base.profile, ...(over.profile ?? {}) },
    predictions: { ...base.predictions, ...(over.predictions ?? {}) },
  };
}

const on = { discreet: false, available: true } as const;
const visibleText = (p: CycleWidgetProps) => [p.brand, p.caption, p.value, p.unit, p.note, p.detail, p.a11y, p.startLabel, p.startA11y].join(' | ');

function assertClean(p: CycleWidgetProps, label: string) {
  const text = visibleText(p);
  assert.doesNotMatch(text, CYCLE_WIDGET_FORBIDDEN, `${label}: ${text}`);
  for (const secret of ['36.71', 'eggwhite', 'positive', 'negative', 'private journal text', 'ფოლიკულ', 'ლუთეალ']) {
    assert.ok(!text.includes(secret), `${label} leaks ${secret}`);
  }
  // The fertile turquoise never colours the widget.
  for (const colors of [p.light, p.dark]) {
    for (const hex of [cycleLight.fertile, cycleLight.fertileFill, cycleLight.ovulation, cycleDark.fertile, cycleDark.fertileFill, cycleDark.ovulation]) {
      assert.ok(!Object.values(colors).includes(hex), `${label}: fertile colour ${hex}`);
    }
  }
}

describe('cycle widget snapshot', () => {
  it('countdown: „მენსტრუაციამდე · 16 დღე · სავარაუდოდ“ with the date, „დაიწყო“ and a calm dot — even on a fertile day', () => {
    const p = cycleWidgetSnapshot({ bundle: bundle(), day: TODAY, ...on });
    assert.equal(p.state, 'countdown');
    assert.equal(p.caption, 'მენსტრუაციამდე');
    assert.equal(p.value, '16');
    assert.equal(p.unit, 'დღე');
    assert.equal(p.note, 'სავარაუდოდ');
    assert.equal(p.detail, 'პარ, 30 ოქტ');
    assert.equal(p.tone, 'calm');
    assert.equal(p.light.dot, cycleLight.mutedSoft);
    assert.equal(p.startLabel, 'დაიწყო');
    assert.equal(p.startA11y, 'მენსტრუაცია დაიწყო');
    assert.equal(p.startUrl, CYCLE_WIDGET_START_URL);
    assert.equal(p.openUrl, 'medicard://cycle');
    assert.match(p.a11y, /^MEDICARD · მენსტრუაციამდე · 16 დღე · სავარაუდოდ/);
    assertClean(p, 'countdown');
  });

  it('a variable cycle shows its window, never one date', () => {
    const p = cycleWidgetSnapshot({
      bundle: bundle({ profile: { isIrregular: true }, predictions: { nextPeriodRange: { from: '2026-10-27', to: '2026-11-02' } } }),
      day: TODAY,
      ...on,
    });
    assert.equal(p.state, 'window');
    assert.equal(p.value, '13–19');
    assert.equal(p.unit, 'დღე');
    assert.equal(p.note, 'სავარაუდოდ · ციკლები ცვალებადია');
    assert.equal(p.detail, '27 ოქტ – 2 ნოე');
    assertClean(p, 'window');
  });

  it('the open window and the expected day say „დღეს“ with a dashed rose ring', () => {
    const due = cycleWidgetSnapshot({ bundle: bundle({ predictions: { nextPeriodStart: TODAY } }), day: TODAY, ...on });
    assert.equal(due.state, 'today');
    assert.equal(due.value, 'დღეს');
    assert.equal(due.caption, 'სავარაუდოდ');
    assert.equal(due.tone, 'expected');
    assert.equal(due.light.dot, cycleLight.period);
    assertClean(due, 'today');
    const open = cycleWidgetSnapshot({
      bundle: bundle({ profile: { isIrregular: true }, predictions: { nextPeriodStart: '2026-10-16', nextPeriodRange: { from: '2026-10-13', to: '2026-10-19' } } }),
      day: TODAY,
      ...on,
    });
    assert.equal(open.state, 'today');
    assert.equal(open.note, 'ან მომდევნო 5 დღეში');
    assertClean(open, 'window open');
  });

  it('a period day: „მენსტრუაციის დღე N“, solid rose, no start button', () => {
    const b = bundle({
      profile: { lastPeriodStart: '2026-10-13' },
      periodStatus: { state: 'active', day: 2, typicalLength: 5, autoEnded: false },
      logs: [{ date: TODAY, flow: 'medium' }],
      cycleDay: 2,
      phase: 'period',
    });
    const p = cycleWidgetSnapshot({ bundle: b, day: TODAY, ...on });
    assert.equal(p.state, 'period');
    assert.equal(p.caption, 'მენსტრუაციის დღე');
    assert.equal(p.value, '2');
    assert.equal(p.tone, 'period');
    assert.equal(p.startLabel, '');
    assertClean(p, 'period');
    // The next days continue the run through the usual length, then leave the period.
    const days = cycleWidgetTimeline({ bundle: b, today: TODAY, ...on, days: 6 }).map((e) => `${e.props.state}:${e.props.value}`);
    assert.deepEqual(days.slice(0, 4), ['period:2', 'period:3', 'period:4', 'period:5']);
    assert.notEqual(days[4].split(':')[0], 'period');
  });

  it('late after the estimate: the cycle day and how far past it — calm words, no alarm', () => {
    const p = cycleWidgetSnapshot({ bundle: bundle({ predictions: { nextPeriodStart: '2026-10-12' }, cycleDay: 31 }), day: TODAY, ...on });
    assert.equal(p.state, 'late');
    assert.equal(p.caption, 'ციკლის დღე');
    assert.equal(p.note, 'სავარაუდო თარიღიდან 2 დღე');
    assertClean(p, 'late');
  });

  it('learning: no last period yet, or no day to count from', () => {
    const none = cycleWidgetSnapshot({ bundle: bundle({ profile: { lastPeriodStart: null } }), day: TODAY, ...on });
    assert.equal(none.state, 'learning');
    assert.equal(none.caption, 'ვსწავლობთ შენს რიტმს');
    assert.equal(none.value, '');
    assert.equal(none.note, 'მიუთითე ბოლო მენსტრუაცია');
    assertClean(none, 'learning');
    const gated = cycleWidgetSnapshot({
      bundle: bundle({ forecastEligibility: { allowed: false, reason: 'POSTPARTUM_HISTORY_INSUFFICIENT' } }),
      day: TODAY,
      ...on,
    });
    assert.equal(gated.state, 'learning');
    assertClean(gated, 'learning (gated)');
  });

  it('Tracking, postpartum and perimenopause: „თვალყურის დევნება“ and the date — never why', () => {
    for (const over of [
      { profile: { expectsBleeding: false }, tracking: { trackingOnly: true, expectsBleeding: false, fertilityDisplay: 'off', fertility: { effective: 'off', forcedBy: 'tracking', userCanChange: false } } },
      { profile: { mode: 'POSTPARTUM' } },
      { profile: { mode: 'PERIMENOPAUSE' } },
    ]) {
      const p = cycleWidgetSnapshot({ bundle: bundle(over), day: TODAY, ...on });
      assert.equal(p.state, 'tracking', JSON.stringify(over));
      assert.equal(p.caption, 'თვალყურის დევნება');
      assert.equal(p.value, '14');
      assert.equal(p.unit, 'ოქტ');
      assertClean(p, `tracking ${JSON.stringify(over)}`);
    }
  });

  it('pregnancy, TTC fertile days, contraception: nothing fertile or pregnant ever shows', () => {
    assert.deepEqual(cycleWidgetSnapshot({ bundle: bundle({ profile: { mode: 'PREGNANCY' } }), day: TODAY, ...on }), neutralCycleWidget());
    const ttc = cycleWidgetSnapshot({ bundle: bundle({ profile: { mode: 'TRY_TO_CONCEIVE' } }), day: TODAY, ...on });
    assert.equal(ttc.state, 'countdown');
    assertClean(ttc, 'ttc');
    for (let k = 0; k < 40; k += 1) {
      for (const mode of ['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'POSTPARTUM', 'PERIMENOPAUSE']) {
        for (const p of cycleWidgetTimeline({ bundle: bundle({ profile: { mode }, cycleDay: 1 + k }), today: TODAY, ...on, days: 14 })) {
          assertClean(p.props, `${mode} +${k} ${p.day}`);
        }
      }
    }
  });

  it('discreet / signed out / module paused / no data → the neutral tile: „MEDICARD“, a grey dot, no words', () => {
    const neutral = neutralCycleWidget();
    assert.equal(neutral.state, 'neutral');
    assert.equal(neutral.openUrl, 'medicard://');
    assert.equal(neutral.a11y, 'MEDICARD');
    assert.equal(neutral.light.dot, cycleLight.mutedSoft);
    for (const p of [
      cycleWidgetSnapshot({ bundle: bundle(), day: TODAY, discreet: true, available: true }),
      cycleWidgetSnapshot({ bundle: bundle(), day: TODAY, discreet: false, available: false }),
      cycleWidgetSnapshot({ bundle: null, day: TODAY, ...on }),
    ]) {
      assert.deepEqual(p, neutral);
      assert.doesNotMatch([p.caption, p.value, p.unit, p.note, p.detail, p.startLabel, p.startA11y].join(''), /\S/);
      assert.doesNotMatch(visibleText(p), /[Ⴀ-ჿ]/, 'no Georgian word at all');
    }
  });

  it('discreet is automatic: the lock, privacy mode, masked or discreet notifications — and unknown counts as on', () => {
    const off = { lockOn: false, privacyEnabled: false, maskNotifications: false, engageDiscreet: false, widgetDiscreet: false };
    assert.equal(cycleWidgetDiscreet(off), false);
    for (const key of ['lockOn', 'privacyEnabled', 'maskNotifications', 'engageDiscreet', 'widgetDiscreet'] as const) {
      assert.equal(cycleWidgetDiscreet({ ...off, [key]: true }), true, key);
      if (key !== 'privacyEnabled') assert.equal(cycleWidgetDiscreet({ ...off, [key]: null }), true, `${key} unread`);
    }
    // Her own switch cannot turn discreet off while the lock (or another privacy switch) is on.
    assert.equal(cycleWidgetDiscreetForced({ lockOn: true, privacyEnabled: false, maskNotifications: false, engageDiscreet: false }), true);
    assert.equal(cycleWidgetDiscreet({ ...off, lockOn: true, widgetDiscreet: false }), true);
    assert.equal(cycleWidgetDiscreetForced({ lockOn: false, privacyEnabled: false, maskNotifications: false, engageDiscreet: false }), false);
  });

  it('the timeline counts down by itself, one entry per civil day', () => {
    const t = cycleWidgetTimeline({ bundle: bundle(), today: TODAY, ...on, days: 5 });
    assert.deepEqual(t.map((e) => e.day), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    assert.deepEqual(t.map((e) => e.props.value), ['16', '15', '14', '13', '12']);
  });
});

describe('the widget\'s „დაიწყო“', () => {
  it('starts only when the hero would offer it', () => {
    assert.equal(cycleWidgetStartAllowed(bundle(), TODAY), true);
    assert.equal(cycleWidgetStartAllowed(bundle({ profile: { lastPeriodStart: TODAY } }), TODAY), false);
    assert.equal(cycleWidgetStartAllowed(bundle({ logs: [{ date: TODAY, flow: 'light' }] }), TODAY), false);
    assert.equal(cycleWidgetStartAllowed(bundle({ periodStatus: { state: 'active', day: 3, typicalLength: 5, autoEnded: false } }), TODAY), false);
    for (const mode of ['PREGNANCY', 'POSTPARTUM', 'PERIMENOPAUSE']) assert.equal(cycleWidgetStartAllowed(bundle({ profile: { mode } }), TODAY), false, mode);
    assert.equal(cycleWidgetStartAllowed(null, TODAY), false);
  });
});

describe('expected day on the lock screen (Live Activity)', () => {
  const dueBundle = bundle({ predictions: { nextPeriodStart: TODAY } });
  const base = { enabled: true, available: true, today: TODAY, discreet: false, now: 1_000_000, running: null, shownFor: null };

  it('due on the single estimate or the first day of a variable window — never while bleeding', () => {
    assert.equal(cycleExpectedDayDue(dueBundle, TODAY), true);
    assert.equal(cycleExpectedDayDue(bundle(), TODAY), false);
    assert.equal(
      cycleExpectedDayDue(bundle({ profile: { isIrregular: true }, predictions: { nextPeriodStart: '2026-10-16', nextPeriodRange: { from: TODAY, to: '2026-10-19' } } }), TODAY),
      true,
    );
    assert.equal(
      cycleExpectedDayDue(bundle({ profile: { isIrregular: true }, predictions: { nextPeriodStart: TODAY, nextPeriodRange: { from: '2026-10-12', to: '2026-10-17' } } }), TODAY),
      false,
      'a window that opened earlier is not „the first day“',
    );
    assert.equal(cycleExpectedDayDue(bundle({ predictions: { nextPeriodStart: TODAY }, logs: [{ date: TODAY, flow: 'heavy' }] }), TODAY), false);
    assert.equal(cycleExpectedDayDue(bundle({ profile: { mode: 'PREGNANCY' }, predictions: { nextPeriodStart: TODAY } }), TODAY), false);
  });

  it('off by default, once per expected day, with the widget\'s words (discreet = „MEDICARD“)', () => {
    assert.deepEqual(cycleDayActivityPlan({ ...base, enabled: false, bundle: dueBundle }), { action: 'none' });
    const start = cycleDayActivityPlan({ ...base, bundle: dueBundle });
    assert.equal(start.action, 'start');
    if (start.action !== 'start') return;
    assert.equal(start.dueDay, TODAY);
    assert.equal(start.props.value, 'დღეს');
    assertClean(start.props, 'activity');
    assert.deepEqual(cycleDayActivityPlan({ ...base, bundle: dueBundle, shownFor: TODAY }), { action: 'none' }, 'a dismissed one never returns');
    const hidden = cycleDayActivityPlan({ ...base, bundle: dueBundle, discreet: true });
    assert.equal(hidden.action === 'start' && hidden.props.state, 'neutral');
    assert.deepEqual(cycleDayActivityPlan({ ...base, bundle: bundle() }), { action: 'none' }, 'not due');
  });

  it('ends when bleeding is logged, after 24 h, when switched off or the module is paused; updates when discreet changes', () => {
    const props = cycleDayActivityPlan({ ...base, bundle: dueBundle });
    assert.equal(props.action, 'start');
    if (props.action !== 'start') return;
    const running = { startedAt: base.now, dueDay: TODAY, key: activityKey(props.props) };
    assert.deepEqual(cycleDayActivityPlan({ ...base, bundle: dueBundle, running }), { action: 'none' });
    const bled = bundle({ predictions: { nextPeriodStart: TODAY }, logs: [{ date: TODAY, flow: 'medium' }] });
    assert.deepEqual(cycleDayActivityPlan({ ...base, bundle: bled, running }), { action: 'end' });
    assert.deepEqual(cycleDayActivityPlan({ ...base, bundle: dueBundle, running, now: base.now + CYCLE_DAY_ACTIVITY_MAX_MS }), { action: 'end' });
    assert.deepEqual(cycleDayActivityPlan({ ...base, enabled: false, bundle: dueBundle, running }), { action: 'end' });
    assert.deepEqual(cycleDayActivityPlan({ ...base, available: false, bundle: dueBundle, running }), { action: 'end' });
    const update = cycleDayActivityPlan({ ...base, bundle: dueBundle, running, discreet: true });
    assert.equal(update.action, 'update');
    assert.equal(update.action === 'update' && update.props.state, 'neutral');
  });
});
