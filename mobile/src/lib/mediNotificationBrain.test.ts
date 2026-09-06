import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEngageFatigue,
  dailyEngageCap,
  DEFAULT_ENGAGE_PREFS,
  isQuietAt,
  preferredHourFromOpens,
} from './mediEngageModel.ts';
import { ENGAGE_FALLBACKS } from './mediEngageCopy.ts';
import {
  evaluateEngageBrain,
  evaluateEngageCandidates,
  pickCheckinKey,
  pickReengageKey,
  type EngageSnapshot,
} from './mediNotificationBrain.shared.ts';
import {
  fallbackNotificationRoute,
  revalidateEngageCandidate,
  type EngageLiveSignals,
} from './mediNotificationRevalidate.ts';
import { engageDestination, planMedicationReminderSlots, routeFromNotificationData } from './notificationPlan.ts';

function snap(over: Partial<EngageSnapshot> = {}): EngageSnapshot {
  const now = over.now ?? new Date('2026-09-06T10:00:00');
  return {
    now,
    lastOpenAt: now.getTime(),
    firstName: 'Nino',
    birthDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    todaySteps: 8000,
    weekSteps: 12000,
    prevWeekSteps: 11000,
    hydrationMl: 1800,
    hydrationGoal: 2000,
    loggedPain: false,
    streak: 3,
    loggedHealthDays: 3,
    medTakenWeek: 2,
    medMissedWeek: 1,
    missingProfileField: null,
    lastChatAt: null,
    lastChatId: null,
    lastChatMode: null,
    cycleRegular: false,
    seenWeekly: true,
    unfinished: null,
    recentVisit: null,
    openAt: [],
    outcomes: [],
    sent: [],
    prefs: DEFAULT_ENGAGE_PREFS,
    ...over,
  };
}

