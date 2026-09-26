const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../src/lib/fasting.ts");
const fast = { startedAt: "2026-09-27T00:00:00.000Z", endedAt: null, targetMinutes: 960 };
const at = (h, m = 0) => Date.parse("2026-09-27T00:00:00.000Z") + (h * 60 + m) * 60000;

test("elapsed time and progress follow the clock and stop at the end time", async () => {
  const { fastElapsedMinutes, fastProgress } = await load();
  assert.equal(fastElapsedMinutes(fast, at(8, 30)), 510);
  assert.equal(fastProgress(fast, at(8)), 0.5);
  assert.equal(fastProgress(fast, at(20)), 1, "progress never exceeds the goal");
  assert.equal(fastElapsedMinutes({ ...fast, endedAt: "2026-09-27T12:00:00.000Z" }, at(20)), 720);
  assert.equal(fastElapsedMinutes({ ...fast, startedAt: "2026-09-27T05:00:00.000Z" }, at(4)), 0, "no negative time");
});
test("labels read naturally in Georgian", async () => {
  const { clockLabel, clockLabelSeconds, hoursLabel } = await load();
  assert.equal(clockLabel(965), "16:05");
  assert.equal(clockLabelSeconds(3723000), "1:02:03");
  assert.equal(hoursLabel(960), "16 სთ");
  assert.equal(hoursLabel(975), "16 სთ 15 წთ");
  assert.equal(hoursLabel(null), "—");
});
test("presets map back to their protocol; other lengths are custom", async () => {
  const { protocolFor, FASTING_PROTOCOLS, FAST_MIN_HOURS, FAST_MAX_HOURS } = await load();
  assert.equal(protocolFor(16), "16:8");
  assert.equal(protocolFor(13), "custom");
  assert.ok(FASTING_PROTOCOLS.every((p) => p.hours >= FAST_MIN_HOURS && p.hours <= FAST_MAX_HOURS));
});
test("milestones stay practical and never claim a body state", async () => {
  const { fastMilestone } = await load();
  for (const p of [0, 0.3, 0.6, 0.8, 1]) assert.doesNotMatch(fastMilestone(p), /კეტოზ|აუტოფაგ|ცხიმის წვა/);
  assert.match(fastMilestone(1), /შესრულებულია/);
});
