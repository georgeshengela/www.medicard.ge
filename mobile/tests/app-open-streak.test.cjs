const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx|ts|jsx|js)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// Owner 2026-10-08: a streak for merely opening the app rewards nothing healthy. No header pill,
// no daily full-screen celebration, no push — the screen stays only for links already delivered.
test('nothing in the app opens the app-open streak screen', () => {
  const offenders = [...sources(join(root, 'app')), ...sources(join(root, 'src'))]
    .filter((file) => /['"`]\/profile\/streak/.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(root.length + 1));
  assert.deepEqual(offenders, []);
  assert.ok(existsSync(join(root, 'app', 'profile', 'streak.tsx')), 'old push links still need the route');
});

test('the web portal shows no app-open streak and promises nothing for daily opens', () => {
  const pages = join(root, '..', 'server', 'public', 'app', 'js', 'pages');
  for (const name of ['home.js', 'profile.js']) {
    const src = readFileSync(join(pages, name), 'utf8');
    assert.doesNotMatch(src, /currentStreak|longestStreak/, name);
    assert.doesNotMatch(src, /ყოველდღიური შესვლით|daily check-ins/i, name);
  }
});

test('the check-in notification offers no button that saves nothing', () => {
  const src = readFileSync(join(root, 'src', 'lib', 'mediNotificationActions.ts'), 'utf8');
  const checkin = src.match(/setNotificationCategoryAsync\(NOTIF_CATEGORY\.checkin, \[([\s\S]*?)\]\);/);
  assert.ok(checkin, 'check-in category is still registered');
  assert.doesNotMatch(checkin[1], /NOTIF_ACTION\.ok/);
  assert.doesNotMatch(src, /buttonTitle: tx\('კარგად ვარ/);
  // Taps on notifications delivered before the change still resolve without navigating.
  assert.match(src, /if \(action === NOTIF_ACTION\.ok\) \{\s*return \{ navigate: false \};/);
});

test('a missed day on the streak screen is neutral, not red', () => {
  const src = readFileSync(join(root, 'src', 'components', 'check-in', 'StreakAssets.tsx'), 'utf8');
  const skipped = src.slice(src.indexOf('export function StreakDaySkipped'));
  assert.doesNotMatch(skipped, /#F43F5E|#EF4444|#DC2626/i);
});
