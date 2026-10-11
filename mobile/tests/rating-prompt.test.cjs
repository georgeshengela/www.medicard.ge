const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx|ts|jsx|js)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-20T12:00:00Z');
const OLD_ACCOUNT = '2026-10-01T09:00:00Z';

async function rules() {
  return import('../src/lib/ratingPromptRules.ts');
}

// App Store rating card (owner 2026-10-11): calm — only after a good moment, a week-old account,
// at most three asks 30 days apart, never again after „შეაფასე“.
test('the card follows a fresh second good moment on a week-old account', async () => {
  const { EMPTY_RATING_STATE: E, ratingPromptDue, withGoodMoment } = await rules();
  const once = withGoodMoment(E, NOW - 5 * DAY);
  const twice = withGoodMoment(once, NOW - 60_000);
  assert.equal(ratingPromptDue(once, { now: NOW, accountCreatedAt: OLD_ACCOUNT }), false, 'one moment is not enough');
  assert.equal(ratingPromptDue(twice, { now: NOW, accountCreatedAt: OLD_ACCOUNT }), true);
  assert.equal(ratingPromptDue(twice, { now: NOW, accountCreatedAt: new Date(NOW - 3 * DAY).toISOString() }), false, 'new account');
  assert.equal(ratingPromptDue(twice, { now: NOW, accountCreatedAt: null }), false, 'unknown account age');
  assert.equal(ratingPromptDue(twice, { now: NOW + 4 * 3_600_000, accountCreatedAt: OLD_ACCOUNT }), false, 'stale moment');
  assert.equal(ratingPromptDue(E, { now: NOW, accountCreatedAt: OLD_ACCOUNT }), false, 'no moment');
});

test('one moment brings one card; later waits 30 days; three asks at most; rate ends it', async () => {
  const { EMPTY_RATING_STATE: E, ratingPromptDue, withAnswer, withGoodMoment, withShown } = await rules();
  const due = (s, at) => ratingPromptDue(s, { now: at, accountCreatedAt: OLD_ACCOUNT });
  let s = withGoodMoment(withGoodMoment(E, NOW - 2 * DAY), NOW);
  s = withAnswer(withShown(s, NOW), 'later');
  assert.equal(due(s, NOW + 1000), false, 'the moment is used up');
  s = withGoodMoment(s, NOW + 10 * DAY);
  assert.equal(due(s, NOW + 10 * DAY + 1000), false, 'cooldown');
  let t = NOW;
  for (let ask = 2; ask <= 3; ask += 1) {
    t += 31 * DAY;
    s = withGoodMoment(s, t);
    assert.equal(due(s, t + 1000), true, `ask ${ask}`);
    s = withShown(s, t + 1000);
  }
  s = withGoodMoment(s, t + 40 * DAY);
  assert.equal(due(s, t + 40 * DAY + 1000), false, 'never a fourth time');
  const rated = withAnswer(withShown(withGoodMoment(withGoodMoment(E, NOW - DAY), NOW), NOW), 'rate');
  const later = withGoodMoment(rated, NOW + 90 * DAY);
  assert.equal(due(later, NOW + 90 * DAY + 1000), false, 'never after „შეაფასე“');
});

test('stored state survives garbage', async () => {
  const { EMPTY_RATING_STATE: E, parseRatingState } = await rules();
  for (const raw of [null, '', 'nope', '[]', '{"moments":"5","shows":-2,"rated":"yes","lastShownAt":"x"}']) {
    assert.deepEqual(parseRatingState(raw), { ...E }, String(raw));
  }
  assert.deepEqual(parseRatingState('{"moments":3,"lastMomentAt":5,"shows":1,"lastShownAt":7,"rated":true}'), {
    moments: 3, lastMomentAt: 5, shows: 1, lastShownAt: 7, rated: true,
  });
});

// Apple 5.6.1 / 3.2.2 and Google: never pay for a rating, never gate it on a happy answer.
test('nothing rewards or gates a rating', () => {
  for (const rel of ['src/lib/ratingPrompt.ts', 'src/lib/ratingPromptRules.ts', 'src/components/home/HomeRatingPrompt.tsx']) {
    // code only: the doc comments name the rule they keep
    const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(src, /rewardsApi|quest\/|coin|wallet/i, rel);
    assert.doesNotMatch(src, /მოგწონს\s*\?|do you like/i, rel);
  }
  const callers = [...sources(join(root, 'app')), ...sources(join(root, 'src'))]
    .filter((file) => /requestStoreReview\(/.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(root.length + 1).replace(/\\/g, '/'))
    .sort();
  assert.deepEqual(callers, ['src/components/home/HomeRatingPrompt.tsx', 'src/lib/ratingPrompt.ts']);
});

// Good moments only — never health worries (labs, symptoms, scans, cycle) or MEDIRUN mid-walk.
test('good moments come from the four happy places only', () => {
  const callers = [...sources(join(root, 'app')), ...sources(join(root, 'src'))]
    .filter((file) => /noteRatingMoment\(\)/.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(root.length + 1).replace(/\\/g, '/'))
    .filter((file) => file !== 'src/lib/ratingPrompt.ts')
    .sort();
  assert.deepEqual(callers, [
    'app/health-metrics/steps/goal/completed.tsx',
    'app/health-metrics/weight/goal/completed.tsx',
    'app/run/summary.tsx',
    'src/components/medications/MedicationHubScreen.tsx',
  ]);
});
