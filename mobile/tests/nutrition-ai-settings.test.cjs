const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const load = () => import("../src/lib/nutrition.ts");

// A momentary network error on GET /api/nutrition/settings used to become `{ photoEnabled: false }`,
// cached for 5 minutes: photo, label and describe looked paused although nothing was paused.
test("only the server's own photoEnabled: false turns the AI estimates off", async () => {
  const { aiEstimatesAvailable } = await load();
  assert.equal(aiEstimatesAvailable({ photoEnabled: false }), false, "a real admin pause still hides the AI methods");
  assert.equal(aiEstimatesAvailable({ photoEnabled: true }), true);
  assert.equal(aiEstimatesAvailable(undefined), true, "first read in flight or failed: not a pause");
  assert.equal(aiEstimatesAvailable(null), true);
});

test("the diary never turns a failed settings read into cached data", () => {
  const diary = readFileSync(join(__dirname, "../app/nutrition/diary.tsx"), "utf8");
  const start = diary.indexOf('key: ["nutrition", "settings"]');
  assert.ok(start > 0, "the diary reads the nutrition settings through the shared cache");
  const query = diary.slice(start, diary.indexOf("});", start));
  assert.match(query, /fetch: \(\) => api\.nutrition\.settings\(\),/);
  assert.doesNotMatch(query, /\.catch\(/, "an error must stay an error, never data");
  assert.match(diary, /const enabled = aiEstimatesAvailable\(settingsQuery\.data\);/);
  assert.doesNotMatch(diary, /photoEnabled \?\? false/);
});

test("web /app keeps the AI methods when the settings read fails", () => {
  const web = readFileSync(join(__dirname, "../../server/public/app/js/pages/nutrition.js"), "utf8");
  assert.doesNotMatch(web, /settings'\)\.catch\(\(\) => \(\{ photoEnabled: false \}\)\)/);
  assert.doesNotMatch(web, /settings: \{ photoEnabled: false \}/);
  assert.match(web, /const aiOn = \(\) => S\.settings\?\.photoEnabled !== false && featureOn\('nutritionAi'\);/);
  assert.match(web, /if \(settings\) S\.settings = settings;/, "a failed re-read keeps the last good answer");
});
