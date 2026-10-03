import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { periodStartFromSave } from './cycleFunnelEvents.ts';
import {
  CYCLE_FUNNEL_EXPLAIN_TOPICS,
  CYCLE_FUNNEL_LOG_SOURCES,
  CYCLE_FUNNEL_PERIOD_SOURCES,
  cycleFunnelProps,
} from './funnelQueue.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

test('day sheet: bleeding saved after a dry day is a period start; markStart maps by surface', () => {
  const logs = [{ date: '2026-10-01', flow: 'none' }, { date: '2026-09-20', flow: 'heavy' }];
  const base = { date: '2026-10-02', prevFlow: null, nextFlow: 'medium', logs };
  assert.equal(periodStartFromSave({ ...base, source: 'day_sheet' }), 'day_sheet');
  // Continuing a period (yesterday bled) or editing a bleeding day is not a start.
  assert.equal(periodStartFromSave({ ...base, source: 'day_sheet', logs: [{ date: '2026-10-01', flow: 'light' }] }), null);
  assert.equal(periodStartFromSave({ ...base, source: 'day_sheet', prevFlow: 'light' }), null);
  assert.equal(periodStartFromSave({ ...base, source: 'day_sheet', nextFlow: 'spotting' }), null);
  assert.equal(periodStartFromSave({ ...base, source: 'day_sheet', nextFlow: null }), null);
  // Month boundary.
  assert.equal(
    periodStartFromSave({ ...base, source: 'day_sheet', date: '2026-10-01', logs: [{ date: '2026-09-30', flow: 'heavy' }] }),
    null,
  );
  // The quick log on the cycle screen / Home reports a start only for the „დღეს დაიწყო“ button.
  assert.equal(periodStartFromSave({ ...base, source: 'quick' }), null);
  assert.equal(periodStartFromSave({ ...base, source: 'home' }), null);
  assert.equal(periodStartFromSave({ ...base, source: 'quick', markStart: true }), 'hero');
  assert.equal(periodStartFromSave({ ...base, source: 'home', markStart: true }), 'home');
  assert.equal(periodStartFromSave({ ...base, source: 'day_sheet', markStart: true }), 'day_sheet');
  assert.equal(periodStartFromSave({ ...base, source: 'full', markStart: true }), null);
  assert.equal(periodStartFromSave({ ...base, source: 'day_sheet', date: 'bad' }), null);
});

test('cycle funnel props are one enum value or nothing', () => {
  assert.deepEqual(cycleFunnelProps('source', 'quick', CYCLE_FUNNEL_LOG_SOURCES), { source: 'quick' });
  assert.deepEqual(cycleFunnelProps('topic', 'ring', CYCLE_FUNNEL_EXPLAIN_TOPICS), { topic: 'ring' });
  for (const bad of ['cramps', 'heavy', 'sex', '', null, undefined, 3, { source: 'quick' }]) {
    assert.equal(cycleFunnelProps('source', bad, CYCLE_FUNNEL_LOG_SOURCES), null, String(bad));
  }
  assert.equal(cycleFunnelProps('source', 'strip', CYCLE_FUNNEL_LOG_SOURCES), null);
  assert.equal(cycleFunnelProps('source', 'strip', CYCLE_FUNNEL_PERIOD_SOURCES)?.source, 'strip');
});

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) yield path;
  }
}

test('every cycle funnel call site passes a bare enum — never a category, id or value', () => {
  const allowed: Record<string, readonly string[]> = {
    trackCycleLogSaved: CYCLE_FUNNEL_LOG_SOURCES,
    trackCyclePeriodStarted: CYCLE_FUNNEL_PERIOD_SOURCES,
    trackCycleExplainOpened: CYCLE_FUNNEL_EXPLAIN_TOPICS,
  };
  // The one place that forwards a computed value: useCycleQuickLog (its own source prop / the pure helper's result).
  const variableArgs: Record<string, string[]> = {
    'src/components/cycle/useCycleQuickLog.ts': ['funnelSource', 'started'],
    'src/components/cycle/CycleExplainSheet.tsx': ['funnelTopic'],
  };
  const seen = { trackCycleLogSaved: 0, trackCyclePeriodStarted: 0, trackCycleExplainOpened: 0, funnelTopic: 0 };
  for (const dir of ['app', 'src']) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const text = readFileSync(file, 'utf8');
      if (rel !== 'src/lib/funnel.ts') {
        assert.doesNotMatch(text, /trackFunnel\(\s*['"]cycle_/, `${rel} must use the typed cycle helpers`);
      }
      if (rel === 'src/lib/funnel.ts') continue;
      for (const m of text.matchAll(/\b(trackCycleLogSaved|trackCyclePeriodStarted|trackCycleExplainOpened)\(([^)]*)\)/g)) {
        const [, fn, rawArg] = m;
        const arg = rawArg.trim();
        seen[fn as keyof typeof seen] += 1;
        const literal = /^'([a-z_]+)'$/.exec(arg);
        if (literal) {
          assert.ok(allowed[fn].includes(literal[1]), `${rel}: ${fn}(${arg}) is not in the enum`);
        } else {
          assert.ok((variableArgs[rel] ?? []).includes(arg), `${rel}: ${fn}(${arg}) must be one enum literal`);
        }
      }
      for (const m of text.matchAll(/funnelTopic="([^"]*)"/g)) {
        seen.funnelTopic += 1;
        assert.ok(CYCLE_FUNNEL_EXPLAIN_TOPICS.includes(m[1] as never), `${rel}: funnelTopic="${m[1]}"`);
      }
      for (const m of text.matchAll(/funnelSource(?:=|:\s*)["']([^"']*)["']/g)) {
        assert.ok(CYCLE_FUNNEL_LOG_SOURCES.includes(m[1] as never), `${rel}: funnelSource ${m[1]}`);
      }
    }
  }
  // The save paths, period starts and explain sheets are actually wired.
  assert.ok(seen.trackCycleLogSaved >= 2, 'log saves');
  assert.ok(seen.trackCyclePeriodStarted >= 3, 'period starts');
  assert.ok(seen.trackCycleExplainOpened >= 1 && seen.funnelTopic >= 6, 'explain sheets');
});

test('the sex sheet never reports to the funnel', () => {
  const text = readFileSync(join(ROOT, 'src/components/cycle/CycleSexSheet.tsx'), 'utf8');
  assert.doesNotMatch(text, /funnel|trackCycle/i);
});
