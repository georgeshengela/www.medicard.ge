// MEDIRUN „გაანათე თბილისი“ (economy 2) — every /api/medipulsi route the hub, the panels and a session use,
// except /grand (engage.mjs). Shapes: server/src/routes/medipulsi.routes.js, lib/medipulsi/service.js (snapshot,
// nearby, claim, leaderboard), drops.js (dropsView), economy.js (walletView), territory.js / territoryMath.js.
// The player: 0,42 % of Tbilisi lit, balance 1 240, this season +860 (23 boxes, 7 first finds, one weekly bronze).
// Dates are relative to the mock's "today" (use a Thursday ≥ 2026-10-22 for a believable season).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { addDays, isoAt, mondayOf, tbilisiToday, weekday } from '../lib.mjs';

const REPO = 'C:/Users/User/Desktop/www.medicard';
const CAMPAIGN = JSON.parse(readFileSync(`${REPO}/server/src/data/medirun-campaign.json`, 'utf8'));
const core = {};
try {
  Object.assign(core, await import(pathToFileURL(`${REPO}/server/src/lib/medipulsi/core/missions.js`).href));
  Object.assign(core, await import(pathToFileURL(`${REPO}/server/src/lib/medipulsi/core/journey.js`).href));
} catch (error) {
  console.warn('[medirun] core import failed', error?.message);
}

const DECAY = CAMPAIGN.economy?.decay || [100, 60, 40, 25];
const payout = (base, rank) => {
  const pct = DECAY[Math.min(rank - 1, DECAY.length - 1)];
  return Math.max(5, Math.round((base * pct) / 100 / 5) * 5);
};
const unauthorized = (rq) => (/^Bearer\s+\S{8,}/.test(rq.auth || '') ? null : rq.reply(401, { error: 'ავტორიზაცია საჭიროა. შედი ანგარიშში.' }));
const pastIso = (ymd, hhmm) => {
  const iso = isoAt(ymd, hhmm);
  return Date.parse(iso) <= Date.now() - 60_000 ? iso : new Date(Date.now() - 25 * 60_000).toISOString();
};

// ───────── the season, newest first: [daysAgo, time, place, district, base, rank] ─────────
const BOXES = [
  [0, '08:41', 'ვაკის პარკი', 'ვაკე', 50, 2],
  [1, '18:52', 'ვერის ბაღი', 'მთაწმინდა', 30, 2],
  [1, '13:24', 'დედაენის ბაღი', 'მთაწმინდა', 50, 3],
  [2, '18:47', 'გიორგი ლეონიძის ბაღი', 'მთაწმინდა', 20, 2],
  [2, '08:37', 'მზიური პარკი', 'ვაკე', 80, 3],
  [3, '18:20', 'რიყის პარკი', 'ისანი', 30, 1],
  [4, '17:58', 'ლისი რეკრეაცია', 'საბურთალო', 80, 1],
  [4, '13:47', 'ნუცუბიძის დიდი პარკი', 'ვაკე', 50, 1],
  [5, '16:12', 'ვაკის პარკი', 'ვაკე', 150, 2],
  [5, '10:05', 'მთაწმინდის პარკი', 'მთაწმინდა', 30, 3],
  [6, '18:33', '9 აპრილის სახელობის ბაღი', 'მთაწმინდა', 20, 1],
  [7, '08:52', 'ვაკის პარკი', 'ვაკე', 30, 1],
  [8, '13:15', 'გოთუას სახელობის პარკი', 'საბურთალო', 50, 1],
  [9, '18:40', 'ვერის ბაღი', 'მთაწმინდა', 30, 2],
  [10, '08:25', 'მზიური პარკი', 'ვაკე', 30, 4],
  [11, '17:40', 'რიყის პარკი', 'ისანი', 120, 2],
  [12, '16:08', 'რიყის პარკი', 'ისანი', 80, 1],
  [12, '09:51', 'დედაენის ბაღი', 'მთაწმინდა', 30, 2],
  [13, '13:30', 'ვაკის პარკი', 'ვაკე', 50, 3],
  [14, '08:40', 'ნანტის ბაღი', 'საბურთალო', 30, 2],
  [15, '18:15', 'ვერის ბაღი', 'მთაწმინდა', 30, 2],
  [16, '13:20', 'მზიური პარკი', 'ვაკე', 50, 3],
  [17, '08:33', 'ვაკის პარკი', 'ვაკე', 20, 2],
];
// Walk length on each box day (m), plus a few walks without a box.
const EXTRA_WALKS = [[0, '08:05', 3180], [1, '18:20', 4620], [1, '12:58', 2210], [2, '08:10', 3940], [3, '18:02', 5120], [4, '17:30', 4480], [5, '15:40', 6210], [6, '18:10', 3350], [7, '08:20', 2980], [8, '12:50', 3730], [9, '18:05', 4010], [10, '08:00', 3120], [11, '17:15', 5480], [12, '15:35', 6040], [13, '13:00', 2870], [14, '08:15', 3300], [15, '17:50', 4150], [16, '12:55', 3560], [17, '08:02', 2640], [18, '19:10', 4870], [21, '18:40', 3910], [24, '09:30', 5230], [27, '18:15', 4420], [30, '08:40', 3180], [33, '19:00', 5760], [37, '10:10', 4040], [41, '18:30', 3820], [45, '09:00', 4990], [50, '18:50', 3660], [56, '10:20', 5310]];

