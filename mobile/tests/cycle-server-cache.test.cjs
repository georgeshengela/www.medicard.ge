const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const root = join(__dirname, '..');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx|ts)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const rel = (file) => relative(root, file).split('\\').join('/');
const read = (file) => readFileSync(file, 'utf8');

// AGENTS.md „Server-data cache“ (W2-10): cycle screens read server data through the shared cache
// (useCycleView → ['cycle','view'], src/lib/cycleQueries.ts → ['cycle', …]), never by hand on focus.
const SCREENS = join(root, 'app', 'cycle');
const COMPONENTS = join(root, 'src', 'components', 'cycle');

/** Server reads of api.cycle (GETs). Writes are fine anywhere; they invalidate 'cycle' themselves. */
const READS = ['get', 'pregnancy', 'ttc', 'postpartum', 'pregnancyCarePlan', 'observationTrends', 'predictionHistory', 'doctorSummary', 'exportData'];
const READ_CALL = new RegExp(`api\\.cycle\\s*\\.\\s*(${READS.join('|')})\\s*\\(`, 'g');

/**
 * Justified exceptions (file → reads allowed there):
 * - index.tsx: the TTC / pregnancy / postpartum overviews are generation-guarded state machines
 *   (cycleTtcQuery / cyclePregnancyQuery / cyclePostpartumQuery, own tests) driven by every new
 *   cached view — not by focus; the care-plan read there only re-plans reminders.
 * - summary.tsx: the doctor summary is generated on the PDF tap with the options chosen on screen.
 */
const ALLOWED_READS = {
  'app/cycle/index.tsx': ['ttc', 'pregnancy', 'postpartum', 'pregnancyCarePlan'],
  'app/cycle/summary.tsx': ['doctorSummary'],
};

test('cycle screens never fetch api.cycle reads on focus', () => {
  const offenders = sources(SCREENS)
    .concat(sources(COMPONENTS))
    .filter((file) => {
      const src = read(file);
      return /\buseFocusEffect\s*\(/.test(src) && (new RegExp(READ_CALL.source).test(src) || /\bloadCycleView\s*\(/.test(src));
    })
    .map(rel);
  assert.deepEqual(offenders, []);
});

test('cycle screens read server data through the cache, not by hand', () => {
  const offenders = [];
  for (const file of sources(SCREENS)) {
    const name = rel(file);
    const src = read(file);
    const allowed = ALLOWED_READS[name] || [];
    for (const match of src.matchAll(READ_CALL)) {
      if (!allowed.includes(match[1])) offenders.push(`${name}: api.cycle.${match[1]}()`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('loadCycleView in a screen only re-plans reminders after a save', () => {
  // useCycleView wraps loadCycleView (offline overlay included); the screens call the hook.
  const offenders = sources(SCREENS)
    .filter((file) => /\bloadCycleView\s*\(/.test(read(file)))
    .map(rel);
  assert.deepEqual(offenders, ['app/cycle/pregnancy/care-plan.tsx']);
  const carePlan = read(join(SCREENS, 'pregnancy', 'care-plan.tsx'));
  const uses = [...carePlan.matchAll(/\bloadCycleView\s*\(/g)];
  assert.equal(uses.length, 1, 'only refreshReminders reads the view by hand');
  assert.match(carePlan, /async function refreshReminders[\s\S]*?loadCycleView\(user\.id\)[\s\S]*?syncPregnancyCareReminders/);
});

test('the migrated screens and cards use the cached hooks', () => {
  const expectations = {
    'app/cycle/journal.tsx': [/useCycleView\(/],
    'app/cycle/summary.tsx': [/useCycleView\(/],
    'app/cycle/trends.tsx': [/useCycleView\(/, /useCycleObservationTrends\(/],
    'app/cycle/periods.tsx': [/useCycleView\(/],
    'app/cycle/log.tsx': [/useCycleView\(/],
    'app/cycle/week/[week].tsx': [/useCycleView\(/, /useCyclePregnancy\(/],
    'app/cycle/pregnancy/timeline.tsx': [/useCycleView\(/, /useCyclePregnancy\(/],
    'app/cycle/pregnancy/care-plan.tsx': [/useCycleView\(/, /useCyclePregnancyCarePlan\(/, /putCyclePregnancyCarePlan\(/],
    'src/components/cycle/CycleObservationTrends.tsx': [/useCycleObservationTrends\(/],
    'src/components/cycle/CyclePredictionHistoryCard.tsx': [/useCyclePredictionHistory\(/],
  };
  for (const [name, patterns] of Object.entries(expectations)) {
    const src = read(join(root, ...name.split('/')));
    for (const pattern of patterns) assert.match(src, pattern, `${name} should match ${pattern}`);
  }
  // The cards no longer read the API themselves.
  for (const name of ['CycleObservationTrends.tsx', 'CyclePredictionHistoryCard.tsx']) {
    assert.doesNotMatch(read(join(COMPONENTS, name)), /api\.cycle/, name);
  }
});

test('cycle cache keys and tiers', () => {
  const keys = read(join(root, 'src', 'lib', 'cycleQueryKeys.ts'));
  for (const key of ["['cycle', 'view']", "['cycle', 'pregnancy']", "['cycle', 'pregnancy-care-plan']", "['cycle', 'observation-trends']", "['cycle', 'prediction-history']"]) {
    assert.ok(keys.includes(key), key);
  }
  const queries = read(join(root, 'src', 'lib', 'cycleQueries.ts'));
  // History-like reads the person changes by logging: SHORT (writes invalidate them anyway).
  assert.equal((queries.match(/staleTime: FRESH\.SHORT/g) || []).length, 4);
  assert.doesNotMatch(queries, /FRESH\.LIVE/);
  assert.match(read(join(root, 'src', 'lib', 'cycleViewCache.ts')), /CYCLE_VIEW_KEY = CYCLE_QUERY_KEYS\.view/);
});

test('a stale return sends one request, not two (focus refetch joins the in-flight one)', () => {
  const hook = read(join(root, 'src', 'hooks', 'useAccountQuery.ts'));
  assert.match(hook, /refetchQueries\(\{[^}]*stale: true[^}]*\}, \{ cancelRefetch: false \}\)/);
});
