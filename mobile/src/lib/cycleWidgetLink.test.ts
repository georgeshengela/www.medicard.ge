import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CYCLE_WIDGET_OPEN_ROUTE,
  CYCLE_WIDGET_START_ROUTE,
  isCycleWidgetStartLink,
  noteCycleWidgetLink,
  onCycleWidgetRoute,
  redirectCycleWidgetPath,
  takeCycleWidgetRoute,
  widgetStartClaimKey,
} from './cycleWidgetLink.ts';
import { claimNotificationTap } from './notificationTaps.ts';
import { CYCLE_WIDGET_START_URL } from './cycleWidgetSnapshot.ts';
import { isNotificationRoute } from './notificationPlan.ts';

test('recognises only the widget start link', () => {
  for (const ok of [CYCLE_WIDGET_START_URL, 'medicard:///cycle?periodStart=1', '/cycle?periodStart=1', 'medicard://cycle/?x=2&periodStart=1']) {
    assert.equal(isCycleWidgetStartLink(ok), true, ok);
  }
  for (const no of ['medicard://cycle', 'medicard://cycle?periodStart=0', 'medicard://run/active?resume=1', 'medicard://cycle/log?periodStart=1', '', null, undefined]) {
    assert.equal(isCycleWidgetStartLink(no as string), false, String(no));
  }
});

test('the queued routes are notification routes (same gate as a tapped notification)', () => {
  assert.equal(isNotificationRoute(CYCLE_WIDGET_START_ROUTE), true);
  assert.equal(isNotificationRoute(CYCLE_WIDGET_OPEN_ROUTE), true);
});

test('claimed once per day: the first tap starts, a repeat only opens the cycle screen', () => {
  const day = new Date(2026, 9, 14, 9, 30);
  let heard = 0;
  const off = onCycleWidgetRoute(() => {
    heard += 1;
  });
  assert.equal(noteCycleWidgetLink(CYCLE_WIDGET_START_URL, day), true);
  assert.deepEqual(takeCycleWidgetRoute()?.route, CYCLE_WIDGET_START_ROUTE);
  assert.equal(takeCycleWidgetRoute(), null, 'taken once');
  assert.equal(noteCycleWidgetLink(CYCLE_WIDGET_START_URL, new Date(2026, 9, 14, 21, 0)), true);
  assert.deepEqual(takeCycleWidgetRoute()?.route, CYCLE_WIDGET_OPEN_ROUTE);
  // The claim lives in the process-wide tap memory: a remounted shell never replays it.
  assert.equal(claimNotificationTap(widgetStartClaimKey('2026-10-14')), false);
  // The next day starts again.
  assert.equal(noteCycleWidgetLink(CYCLE_WIDGET_START_URL, new Date(2026, 9, 15, 8, 0)), true);
  assert.deepEqual(takeCycleWidgetRoute()?.route, CYCLE_WIDGET_START_ROUTE);
  assert.equal(heard, 3);
  off();
  // Other links are not touched.
  assert.equal(noteCycleWidgetLink('medicard://cycle', day), false);
  assert.equal(takeCycleWidgetRoute(), null);
});

test('expo-router never opens the start link itself; every other URL passes unchanged', () => {
  assert.equal(redirectCycleWidgetPath(CYCLE_WIDGET_START_URL, true), '/');
  assert.equal(redirectCycleWidgetPath(CYCLE_WIDGET_START_URL, false), null);
  takeCycleWidgetRoute();
  for (const url of ['medicard://run/active?resume=1', 'medicard://invite/ABC123', 'https://medicard.ge/i/ABC123', 'medicard://cycle']) {
    assert.equal(redirectCycleWidgetPath(url, true), url);
    assert.equal(redirectCycleWidgetPath(url, false), url);
  }
  assert.equal(takeCycleWidgetRoute(), null);
});

test('+native-intent hands the link over and the cycle screen starts with the widget source', () => {
  const root = new URL('../../', import.meta.url);
  const intent = readFileSync(new URL('app/+native-intent.tsx', root), 'utf8');
  assert.match(intent, /redirectCycleWidgetPath\(path, initial\)/);
  const layout = readFileSync(new URL('app/_layout.tsx', root), 'utf8');
  assert.match(layout, /takeCycleWidgetRoute\(\)/);
  assert.match(layout, /onCycleWidgetRoute\(queueWidgetRoute\)/);
  const cycle = readFileSync(new URL('app/cycle/index.tsx', root), 'utf8');
  assert.match(cycle, /widgetParams\.periodStart !== '1'/);
  assert.match(cycle, /cycleWidgetStartAllowed\(bundle, today\)\) void startPeriodNow\('widget'\)/);
  assert.match(cycle, /trackCyclePeriodStarted\('widget'\)/);
});