const OTHERS_WEEK_BOXES = [
  ['ლუკა_რიყე', 410, 11, 4], ['ანი.ვერე', 365, 10, 3], ['ნიკა_მზიური', 270, 8, 2],
  null, // me
  ['თამარი.კ', 130, 5, 1], ['საბა_ლისი', 115, 5, 1], ['მარიამი', 100, 4, 1], ['დათო_9', 85, 4, 0], ['ქეთი_ვაკე', 70, 3, 1], ['სანდრო', 55, 3, 0],
];
const OTHERS_SEASON_BOXES = [
  ['ანი.ვერე', 1740, 46, 15], ['ლუკა_რიყე', 1615, 44, 13], ['ნიკა_მზიური', 1180, 33, 9], ['საბა_ლისი', 960, 27, 8], ['თამარი.კ', 905, 25, 7],
  null, // me (760 from boxes)
  ['მარიამი', 610, 19, 4], ['დათო_9', 540, 16, 3], ['ქეთი_ვაკე', 470, 14, 4], ['სანდრო', 390, 12, 2],
];
const OTHERS_WEEK_METERS = [
  ['საბა_ლისი', 38240, 9], ['ლუკა_რიყე', 31580, 8], ['ანი.ვერე', 27910, 7], ['ელენე_ლ', 24350, 6], ['ნიკა_მზიური', 21120, 6],
  null, ['თამარი.კ', 15400, 4], ['მარიამი', 12260, 4], ['დათო_9', 9840, 3], ['ქეთი_ვაკე', 7310, 2],
];
const OTHERS_SEASON_METERS = [
  ['საბა_ლისი', 164200, 38], ['ლუკა_რიყე', 151900, 36], ['ანი.ვერე', 138400, 33], ['ელენე_ლ', 112700, 29],
  null, ['ნიკა_მზიური', 96300, 25], ['თამარი.კ', 81900, 21], ['მარიამი', 64300, 18], ['დათო_9', 51200, 14], ['ქეთი_ვაკე', 43800, 12],
];

function handleFor(persona) {
  return persona === 'man' ? 'გიო.ვაკე' : 'ნინო_მზიური';
}