describe('mediNotificationBrain', () => {
  it('does not send a check-in when the user just opened the app', () => {
    const rows = evaluateEngageCandidates(snap());
    assert.equal(rows.some((row) => row.family === 'checkin' && row.fireAt.getTime() <= snap().now.getTime() + 3_600_000), false);
  });

  it('skips hydration when the goal is already met', () => {
    const rows = evaluateEngageCandidates(snap({ hydrationMl: 2000, hydrationGoal: 2000 }));
    assert.equal(rows.some((row) => row.family === 'hydration'), false);
  });

  it('skips a low-steps nudge when pain is logged', () => {
    const rows = evaluateEngageCandidates(
      snap({ now: new Date('2026-09-06T17:30:00'), todaySteps: 400, loggedPain: true }),
    );
    assert.equal(rows.some((row) => row.family === 'stepsQuiet'), false);
  });

  it('only emits a steps insight when the week actually rose', () => {
    const yes = evaluateEngageCandidates(snap({ weekSteps: 12000, prevWeekSteps: 8000 }));
    const no = evaluateEngageCandidates(snap({ weekSteps: 8000, prevWeekSteps: 8000 }));
    assert.equal(yes.some((row) => row.key === 'engage-insight-steps'), true);
    assert.equal(no.some((row) => row.key === 'engage-insight-steps'), false);
  });

  it('caps non-essential today pushes by frequency', () => {
    const rare = evaluateEngageCandidates(
      snap({
        prefs: { ...DEFAULT_ENGAGE_PREFS, frequency: 'rare' },
        weekSteps: 52000,
        prevWeekSteps: 10000,
        hydrationMl: 200,
      }),
    );
    const today = rare.filter((row) => row.fireAt.toDateString() === new Date('2026-09-06T10:00:00').toDateString());
    assert.ok(today.length <= dailyEngageCap('rare') + 1);
  });

  it('treats 22:00–08:00 as quiet', () => {
    assert.equal(isQuietAt(new Date('2026-09-06T23:10:00'), '22:00', '08:00'), true);
    assert.equal(isQuietAt(new Date('2026-09-06T08:10:00'), '22:00', '08:00'), false);
  });

  it('picks re-engagement copy by absence, without guilt keys', () => {
    assert.equal(pickReengageKey(2), 'engage-reengage-2');
    assert.equal(pickReengageKey(30), 'engage-reengage-30');
    assert.equal(pickCheckinKey(new Date('2026-09-06T09:00:00')), 'engage-checkin-morning');
  });

  it('always schedules future re-engagement instead of nagging an open session', () => {
    const rows = evaluateEngageCandidates(snap());
    const re = rows.filter((row) => row.family === 'reengage');
    assert.ok(re.length >= 1);
    assert.ok(re.every((row) => row.fireAt.getTime() > Date.now()));
  });

  it('blocks a second hydration by category cooldown even on ხშირად', () => {
    const now = new Date('2026-09-06T16:00:00');
    const rows = evaluateEngageCandidates(
      snap({
        now,
        lastOpenAt: now.getTime() - 3 * 3_600_000,
        hydrationMl: 400,
        hydrationGoal: 2000,
        prefs: { ...DEFAULT_ENGAGE_PREFS, frequency: 'often' },
        sent: [{ key: 'engage-hydration', family: 'hydration', at: now.getTime() - 2 * 3_600_000, ymd: '2026-09-06' }],
      }),
    );
    assert.equal(rows.some((row) => row.family === 'hydration'), false);
  });

  it('drops adaptiveDailyCap without mutating selectedFrequency', () => {
    const ignored = Array.from({ length: 8 }, (_, i) => ({
      key: 'engage-checkin-morning',
      family: 'checkin',
      sentAt: Date.now() - (i + 3) * 3_600_000,
    }));
    const fat = computeEngageFatigue('often', ignored);
    assert.equal(fat.selectedFrequency, 'often');
    assert.equal(fat.baseDailyCap, 4);
    assert.equal(fat.adaptiveDailyCap, 1);
    assert.notEqual(fat.selectedFrequency, 'balanced');
  });

  it('recovers fatigue gradually instead of jumping back to the full cap', () => {
    const ignored = Array.from({ length: 8 }, (_, i) => ({
      key: 'engage-checkin-morning',
      family: 'checkin',
      sentAt: Date.now() - (20 - i) * 3_600_000,
    }));
    const oneOpen = [
      ...ignored,
      { key: 'engage-weekly', family: 'weekly', sentAt: Date.now() - 2 * 3_600_000, openedAt: Date.now() - 3_600_000 },
    ];
    const afterOne = computeEngageFatigue('often', oneOpen);
    assert.equal(afterOne.selectedFrequency, 'often');
    assert.ok(afterOne.adaptiveDailyCap < afterOne.baseDailyCap);
    const severalOpens = [
      ...ignored,
      ...Array.from({ length: 5 }, (_, i) => ({
        key: 'engage-weekly',
        family: 'weekly',
        sentAt: Date.now() - (i + 1) * 3_600_000,
        openedAt: Date.now() - i * 3_600_000,
      })),
    ];
    const recovered = computeEngageFatigue('often', severalOpens);
    assert.ok(recovered.ewma > afterOne.ewma);
    assert.ok(recovered.adaptiveDailyCap >= afterOne.adaptiveDailyCap);
  });

  it('shifts optional check-ins toward the preferred evening window', () => {
    const now = new Date('2026-09-06T10:00:00');
    const openAt = Array.from({ length: 12 }, (_, i) => new Date(2026, 8, 1 + i, 19, 10).getTime());
    assert.equal(preferredHourFromOpens(openAt, now.getTime()), 19);
    const { accepted } = evaluateEngageBrain(
      snap({
        now,
        lastOpenAt: now.getTime() - 5 * 86_400_000,
        openAt,
      }),
    );
    const checkin = accepted.find((row) => row.family === 'checkin');
    assert.ok(checkin);
    assert.equal(checkin?.fireAt.getHours(), 19);
  });

  it('only offers an unfinished action when a real draft is old enough', () => {
    const now = new Date('2026-09-06T18:00:00');
    const yes = evaluateEngageCandidates(
      snap({
        now,
        lastOpenAt: now.getTime() - 4 * 3_600_000,
        unfinished: {
          kind: 'medication_add',
          route: '/medications/add/setup?name=Aspirin',
          name: 'Aspirin',
          updatedAt: now.getTime() - 4 * 3_600_000,
        },
      }),
    );
    const no = evaluateEngageCandidates(
      snap({
        now,
        unfinished: {
          kind: 'medication_add',
          route: '/medications/add/setup?name=Aspirin',
          updatedAt: now.getTime() - 30 * 60_000,
        },
      }),
    );
    assert.equal(yes.some((row) => row.key === 'engage-unfinished-med'), true);
    assert.equal(no.some((row) => row.family === 'unfinished'), false);
  });

  it('offers a post-appointment check-in a few hours later', () => {
    const now = new Date('2026-09-06T18:00:00');
    const rows = evaluateEngageCandidates(
      snap({
        now,
        lastOpenAt: now.getTime() - 4 * 3_600_000,
        recentVisit: { id: 'vis-1', hoursAgo: 5 },
      }),
    );
    const hit = rows.find((row) => row.key === 'engage-visit-followup');
    assert.ok(hit);
    assert.equal(hit?.route, '/visits/editor?id=vis-1');
  });

  it('turns several missed doses into a helpful reminder-tune insight', () => {
    const rows = evaluateEngageCandidates(snap({ medMissedWeek: 4, lastOpenAt: new Date('2026-09-06T10:00:00').getTime() - 4 * 3_600_000 }));
    const hit = rows.find((row) => row.key === 'engage-insight-meds');
    assert.ok(hit);
    assert.equal(hit?.route, '/medications/reminders');
  });

  it('maps every companion family to a real destination, not Home by default', () => {
    assert.equal(engageDestination('weekly'), '/week');
    assert.equal(engageDestination('hydration'), '/health-metrics/hydration');
    assert.equal(engageDestination('stepsQuiet'), '/health-metrics/steps');
    assert.equal(engageDestination('question'), '/(tabs)/profile?action=question');
    assert.equal(engageDestination('chat', { chatId: 'c1', chatMode: 'DOCTOR' }), '/chat/DOCTOR?sessionId=c1');
    assert.equal(routeFromNotificationData({ type: 'visit_reminder', visitId: 'v1' }), '/visits/editor?id=v1');
    assert.equal(routeFromNotificationData({ type: 'medi_engage', family: 'hydration' }), '/health-metrics/hydration');
    assert.equal(routeFromNotificationData({ type: 'medi_engage', family: 'checkin' }), '/chat/DOCTOR');
    assert.equal(routeFromNotificationData({ type: 'medi_engage', family: 'weatherWellness' }), '/weather?from=push');
  });

  it('records why Medi sent or skipped a candidate', () => {
    const { trace } = evaluateEngageBrain(snap({ loggedPain: true, todaySteps: 200, now: new Date('2026-09-06T17:30:00') }));
    const blocked = trace.decisions.find((row) => row.family === 'stepsQuiet');
    assert.equal(blocked?.blocked, 'pain logged today');
    assert.equal(blocked?.decision, 'SKIP');
    assert.ok(blocked?.id.startsWith('notif_dec_'));
  });

  it('blocks check-in when Medi was opened 20 minutes ago', () => {
    const now = new Date('2026-09-06T10:20:00');
    const rows = evaluateEngageCandidates(snap({ now, lastOpenAt: now.getTime() - 20 * 60_000 }));
    assert.equal(rows.some((row) => row.family === 'checkin' && row.fireAt.getTime() <= now.getTime() + 3_600_000), false);
  });

  it('does not overreact to a single missed dose', () => {
    const rows = evaluateEngageCandidates(snap({ medMissedWeek: 1 }));
    assert.equal(rows.some((row) => row.key === 'engage-insight-meds'), false);
  });

  it('never offers post-visit after the appointment is gone', () => {
    const rows = evaluateEngageCandidates(snap({ recentVisit: null }));
    assert.equal(rows.some((row) => row.family === 'visitFollowup'), false);
  });

  it('blocks a second weekly once Sunday already sent', () => {
    const now = new Date('2026-09-06T12:00:00');
    const rows = evaluateEngageCandidates(
      snap({
        now,
        sent: [{ key: 'engage-weekly', family: 'weekly', at: now.getTime() - 3_600_000, ymd: '2026-09-06' }],
      }),
    );
    assert.equal(rows.some((row) => row.family === 'weekly' && row.fireAt.toDateString() === now.toDateString()), false);
  });

  it('sends an achievement only the first time it is evaluated', () => {
    const now = new Date('2026-09-06T10:00:00');
    const first = evaluateEngageCandidates(snap({ now, weekSteps: 52000, prevWeekSteps: 10000 }));
    const again = evaluateEngageCandidates(
      snap({
        now,
        weekSteps: 52000,
        prevWeekSteps: 10000,
        sent: [{ key: 'engage-achieve-steps', family: 'achievement', at: now.getTime() - 60_000, ymd: '2026-09-06' }],
      }),
    );
    assert.equal(first.some((row) => row.key === 'engage-achieve-steps'), true);
    assert.equal(again.some((row) => row.key === 'engage-achieve-steps'), false);
  });

  it('keeps the highest useful optional candidates when several are eligible', () => {
    const now = new Date('2026-09-06T10:00:00');
    const { accepted, trace } = evaluateEngageBrain(
      snap({
        now,
        lastOpenAt: now.getTime() - 5 * 86_400_000,
        weekSteps: 52000,
        prevWeekSteps: 10000,
        hydrationMl: 200,
        prefs: { ...DEFAULT_ENGAGE_PREFS, frequency: 'balanced' },
      }),
    );
    const today = accepted.filter((row) => row.fireAt.toDateString() === now.toDateString());
    assert.ok(today.length <= dailyEngageCap('balanced'));
    assert.equal(today[0]?.priority, Math.max(...today.map((row) => row.priority)));
    assert.equal(trace.fatigue.selectedFrequency, 'balanced');
    assert.equal(trace.fatigue.baseDailyCap, 2);
  });

  it('moves optional companion fire times out of 23:30 quiet hours', () => {
    const now = new Date('2026-09-06T23:30:00');
    const rows = evaluateEngageCandidates(
      snap({
        now,
        lastOpenAt: now.getTime() - 5 * 86_400_000,
        prefs: { ...DEFAULT_ENGAGE_PREFS, quietStart: '22:00', quietEnd: '08:00' },
      }),
    );
    const optional = rows.filter((row) => row.family === 'checkin' || row.family === 'hydration');
    assert.ok(optional.every((row) => !isQuietAt(row.fireAt, '22:00', '08:00')));
  });

  it('lets a medication reminder stay at 23:30 outside the companion brain', () => {
    const slots = planMedicationReminderSlots('med-1', '23:30');
    assert.deepEqual(slots, [{ identifier: 'med-1:23:30', hour: 23, minute: 30 }]);
  });

  it('keeps chat follow-up free of conversation content on the lock screen', () => {
    const chat = ENGAGE_FALLBACKS['engage-chat'];
    assert.equal(chat.body.includes('{'), false);
    assert.equal(/preview|message|საუბარი:/.test(chat.body), false);
    const masked = ENGAGE_FALLBACKS['engage-masked'];
    assert.equal(/მენსტრუაცია|ოვულაცია|PMS|ორსულობა|მედიკამენტ/.test(`${masked.title} ${masked.body}`), false);
  });

  it('revalidates stale scheduled hydration after the user logs water', () => {
    const live: EngageLiveSignals = {
      now: new Date('2026-09-06T19:10:00'),
      hydrationMl: 2000,
      hydrationGoal: 2000,
      loggedPain: false,
      seenWeekly: false,
      unfinished: null,
      lastOpenAt: Date.now() - 4 * 3_600_000,
      missingProfileField: null,
      recentVisitId: null,
      medMissedWeek: 0,
      todaySteps: 8000,
      prevWeekSteps: 11000,
      sent: [],
    };
    const blocked = revalidateEngageCandidate({ family: 'hydration', templateKey: 'engage-hydration' }, live);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'hydration_target_reached_after_scheduling');
  });

  it('drops unfinished and visit candidates when the underlying entity is gone', () => {
    const live: EngageLiveSignals = {
      now: new Date('2026-09-06T19:10:00'),
      hydrationMl: 400,
      hydrationGoal: 2000,
      loggedPain: false,
      seenWeekly: false,
      unfinished: null,
      lastOpenAt: Date.now() - 4 * 3_600_000,
      missingProfileField: null,
      recentVisitId: null,
      medMissedWeek: 0,
      todaySteps: 400,
      prevWeekSteps: 11000,
      sent: [],
    };
    assert.equal(revalidateEngageCandidate({ family: 'unfinished' }, live).reason, 'draft_completed');
    assert.equal(
      revalidateEngageCandidate({ family: 'visitFollowup', entityId: 'vis-1' }, live).reason,
      'visit_canceled_or_gone',
    );
    assert.equal(revalidateEngageCandidate({ family: 'stepsQuiet' }, { ...live, loggedPain: true }).reason, 'pain_logged_after_scheduling');
    assert.equal(revalidateEngageCandidate({ family: 'question' }, live).reason, 'profile_question_answered');
    assert.equal(revalidateEngageCandidate({ family: 'weekly' }, { ...live, seenWeekly: true }).reason, 'weekly_already_opened');
    assert.equal(revalidateEngageCandidate({ type: 'medication', time: '09:00' }, { ...live, doseTaken: true }).reason, 'dose_already_taken');
  });

  it('schedules a weather walk companion only when the app was not just opened', () => {
    const weather = {
      candidate: 'weather_good_walk' as const,
      category: 'excellent_outdoor',
      windowStartIso: '2026-09-06T16:00',
      stale: false,
    };
    const quiet = evaluateEngageCandidates(
      snap({
        now: new Date('2026-09-06T14:00:00'),
        lastOpenAt: new Date('2026-09-06T10:00:00').getTime() - 4 * 60 * 60_000,
        weather,
        hydrationMl: 2000,
        weekSteps: 8000,
        prevWeekSteps: 8000,
      }),
    );
    assert.equal(quiet.some((row) => row.family === 'weatherWellness' && row.key === 'engage-weather-walk'), true);
    const recent = evaluateEngageCandidates(
      snap({
        now: new Date('2026-09-06T14:00:00'),
        lastOpenAt: new Date('2026-09-06T14:00:00').getTime(),
        weather,
      }),
    );
    assert.equal(recent.some((row) => row.family === 'weatherWellness'), false);
  });

  it('revalidates weather companions when the window or rain forecast changes', () => {
    const live: EngageLiveSignals = {
      now: new Date('2026-09-06T15:10:00'),
      hydrationMl: 400,
      hydrationGoal: 2000,
      loggedPain: false,
      seenWeekly: false,
      unfinished: null,
      lastOpenAt: Date.now() - 4 * 3_600_000,
      missingProfileField: null,
      recentVisitId: null,
      medMissedWeek: 0,
      todaySteps: 400,
      prevWeekSteps: 11000,
      sent: [],
    };
    assert.equal(
      revalidateEngageCandidate({ family: 'weatherWellness', templateKey: 'engage-weather-walk' }, { ...live, weatherWindowGone: true }).reason,
      'weather_window_no_longer_good',
    );
    assert.equal(
      revalidateEngageCandidate({ family: 'weatherWellness', templateKey: 'engage-weather-rain-soon' }, { ...live, weatherRainChanged: true }).reason,
      'rain_forecast_changed',
    );
    assert.equal(
      revalidateEngageCandidate({ family: 'weatherWellness', templateKey: 'engage-weather-walk' }, { ...live, loggedPain: true }).reason,
      'pain_logged_after_scheduling',
    );
    assert.equal(
      revalidateEngageCandidate({ family: 'weatherWellness', templateKey: 'engage-weather-walk' }, { ...live, stepsGoalReached: true }).reason,
      'steps_goal_reached_after_scheduling',
    );
    assert.equal(
      revalidateEngageCandidate({ family: 'weatherWellness', templateKey: 'engage-weather-hot' }, { ...live, hydrationMl: 1800 }).reason,
      'hydration_target_reached_after_scheduling',
    );
  });

  it('keeps weather lock-screen copy free of exact steps or ml', () => {
    for (const key of ['engage-weather-walk', 'engage-weather-rain-soon', 'engage-weather-hot', 'engage-weather-uv']) {
      const copy = ENGAGE_FALLBACKS[key];
      assert.ok(copy);
      assert.equal(/\d{3,}|ნაბიჯი|მლ/.test(`${copy.title} ${copy.body}`), false);
    }
    assert.equal(engageDestination('weatherWellness'), '/weather?from=push');
  });

  it('falls back to a list hub when the target entity is gone', () => {
    assert.equal(fallbackNotificationRoute('/medications/abc', false), '/medications');
    assert.equal(fallbackNotificationRoute('/visits/editor?id=x', false), '/visits');
    assert.equal(fallbackNotificationRoute('/health-metrics/hydration', true), '/health-metrics/hydration');
  });
});
