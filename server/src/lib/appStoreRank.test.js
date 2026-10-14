import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_STORE_ID, APP_STORE_RANK_SQL, chartUrl, rankIn, readAppStoreCharts, summarizeRank } from './appStoreRank.js';

const entry = (id, name) => ({ id: { attributes: { 'im:id': id } }, 'im:name': { label: name } });
const feed = (ids, updated = '2026-10-14T05:20:14-07:00') => ({
  feed: { updated: { label: updated }, entry: ids.map((id, i) => entry(id, `App ${i + 1}`)) },
});

test('our place, the app just ahead, and Apple’s update time come from the feed', () => {
  const r = rankIn(feed(['1', '2', APP_STORE_ID, '4']));
  assert.deepEqual(r, { rank: 3, size: 4, ahead: 'App 2', updatedAt: '2026-10-14T12:20:14.000Z' });
  assert.equal(rankIn(feed(['1', '2'])).rank, null, 'not in the list');
  assert.equal(rankIn({ feed: { entry: entry(APP_STORE_ID, 'MEDICARD AI') } }).rank, 1, 'a one-entry feed is an object');
  assert.deepEqual(rankIn(null), { rank: null, size: 0, ahead: null, updatedAt: null });
});

test('the card opens Apple’s chart for the category, or the app page for an unknown one', () => {
  assert.equal(chartUrl(6013), 'https://apps.apple.com/ge/charts/iphone/health-fitness-apps/6013?chart=top-free');
  assert.equal(chartUrl(6020), 'https://apps.apple.com/ge/charts/iphone/medical-apps/6020?chart=top-free');
  assert.equal(chartUrl(9999), `https://apps.apple.com/ge/app/id${APP_STORE_ID}`);
});

test('the category comes from Apple’s lookup; a failed overall chart does not hide the category place', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/lookup')) return Response.json({ results: [{ primaryGenreId: 6013, primaryGenreName: 'Health & Fitness' }] });
    if (url.includes('genre=6013')) return Response.json(feed(['a', 'b', 'c', 'd', 'e', 'f', APP_STORE_ID]));
    return new Response('down', { status: 503 });
  };
  const r = await readAppStoreCharts({ fetchImpl });
  assert.equal(r.rank, 7);
  assert.equal(r.genre, 'ჯანმრთელობა და ფიტნესი');
  assert.equal(r.overallRank, null);
  assert.equal(r.ahead, 'App 6');
  assert.match(r.chartUrl, /health-fitness-apps\/6013/);
  assert.ok(calls.every((u) => u.startsWith('https://itunes.apple.com/')), 'only Apple’s public feeds');
});

test('movement compares with the place a day ago; a smaller number is a climb', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const samples = [
    { at: '2026-10-08T12:00:00Z', rank: 15 },
    { at: '2026-10-14T11:00:00Z', rank: 9 },
    { at: '2026-10-14T18:00:00Z', rank: 8 }, // 22:00 in Tbilisi — still the 14th
    { at: '2026-10-15T11:00:00Z', rank: 7 },
  ];
  const s = summarizeRank({ rank: 7 }, samples, now);
  assert.deepEqual(s.yesterday, { rank: 9, at: '2026-10-14T11:00:00.000Z' });
  assert.equal(s.delta, 2);
  assert.deepEqual(s.weekAgo, { rank: 15, at: '2026-10-08T12:00:00.000Z' });
  assert.deepEqual(s.best, { rank: 7, at: '2026-10-15T11:00:00.000Z' });
  assert.deepEqual(s.series.map((d) => d.rank), [15, 8, 7], 'best place of each Tbilisi day');
  assert.equal(summarizeRank({ rank: 12 }, samples, now).delta, -3);
});

test('entering or leaving the top 100 is said as such, and a first day has no movement yet', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  assert.equal(summarizeRank({ rank: 40 }, [{ at: '2026-10-14T10:00:00Z', rank: null }], now).delta, 'entered');
  assert.equal(summarizeRank({ rank: null }, [{ at: '2026-10-14T10:00:00Z', rank: 90 }], now).delta, 'left');
  const first = summarizeRank({ rank: 7 }, [{ at: '2026-10-15T11:00:00Z', rank: 7 }], now);
  assert.equal(first.yesterday, null);
  assert.equal(first.delta, null);
});

test('the install statement only creates the samples table', () => {
  assert.match(APP_STORE_RANK_SQL.trim(), /^CREATE TABLE IF NOT EXISTS "AppStoreRankSample" \(/);
  assert.doesNotMatch(APP_STORE_RANK_SQL, /DROP|ALTER|DELETE|TRUNCATE/i);
});