function seed(state, ctx) {
  const today = ctx.today;
  const persona = ctx.persona;
  const boxes = BOXES.map(([ago, time, place, district, base, rank], i) => {
    const date = addDays(today, -ago);
    return { id: `claim-${date}-${i}`, giftId: `glow-${date}-${time.replace(':', '')}-${String(i).padStart(2, '0')}`, date, createdAt: pastIso(date, time), place, district, base, rank, coins: payout(base, rank) };
  });
  const monday = mondayOf(today);
  const prize = Date.parse(isoAt(monday, '00:10')) <= Date.now() && monday > CAMPAIGN.start
    ? { id: `prize-${monday}`, createdAt: isoAt(monday, '00:10'), coins: 100, rank: 3, board: 'boxes', week: addDays(monday, -7) }
    : null;
  const walks = EXTRA_WALKS.map(([ago, time, meters], i) => {
    const date = addDays(today, -ago);
    const seconds = Math.round((meters / 1000) * (640 + ((i * 37) % 80)));
    return { id: `walk-${date}-${time.replace(':', '')}`, startedAt: pastIso(date, time), meters, seconds, steps: Math.round(meters / 0.74), newMeters: Math.round(meters * (0.18 + ((i * 13) % 20) / 100)) };
  }).filter((w) => Date.parse(w.startedAt) < Date.now());
  state.medirun = {
    handle: handleFor(persona),
    optIn: true,
    settings: { mapMode: 'auto', sound: true, haptic: true, followBearing: true, threeD: true },
    boxes,
    prize,
    walks,
    balance: 1240,
    claimed: [],
    session: null,
    book: {
      version: 1,
      selected: 'turtle',
      progress: {
        vake: { meters: 500, seconds: 60, completedAt: isoAt(addDays(today, -17), '08:40') },
        mziuri: { meters: 450, seconds: 60, completedAt: isoAt(addDays(today, -16), '13:30') },
        vera: { meters: 300, seconds: 60, completedAt: isoAt(addDays(today, -15), '18:30') },
        dedaena: { meters: 300, seconds: 60, completedAt: isoAt(addDays(today, -12), '10:02') },
        rike: { meters: 400, seconds: 60, completedAt: isoAt(addDays(today, -12), '16:20') },
        lisi: { meters: 1000, seconds: 60, completedAt: isoAt(addDays(today, -4), '18:15') },
        april9: { meters: 250, seconds: 60, completedAt: isoAt(addDays(today, -6), '18:40') },
        mtatsminda: { meters: 600, seconds: 60, completedAt: isoAt(addDays(today, -5), '10:30') },
        turtle: { meters: 448, seconds: 60, completedAt: null },
        orbeliani: { meters: 70, seconds: 40, completedAt: null },
      },
    },
  };
}

export function init(state, ctx) {
  seed(state, ctx);
}

function M(rq) {
  if (!rq.state.medirun) seed(rq.state, { today: rq.today, persona: rq.persona });
  return rq.state.medirun;
}

function journey() {
  const j = core.createJourney ? core.createJourney('gps') : { version: 3, position: [44.7537, 41.7116], status: 'waiting', covered: {}, trail: [] };
  return { ...j, position: [44.7537, 41.7116], accuracy: 12 };
}

function snapshot(rq) {
  const m = M(rq);
  const claims = [...m.claimed, ...m.boxes].map((b) => ({
    id: b.id,
    giftId: b.giftId,
    status: 'APPROVED',
    code: b.id.replace(/[^0-9]/g, '').slice(-10).padStart(10, '7'),
    reward: { title: `${b.coins} Medi Coins`, description: `ყუთი · ${b.place}`, kind: 'DIGITAL', coins: b.coins, rank: b.rank, base: b.base },
    createdAt: b.createdAt,
  }));
  const totals = { walks: m.walks.length, meters: m.walks.reduce((s, w) => s + w.meters, 0), newMeters: m.walks.reduce((s, w) => s + w.newMeters, 0) };
  return {
    userId: rq.state.user?.id || 'mock-user',
    state: { journey: journey(), book: m.book, lastSampleTime: null },
    settings: m.settings,
    handle: m.handle,
    leaderboardOptIn: m.optIn,
    revision: 12,
    session: m.session,
    history: m.walks.slice(0, 50),
    totals,
    claims,
    missions: core.MISSIONS || [],
    config: { enabled: true, giftsEnabled: true, leaderboardEnabled: true, message: '' },
    mapboxToken: '',
  };
}

// ───────── drops (dropsView) ─────────
const DISTRICT_ROTATION = ['ვაკე', 'მთაწმინდა', 'საბურთალო', 'ისანი', 'დიდუბე', 'ნაძალადევი', 'ჩუღურეთი', 'კრწანისი', 'სამგორი', 'გლდანი'];
const coinsOf = (day) => ({ min: Math.min(...day.coins.map((c) => c.amount)), max: Math.max(...day.coins.map((c) => c.amount)) });
function dayKind(ymd) {
  const d = weekday(ymd);
  return d === 0 || d === 6 ? 'weekend' : 'weekday';
}
function wavesOf(ymd) {
  const kind = dayKind(ymd);
  const day = CAMPAIGN.days[kind];
  const per = kind === 'weekend' ? 8 : 6;
  const out = day.waves.map((w, i) => {
    const start = Date.parse(isoAt(ymd, w.time));
    return { id: w.id, kind: w.id === 'ev' ? 'evening' : 'regular', start, end: start + w.hours * 3600_000, boxes: per, coins: coinsOf(day), seed: `${ymd}:${i}` };
  });
  if (weekday(ymd) === 6) {
    const s = CAMPAIGN.saturday;
    const start = Date.parse(isoAt(ymd, s.time));
    const amounts = s.coins.map((c) => c.amount);
    out.push({ id: 'sat', kind: 'saturday', start, end: start + s.hours * 3600_000, boxes: s.points, coins: { min: Math.min(...amounts), max: Math.max(...amounts) }, seed: `${ymd}:sat` });
  }
  return out.sort((a, b) => a.start - b.start);
}
function dropsView(rq) {
  const m = M(rq);
  const now = Date.now();
  const today = tbilisiToday();
  const start = Date.parse(`${CAMPAIGN.start}T00:00:00+04:00`);
  const end = Date.parse(`${CAMPAIGN.end}T23:59:59+04:00`);
  const status = now < start ? 'upcoming' : now > end ? 'ended' : 'live';
  const waves = [...wavesOf(today), ...wavesOf(addDays(today, 1))].filter((w) => w.start >= start && w.start <= end);
  const live = waves.find((w) => w.start <= now && now < w.end);
  const next = waves.find((w) => w.start > now) || null;
  const offset = DISTRICT_ROTATION.indexOf('ვაკე');
  let districts = [];
  let boxesNow = 0;
  let openingsLeft = 0;
  if (live) {
    // One box of the wave already ran out; the rest still have openings.
    boxesNow = live.boxes - 1;
    const elapsed = (now - live.start) / (live.end - live.start);
    openingsLeft = Math.max(boxesNow, Math.round(boxesNow * 5 * (1 - Math.min(0.85, elapsed * 0.9))));
    // The wave's theme box sits in the week's focus district (Vake), the rest rotate through the city.
    const picks = ['ვაკე'];
    for (let i = 0; picks.length < boxesNow; i += 1) picks.push(DISTRICT_ROTATION[(offset + i) % DISTRICT_ROTATION.length]);
    const counts = new Map();
    for (const d of picks) counts.set(d, (counts.get(d) || 0) + 1);
    districts = [...counts].map(([name, boxes]) => ({ name, boxes })).sort((a, b) => b.boxes - a.boxes || a.name.localeCompare(b.name));
  }
  const pastWaves = wavesOf(today).filter((w) => w.start <= now);
  const openedToday = pastWaves.reduce((s, w) => s + (live && w.start === live.start ? Math.max(3, w.boxes * 5 - openingsLeft) : w.boxes * 5 - 3), 0);
  const mineToday = m.boxes.filter((b) => b.date === today);
  return {
    enabled: true,
    campaign: { id: CAMPAIGN.id, name: CAMPAIGN.name.ka, status, start: CAMPAIGN.start, end: CAMPAIGN.end, rulesUrl: CAMPAIGN.rulesUrl },
    city: { id: CAMPAIGN.area.id, name: CAMPAIGN.area.ka, campaignCity: true, pending: false },
    now: { boxes: boxesNow, openingsLeft, endsAt: live ? new Date(live.end).toISOString() : null, coins: live ? live.coins : null, lanternBoxes: 0, districts },
    today: { opened: openedToday, coins: Math.round((openedToday * 27.5) / 5) * 5 },
    me: { opened: mineToday.length, coins: mineToday.reduce((s, b) => s + b.coins, 0) },
    next: next ? { startsAt: new Date(next.start).toISOString(), boxes: next.boxes, coins: next.coins, kind: next.kind } : null,
    schedule: [
      { id: 'weekday', label: 'ორშაბათი–პარასკევი', times: CAMPAIGN.days.weekday.waves.map((w) => w.time).join(' და '), coins: coinsOf(CAMPAIGN.days.weekday) },
      { id: 'weekend', label: 'შაბათი–კვირა', times: CAMPAIGN.days.weekend.waves.map((w) => w.time).join(' და '), coins: coinsOf(CAMPAIGN.days.weekend) },
      { id: 'saturday', label: 'შაბათი · ქოინების წვიმა', times: CAMPAIGN.saturday.time, coins: { min: 80, max: 150 } },
    ],
    economy: { decay: DECAY },
  };
}

// ───────── wallet (walletView) ─────────
function walletView(rq) {
  const m = M(rq);
  const rows = [
    ...m.claimed.map((b) => ({ ...b })),
    ...m.boxes,
  ].map((b) => ({ id: `ledger-${b.id}`, amount: b.coins, createdAt: b.createdAt, kind: 'box', rank: b.rank, base: b.base, place: b.place, district: b.district, city: 'თბილისი', board: null, week: null, giftKind: b.base >= 80 && b.createdAt.includes('T12:') ? 'saturday' : 'md' }));
  if (m.prize) rows.push({ id: `ledger-${m.prize.id}`, amount: m.prize.coins, createdAt: m.prize.createdAt, kind: 'prize', rank: m.prize.rank, base: null, place: null, district: null, city: null, board: m.prize.board, week: m.prize.week, giftKind: null });
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const boxRows = [...m.claimed, ...m.boxes];
  const earned = rows.reduce((s, r) => s + r.amount, 0);
  return {
    balance: m.balance,
    season: { earned, boxes: boxRows.length, firsts: boxRows.filter((b) => b.rank === 1).length, start: CAMPAIGN.start, end: CAMPAIGN.end },
    rows: rows.slice(0, 40),
    now: new Date().toISOString(),
  };
}

// ───────── leaderboard ─────────
function leaderboard(rq) {
  const m = M(rq);
  const period = rq.query.period === 'season' ? 'season' : 'week';
  const board = rq.query.board === 'boxes' ? 'boxes' : 'meters';
  const monday = mondayOf(tbilisiToday());
  const since = period === 'week' ? Date.parse(isoAt(monday, '00:00')) : Date.parse(`${CAMPAIGN.start}T00:00:00+04:00`);
  const myBoxes = [...m.claimed, ...m.boxes].filter((b) => Date.parse(b.createdAt) >= since);
  const myWalks = m.walks.filter((w) => Date.parse(w.startedAt) >= since);
  const mine = {
    boxes: myBoxes.length,
    coins: myBoxes.reduce((s, b) => s + b.coins, 0),
    firsts: myBoxes.filter((b) => b.rank === 1).length,
    meters: myWalks.reduce((s, w) => s + w.meters, 0),
    newMeters: myWalks.reduce((s, w) => s + w.newMeters, 0),
    walks: myWalks.length,
  };
  const template = board === 'boxes' ? (period === 'week' ? OTHERS_WEEK_BOXES : OTHERS_SEASON_BOXES) : period === 'week' ? OTHERS_WEEK_METERS : OTHERS_SEASON_METERS;
  let rows = template.map((r) => {
    if (!r) return board === 'boxes' ? { handle: m.handle, boxes: mine.boxes, coins: mine.coins, firsts: mine.firsts } : { handle: m.handle, meters: mine.meters, newMeters: mine.newMeters, walks: mine.walks };
    return board === 'boxes' ? { handle: r[0], coins: r[1], boxes: r[2], firsts: r[3] } : { handle: r[0], meters: r[1], newMeters: Math.round(r[1] * 0.31), walks: r[2] };
  });
  rows = rows.sort((a, b) => (board === 'boxes' ? b.coins - a.coins || b.boxes - a.boxes : b.meters - a.meters));
  if (!m.optIn) rows = rows.filter((r) => r.handle !== m.handle);
  const listed = rows.findIndex((r) => r.handle === m.handle);
  const nextMonday = isoAt(addDays(monday, 7), '00:00');
  const live = Date.now() >= Date.parse(`${CAMPAIGN.start}T00:00:00+04:00`);
  const prizesList = CAMPAIGN.economy.weeklyPrizes[board];
  const lastWeek = live && m.prize
    ? (board === 'boxes'
      ? [{ board, rank: 1, handle: 'ანი.ვერე', coins: prizesList[0] }, { board, rank: 2, handle: 'ლუკა_რიყე', coins: prizesList[1] }, { board, rank: 3, handle: m.handle, coins: prizesList[2] }]
      : [{ board, rank: 1, handle: 'საბა_ლისი', coins: prizesList[0] }, { board, rank: 2, handle: 'ელენე_ლ', coins: prizesList[1] }, { board, rank: 3, handle: 'ლუკა_რიყე', coins: prizesList[2] }])
    : [];
  return {
    rows,
    board,
    period,
    me: { ...mine, rank: listed >= 0 ? listed + 1 : null, listed: listed >= 0 },
    prizes: live ? { coins: prizesList, endsAt: new Date(Date.parse(nextMonday)).toISOString() } : null,
    lastWeek,
  };
}

// ───────── territory (a quiet Tbilisi outline as a dot grid, a few lit neighbourhoods) ─────────
const OUTLINE = [
  [44.70, 41.84], [44.76, 41.86], [44.83, 41.835], [44.885, 41.795], [44.95, 41.775], [45.03, 41.752], [45.08, 41.705], [45.05, 41.662],
  [44.975, 41.642], [44.90, 41.622], [44.845, 41.640], [44.80, 41.662], [44.742, 41.668], [44.692, 41.658], [44.645, 41.690], [44.622, 41.730],
  [44.650, 41.780], [44.680, 41.812],
];
const LIT = [
  // [lng, lat, strength 2..7] — Vake, Mziuri, Vere, Dedaena, Mtatsminda, Turtle lake, Lisi, Rike, Saburtalo streets.
  [44.7537, 41.7116, 7], [44.7480, 41.7080, 5], [44.7600, 41.7140, 6], [44.7704, 41.7113, 6], [44.7790, 41.7085, 5], [44.7880, 41.7040, 6],
  [44.7930, 41.7010, 4], [44.7860, 41.6950, 5], [44.7820, 41.6990, 3], [44.7490, 41.7030, 5], [44.7440, 41.6990, 3], [44.7322, 41.7438, 7],
  [44.7380, 41.7400, 4], [44.7270, 41.7470, 3], [44.7450, 41.7260, 4], [44.7520, 41.7210, 5], [44.7580, 41.7300, 3], [44.8115, 41.6924, 6],
  [44.8060, 41.6950, 4], [44.8000, 41.6980, 3], [44.7660, 41.7180, 4], [44.7700, 41.7230, 3],
];
function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
let MAP = null;
function tbilisiMap() {
  if (MAP) return MAP;
  const xs = OUTLINE.map((p) => p[0]);
  const ys = OUTLINE.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180) * 111_320;
  const widthM = (maxX - minX) * kx, heightM = (maxY - minY) * 111_320;
  const cell = Math.max(120, Math.max(widthM, heightM) / 64);
  const cols = Math.ceil(widthM / cell), rows = Math.ceil(heightM / cell);
  const lit = new Map();
  for (const [x, y, v] of LIT) {
    const gx = Math.floor(((x - minX) * kx) / cell), gy = Math.floor(((maxY - y) * 111_320) / cell);
    // The street band spills into the neighbouring squares, more faintly.
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      const k = `${gx + dx}:${gy + dy}`;
      const val = dx || dy ? Math.max(2, v - 3 - ((Math.abs(dx) + Math.abs(dy) + gx) % 2)) : v;
      lit.set(k, Math.max(lit.get(k) || 0, val));
    }
  }
  const grid = [];
  for (let gy = 0; gy < rows; gy += 1) {
    let line = '';
    for (let gx = 0; gx < cols; gx += 1) {
      const v = lit.get(`${gx}:${gy}`);
      if (v) { line += String(v); continue; }
      line += inside([minX + ((gx + 0.5) * cell) / kx, maxY - ((gy + 0.5) * cell) / 111_320], OUTLINE) ? '1' : '0';
    }
    grid.push(line);
  }
  const outline = [[...OUTLINE, OUTLINE[0]].map(([x, y]) => [Math.round((((x - minX) * kx) / cell) * 10) / 10, Math.round((((maxY - y) * 111_320) / cell) * 10) / 10])];
  MAP = { cols, rows, cellM: Math.round(cell), grid, outline };
  return MAP;
}
function territory(rq) {
  const percent = rq.state.engage?.medirun?.percent ?? 0.42;
  const km2 = Math.round((percent / 100) * CAMPAIGN.area.km2 * 1000) / 1000;
  return {
    paintedKm2: km2,
    world: { percent: 0.0000014 },
    cities: [{ id: CAMPAIGN.area.id, name: 'თბილისი', countryCode: 'GE', areaKm2: CAMPAIGN.area.km2, paintedKm2: km2, percent, map: tbilisiMap() }],
    countries: [{ id: 'GE', name: 'საქართველო', countryCode: 'GE', areaKm2: 69700, paintedKm2: km2, percent: Math.round((km2 / 69700) * 100 * 10000) / 10000 }],
    pending: false,
  };
}

// ───────── nearby / claim (the gift-opening shot) ─────────
const GIFT = { id: 'glow-today-am-03', place: 'ვაკის პარკი', district: 'ვაკე', base: 50, position: [44.7531, 41.7119] };
function nearby(rq) {
  const m = M(rq);
  if (!m.session || m.session.phase !== 'ACTIVE' || m.claimed.some((c) => c.giftId === GIFT.id)) return { signal: false, revealed: false, quality: true, period: 2200, distance: 0, gift: null };
  return {
    signal: true,
    revealed: true,
    quality: true,
    period: 800,
    distance: 9,
    gift: { id: GIFT.id, title: `${GIFT.base} Medi Coins`, description: `${GIFT.place} · პირველ გამხსნელს ${GIFT.base} Medi Coins`, rewardKind: 'DIGITAL', position: GIFT.position, coins: GIFT.base, rank: 1, base: GIFT.base, opened: 0, stock: 5, decay: DECAY },
  };
}

export const routes = [
  { method: 'GET', path: '/api/medipulsi/bootstrap', handler: (rq) => unauthorized(rq) || snapshot(rq) },
  {
    method: 'PATCH',
    path: '/api/medipulsi/settings',
    handler: (rq) => {
      const m = M(rq);
      const { handle, leaderboardOptIn, ...prefs } = rq.body || {};
      if (handle !== undefined) m.handle = handle;
      if (leaderboardOptIn !== undefined) m.optIn = leaderboardOptIn;
      m.settings = { ...m.settings, ...prefs };
      return snapshot(rq);
    },
  },
  { method: 'PUT', path: '/api/medipulsi/mission', handler: (rq) => { M(rq).book.selected = rq.body?.id ?? null; return snapshot(rq); } },
  {
    method: 'POST',
    path: '/api/medipulsi/sessions',
    handler: (rq) => {
      const m = M(rq);
      m.session = { id: rq.body?.id || 'session-1', seq: 0, phase: 'ACTIVE' };
      return snapshot(rq);
    },
  },
  {
    method: 'POST',
    path: '/api/medipulsi/sessions/:id/batches',
    handler: (rq) => {
      const m = M(rq);
      if (m.session) m.session.seq = rq.body?.seq ?? m.session.seq + 1;
      return { seq: m.session?.seq ?? 1, accepted: (rq.body?.fixes || []).length };
    },
  },
  {
    method: 'POST',
    path: '/api/medipulsi/sessions/:id/:action',
    handler: (rq) => {
      const m = M(rq);
      const action = rq.params.action;
      if (m.session) {
        if (action === 'finish') m.session = null;
        else m.session.phase = action === 'pause' ? 'PAUSED' : 'ACTIVE';
      }
      return snapshot(rq);
    },
  },
  { method: 'GET', path: '/api/medipulsi/nearby', handler: (rq) => unauthorized(rq) || nearby(rq) },
  {
    method: 'POST',
    path: '/api/medipulsi/gifts/:id/claim',
    handler: (rq) => {
      const m = M(rq);
      const today = tbilisiToday();
      const claim = { id: `claim-live-${Date.now()}`, giftId: rq.params.id, date: today, createdAt: new Date().toISOString(), place: GIFT.place, district: GIFT.district, base: GIFT.base, rank: 1, coins: GIFT.base };
      m.claimed.unshift(claim);
      m.balance += claim.coins;
      if (rq.state.engage?.quest) rq.state.engage.quest.coins = m.balance;
      return {
        id: claim.id,
        giftId: claim.giftId,
        status: 'APPROVED',
        code: 'A7F3C21E9B',
        reward: { title: `${claim.coins} Medi Coins`, description: `ყუთი · ${GIFT.place}`, kind: 'DIGITAL', coins: claim.coins, rank: 1, base: GIFT.base },
        createdAt: claim.createdAt,
        balance: m.balance,
      };
    },
  },
  { method: 'GET', path: '/api/medipulsi/drops', handler: (rq) => unauthorized(rq) || dropsView(rq) },
  { method: 'GET', path: '/api/medipulsi/wallet', handler: (rq) => unauthorized(rq) || walletView(rq) },
  { method: 'GET', path: '/api/medipulsi/leaderboard', handler: (rq) => unauthorized(rq) || leaderboard(rq) },
  { method: 'GET', path: '/api/medipulsi/territory', handler: (rq) => unauthorized(rq) || territory(rq) },
];
