// Engagement fixtures for the Home / Profile tabs:
//   MEDIRUN „გაანათე თბილისი“  GET /api/medipulsi/grand            (server/src/lib/medipulsi/grand.js grandView)
//   MEDI QUEST                GET /api/quests, /api/quests/profile, PUT /api/quests/timezone,
//                             POST /api/quests/:id/claim           (server/src/lib/quest.js, questPrivacy.js, questLevels.js)
//   Home news                 GET /api/announcements, /:id, /image/:id, POST /:id/events (server/src/lib/announcements.js publicCard)
//   MEDI COACH entry          GET /api/trainer/me, /photos, /overview (server/src/routes/trainer.routes.js, trainerStore.js)
//   Women's space gate        GET /api/community/membership         (server/src/routes/community.routes.js)
//   Identity                  GET /api/identity/avatar/me, /qr/me, POST /qr/rotate (server/src/routes/identity.routes.js)
//   Push copy                 GET /api/push/templates              (server/src/lib/pushTemplates.js listPushTemplates)
//   Open-Meteo stand-in       GET /__ext/open-meteo/forecast, /__ext/open-meteo/air-quality
//                             (NOT our API: the app calls api.open-meteo.com directly; a Playwright
//                             route can fulfil those requests from here — see bottom of file.)
//
// Location: Home's MEDIRUN campaign row only asks /grand when the profile city is Tbilisi (or the phone
// has local walks), and weather needs profile coordinates. init() therefore adds a Tbilisi
// `extraAnswers.location` to the core profile when it has none. ENGAGE_LOCATION=off|city|gps
// (default city: Tbilisi without coordinates → no Open-Meteo request from the browser; gps adds
// coordinates → the browser WILL fetch api.open-meteo.com unless that host is intercepted).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { addDays, isoAt, mondayOf, TZ } from '../lib.mjs';

const REPO = 'C:/Users/User/Desktop/www.medicard';
const LOCATION_MODE = ['off', 'city', 'gps'].includes(process.env.ENGAGE_LOCATION) ? process.env.ENGAGE_LOCATION : 'city';

// ───────────────────────── small helpers ─────────────────────────

const en = (rq) => String(rq.lang || '').toLowerCase().startsWith('en');
const t = (rq, ka, english) => (en(rq) ? english : ka);

/** RFC 4122 v4-shaped id, stable per seed (zod `.uuid()` accepts it). */
function uuidFrom(seed) {
  const h = createHash('sha1').update(String(seed)).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** 20-char base64url token, stable per seed (identity.js newQrToken shape). */
function tokenFrom(seed) {
  return createHash('sha256').update(String(seed)).digest().subarray(0, 15).toString('base64url');
}

/**
 * A Tbilisi wall-clock time on `ymd`, but never in the future: before that time it falls back to
 * `frac` of the way from local midnight to now (so the order of several stamps is kept).
 */
function pastAt(ymd, hhmm, frac) {
  const iso = isoAt(ymd, hhmm);
  const now = Date.now();
  if (Date.parse(iso) <= now - 60_000) return iso;
  const start = Date.parse(isoAt(ymd, '00:00'));
  return new Date(start + Math.max(0, now - start) * frac).toISOString();
}

/** questTime.endOfLocalDay: start of the next Tbilisi day minus 1 ms. */
function endOfLocalDay(ymd) {
  return new Date(Date.parse(isoAt(addDays(ymd, 1), '00:00')) - 1).toISOString();
}

/** questTime.isoWeekKey — `YYYY-Www`, Monday-first. */
function isoWeekKey(ymd) {
  const monday = mondayOf(ymd);
  const weekYear = Number(addDays(monday, 3).slice(0, 4));
  const week1Monday = mondayOf(`${weekYear}-01-04`);
  const week = Math.round((Date.parse(`${monday}T00:00:00Z`) - Date.parse(`${week1Monday}T00:00:00Z`)) / 86_400_000 / 7) + 1;
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

function tbilisiClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { hour: get('hour') % 24, minute: get('minute') };
}

/** middleware/auth.js requireAuth. */
function unauthorized(rq) {
  if (/^Bearer\s+\S{8,}/.test(rq.auth || '')) return null;
  return rq.reply(401, { error: t(rq, 'ავტორიზაცია საჭიროა. შედი ანგარიშში.', 'Please sign in to continue.') });
}

const userOf = (rq) => rq.state.user || { id: rq.persona === 'man' ? 'mock-user-man-0001' : 'mock-user-women-0001', gender: rq.persona === 'man' ? 'MALE' : 'FEMALE', status: 'ACTIVE' };

function slice(rq) {
  // Re-seed when the Tbilisi day turned over since the last reset (daily quests, news dates).
  if (!rq.state.engage || rq.state.engage.seededFor !== rq.today) seed(rq.state, { persona: rq.persona, today: rq.today });
  return rq.state.engage;
}

// ───────────────────────── MEDIRUN „გაანათე თბილისი“ ─────────────────────────

const CAMPAIGN_FALLBACK = {
  id: 'medirun-glow-2026',
  name: { ka: 'გაანათე თბილისი', en: 'Light up Tbilisi' },
  start: '2026-10-05',
  end: '2026-12-31',
  area: { id: 'r1996871', ka: 'თბილისი', en: 'Tbilisi', km2: 503.93 },
  rulesUrl: 'https://medicard.ge/medirun#rules',
  levels: [
    { id: 'spark', percent: 0.1, name: { ka: 'ნაპერწკალი', en: 'Spark' }, unlocks: { ka: 'პირველი ნიშანი: ქალაქი უკვე შენი წყალობით ანათებს.', en: 'Your first badge: the city already glows because of you.' } },
    { id: 'lantern', percent: 0.25, name: { ka: 'ფარანი', en: 'Lantern' }, unlocks: { ka: 'ნოემბრიდან შაბათობით ფარნის ყუთებს დაინახავ — თითოში 1 500 Medi Coins.', en: 'From November you will see the Saturday lantern boxes, 1,500 Medi Coins each.' } },
    { id: 'torch', percent: 0.5, name: { ka: 'ჩირაღდანი', en: 'Torch' }, unlocks: { ka: 'შუქურამდე ნახევარი გზაღა დაგრჩა.', en: 'Halfway to the lighthouse.' } },
    { id: 'lighthouse', percent: 1, name: { ka: 'შუქურა', en: 'Lighthouse' }, unlocks: { ka: '31 დეკემბერს დაინახავ დიდ საჩუქარს — წითელ iPhone 18 Pro Max-ს.', en: 'On 31 December you will see the grand prize, a red iPhone 18 Pro Max.' } },
  ],
  grand: { id: 'glow-2026-12-31-grand', dropAt: '2026-12-31T12:00:00+04:00', hours: 6, minPercent: 1, prize: { ka: 'iPhone 18 Pro Max', en: 'iPhone 18 Pro Max' }, detail: { ka: 'წითელი', en: 'red' } },
};

/** The real campaign file (read-only); the copy above only if it cannot be read. */
const CAMPAIGN = (() => {
  try {
    return JSON.parse(readFileSync(`${REPO}/server/src/data/medirun-campaign.json`, 'utf8'));
  } catch {
    return CAMPAIGN_FALLBACK;
  }
})();

const KM2_PER_STREET_KM = 0.1;
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const streetKm = (percent, areaKm2) => Math.ceil((Math.max(0, percent) / 100) * areaKm2 / KM2_PER_STREET_KM);

/** Port of grandView({ share, lang, now }) — same rounding, same status windows. */
function grandView({ share, lang = 'ka', now = Date.now(), campaign = CAMPAIGN }) {
  const L = (v) => (lang === 'en' ? v?.en : v?.ka) || v?.ka || '';
  const g = campaign.grand;
  const drop = new Date(g.dropAt);
  const end = new Date(drop.getTime() + g.hours * 3600_000);
  const areaKm2 = campaign.area.km2;
  const percent = Math.max(0, Number(share?.percent) || 0);
  const need = g.minPercent;
  const levels = campaign.levels.map((l) => ({ id: l.id, name: L(l.name), percent: l.percent, reached: percent + 1e-9 >= l.percent, unlocks: L(l.unlocks) }));
  const next = levels.find((l) => !l.reached) || null;
  return {
    campaign: {
      id: campaign.id,
      name: L(campaign.name),
      status: now < drop.getTime() ? 'upcoming' : now < end.getTime() ? 'live' : 'ended',
      dropAt: drop.toISOString(),
      prize: L(g.prize),
      prizeDetail: L(g.detail),
      rulesUrl: campaign.rulesUrl,
    },
    requirement: { areaId: campaign.area.id, city: L({ ka: campaign.area.ka, en: campaign.area.en }), percent: need, areaKm2 },
    me: {
      percent: round(percent),
      paintedKm2: round(Number(share?.paintedKm2) || 0),
      eligible: percent + 1e-9 >= need,
      remainingPercent: round(Math.max(0, need - percent)),
      remainingKm2: round((Math.max(0, need - percent) / 100) * areaKm2),
      remainingStreetKm: streetKm(need - percent, areaKm2),
    },
    levels,
    next: next && { id: next.id, name: next.name, percent: next.percent, remainingStreetKm: streetKm(next.percent - percent, areaKm2) },
  };
}

// ───────────────────────── MEDI QUEST ─────────────────────────

const QUEST_LEVEL_1_20 = [0, 200, 450, 750, 1100, 1500, 1950, 2450, 3000, 3600, 4300, 5100, 6000, 7000, 8100, 9300, 10600, 12000, 13500, 15100];
const RANKS = [
  [4, 'LEVEL_1_4'], [9, 'LEVEL_5_9'], [14, 'LEVEL_10_14'], [19, 'LEVEL_15_19'],
  [29, 'LEVEL_20_29'], [39, 'LEVEL_30_39'], [49, 'LEVEL_40_49'], [Infinity, 'LEVEL_50_PLUS'],
];
const rankKey = (level) => RANKS.find(([max]) => level <= max)[1];
function xpThreshold(level) {
  const n = Math.max(1, Math.floor(level));
  if (n <= 20) return QUEST_LEVEL_1_20[n - 1];
  let xp = QUEST_LEVEL_1_20[19];
  for (let step = 0; step < n - 20; step += 1) xp += 1700 + 100 * step;
  return xp;
}
/** questLevels.getLevelProgress. */
function levelProgress(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  while (xp >= xpThreshold(level + 1)) level += 1;
  const levelStartXp = xpThreshold(level);
  const nextThreshold = xpThreshold(level + 1);
  const span = Math.max(1, nextThreshold - levelStartXp);
  const xpIntoLevel = xp - levelStartXp;
  return {
    level,
    totalXp: xp,
    levelStartXp,
    nextLevelXp: nextThreshold,
    xpIntoLevel,
    xpNeededForNextLevel: nextThreshold - xp,
    progressPercent: Math.min(100, Math.max(0, Math.round((xpIntoLevel / span) * 100))),
    isMaxLevel: false,
    rankKey: rankKey(level),
    currentLevelXp: xpIntoLevel,
  };
}

/** questTemplates.INITIAL_QUEST_TEMPLATES (the four live templates). */
const TEMPLATES = {
  daily_medi: { category: 'MEDI', cadence: 'DAILY', progressType: 'MEDI_DAILY_USE', rewardCoins: 10, rewardXp: 20 },
  daily_steps: { category: 'MOVEMENT', cadence: 'DAILY', progressType: 'STEPS', rewardCoins: 30, rewardXp: 50 },
  daily_hydration: { category: 'HYDRATION', cadence: 'DAILY', progressType: 'HYDRATION_GOAL_PERCENT', rewardCoins: 20, rewardXp: 35 },
  weekly_steps: { category: 'MOVEMENT', cadence: 'WEEKLY', progressType: 'STEPS', rewardCoins: 150, rewardXp: 200 },
};

function questRow(userId, key, periodKey, fields) {
  const tpl = TEMPLATES[key];
  // Movement quests carry Smart Quest metadata; a default target is DEFAULT / NORMAL / DEFAULT_TARGET.
  const smart = tpl.progressType === 'STEPS'
    ? fields.smart ?? { targetSource: 'DEFAULT', difficulty: 'NORMAL', reasonKey: 'DEFAULT_TARGET' }
    : null;
  delete fields.smart;
  return {
    id: uuidFrom(`quest:${userId}:${key}:${periodKey}`),
    key,
    ...tpl,
    titleKey: `quest.${key}.title`,
    descriptionKey: `quest.${key}.description`,
    periodKey,
    completedAt: null,
    claimedAt: null,
    smart,
    ...fields,
  };
}

const progressPercent = (progress, target) => (target > 0 ? Math.min(100, Math.max(0, Math.round((progress / target) * 100))) : 0);

/** questPrivacy.publicQuest. `claimable` = COMPLETED and not yet paid. */
function publicQuest(row) {
  return {
    id: row.id,
    key: row.key,
    category: row.category,
    cadence: row.cadence,
    titleKey: row.titleKey,
    descriptionKey: row.descriptionKey,
    progressType: row.progressType,
    target: row.target,
    progress: row.progress,
    progressPercent: progressPercent(row.progress, row.target),
    status: row.status,
    periodKey: row.periodKey,
    assignedAt: row.assignedAt,
    completedAt: row.completedAt,
    claimedAt: row.claimedAt,
    expiresAt: row.expiresAt,
    rewardCoins: row.rewardCoins,
    rewardXp: row.rewardXp,
    claimable: row.status === 'COMPLETED',
    targetSource: row.smart?.targetSource ?? null,
    difficulty: row.smart?.difficulty ?? null,
    reasonKey: row.smart?.reasonKey ?? null,
  };
}

function questProfile(q) {
  const lp = levelProgress(q.totalXp);
  return {
    level: lp.level,
    rankKey: lp.rankKey,
    totalXp: lp.totalXp,
    coinBalance: q.coins,
    currentStreak: q.currentStreak,
    longestStreak: q.longestStreak,
    levelProgress: lp,
    timezone: q.timezone,
  };
}

function questDashboard(q, today) {
  const week = isoWeekKey(today);
  const live = q.quests.filter((row) => row.status !== 'CANCELLED' && (row.periodKey === today || row.periodKey === week));
  const daily = live.filter((row) => row.cadence === 'DAILY').map(publicQuest);
  const weekly = live.filter((row) => row.cadence === 'WEEKLY').map(publicQuest);
  const done = (x) => x.status === 'COMPLETED' || x.status === 'CLAIMED';
  return {
    profile: questProfile(q),
    daily: { periodKey: today, timezone: q.timezone, quests: daily },
    weekly: { periodKey: week, quests: weekly },
    summary: {
      dailyCompleted: daily.filter(done).length,
      dailyTotal: daily.length,
      dailyClaimable: daily.filter((x) => x.claimable).length,
      weeklyCompleted: weekly.filter(done).length,
      unclaimedRewards: [...daily, ...weekly].filter((x) => x.claimable).length,
    },
  };
}

function validTimezone(tz) {
  if (typeof tz !== 'string' || tz.trim().length < 3 || tz.trim().length > 64) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz.trim() }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ───────────────────────── Home news ─────────────────────────

const NEWS_IMAGE_FILE = `${REPO}/server/public/medirun/img/city-sm.webp`; // 960×536 MEDIRUN night city
let newsImage = null;

function newsCard(today) {
  const start = CAMPAIGN.start || '2026-10-05';
  const endDay = CAMPAIGN.end || '2026-12-31';
  const before = today < start;
  return {
    id: uuidFrom('announcement:medirun-glow-2026'),
    placement: 'home',
    title: before ? '„გაანათე თბილისი“ 5 ოქტომბერს იწყება' : '„გაანათე თბილისი“ უკვე დაიწყო',
    body: 'MEDIRUN-ის ახალი კამპანია: გაისეირნე, გაანათე ქალაქის ქუჩები და იპოვე Medi Coins-ის ყუთები თბილისის პარკებში.',
    details: [
      `კამპანია ${before ? '5 ოქტომბრიდან' : 'ახლა მიმდინარეობს და'} 31 დეკემბრამდე ${before ? 'გაგრძელდება' : 'გრძელდება'}. ყოველი ახალი ქუჩა, რომელსაც MEDIRUN-ით გაივლი, რუკაზე ინთება და თბილისის განათებაში შენს წილს ზრდის.`,
      'სამუშაო დღეებში პარკებში რამდენიმე პატარა ყუთი გამოჩნდება, შაბათ-კვირას — უფრო დიდი. შაბათობით 16:00-ზე ერთ-ერთ პარკში საჩუქრების წვიმაა: 250 და 500 Medi Coins.',
      '7 ნოემბრიდან, ვისაც თბილისის 0,25% აქვს განათებული, შაბათობით ფარნის ყუთებსაც დაინახავს — თითოში 1 500 Medi Coins. 31 დეკემბერს, 12:00-ზე, ვისაც 1% აქვს განათებული, დიდ საჩუქარს დაინახავს: წითელ iPhone 18 Pro Max-ს.',
      'ყუთები მხოლოდ პარკების საზოგადოებრივ ბილიკებზეა. იარე ტროტუარზე, დაიცავი მოძრაობის წესები და ნუ შეხვალ კერძო ტერიტორიაზე. სრული წესები: medicard.ge/medirun',
    ].join('\n\n'),
    badge: 'MEDIRUN',
    tone: 'amber',
    image: `/api/announcements/image/${uuidFrom('announcement-image:medirun-glow-2026')}`,
    cta: { label: 'ნახე შენი პროგრესი', kind: 'route', target: '/run/grand' },
    dismissible: true,
    publishedAt: isoAt(addDays(today, -1), '10:00'),
    endsAt: today <= endDay ? new Date(Date.parse(isoAt(addDays(endDay, 1), '00:00'))).toISOString() : null,
  };
}

// ───────────────────────── Push templates (server defaults, read-only from the repo) ─────────────────────────

let pushDefaults = null;
async function loadPushDefaults() {
  if (pushDefaults) return pushDefaults;
  pushDefaults = (async () => {
    try {
      const engage = await import(pathToFileURL(`${REPO}/server/src/lib/pushEngageTemplates.js`).href);
      const src = readFileSync(`${REPO}/server/src/lib/pushTemplates.js`, 'utf8');
      const grab = (marker, close) => {
        const at = src.indexOf(marker);
        const open = src.indexOf(close === '];' ? '[' : '{', at);
        const end = src.indexOf(`\n${close}`, open);
        if (at < 0 || open < 0 || end < 0) throw new Error(`push template block ${marker} not found`);
        return src.slice(open, end + 2);
      };
      const evaluate = (text) =>
        new Function('PUSH_ENGAGE_TEMPLATE_DEFAULTS', 'PUSH_ENGAGE_TEMPLATE_EN', `return ${text};`)(
          engage.PUSH_ENGAGE_TEMPLATE_DEFAULTS,
          engage.PUSH_ENGAGE_TEMPLATE_EN,
        );
      return {
        defaults: evaluate(grab('export const PUSH_TEMPLATE_DEFAULTS', '];')),
        english: evaluate(grab('export const PUSH_TEMPLATE_EN', '};')),
      };
    } catch (error) {
      console.warn(`[engage] push templates fallback: ${error?.message || error}`);
      return {
        defaults: [
          {
            key: 'medication',
            group: 'med',
            label: '💊 მედიკამენტის მიღების შეხსენება',
            title: '{name}-ის დროა 💊',
            body: 'არ დაგავიწყდეს შენი {name} {dosage} 🤍 Medi შეგახსენებს, რომ საკუთარ თავზე ზრუნვის დროა.',
            placeholders: ['name', 'dosage'],
            sample: { name: 'ასპირინი', dosage: '1 ტაბლეტი' },
          },
        ],
        english: { medication: { title: 'Time for {name} 💊', body: "Don't forget your {name} {dosage} 🤍 Medi is here to remind you it's time to look after yourself." } },
      };
    }
  })();
  return pushDefaults;
}

// ───────────────────────── Open-Meteo stand-in (Tbilisi, early October, clear) ─────────────────────────

const TBILISI = { lat: 41.7151, lng: 44.8271 };
const DAYS = [
  // code, min, max, precip %, uv max
  [0, 12, 23, 0, 4.6],
  [1, 13, 24, 5, 4.4],
  [1, 12, 22, 10, 4.1],
  [2, 11, 20, 20, 3.5],
  [3, 10, 18, 35, 2.8],
  [61, 9, 16, 70, 1.9],
  [1, 10, 19, 15, 3.6],
];
const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;

function openMeteoForecast(today, query = {}) {
  const lat = Number(query.latitude) || TBILISI.lat;
  const lng = Number(query.longitude) || TBILISI.lng;
  const hourly = { time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [], weather_code: [], wind_speed_10m: [], uv_index: [], visibility: [] };
  const daily = { time: [], temperature_2m_min: [], temperature_2m_max: [], precipitation_probability_max: [], weather_code: [], sunrise: [], sunset: [], uv_index_max: [] };
  const tempAt = (d, h) => {
    const [, min, max] = DAYS[d];
    return Math.round(((min + max) / 2 + ((max - min) / 2) * Math.cos(((h - 15) / 24) * 2 * Math.PI)) * 10) / 10;
  };
  DAYS.forEach(([code, min, max, pop, uv], d) => {
    const ymd = addDays(today, d);
    const sunrise = 7 * 60 + 1 + d; // ≈ 07:01, a minute later each day
    const sunset = 18 * 60 + 39 - Math.round(d * 1.5); // ≈ 18:39, earlier each day
    daily.time.push(ymd);
    daily.temperature_2m_min.push(min);
    daily.temperature_2m_max.push(max);
    daily.precipitation_probability_max.push(pop);
    daily.weather_code.push(code);
    daily.sunrise.push(`${ymd}T${hhmm(sunrise)}`);
    daily.sunset.push(`${ymd}T${hhmm(sunset)}`);
    daily.uv_index_max.push(uv);
    for (let h = 0; h < 24; h += 1) {
      const minutes = h * 60;
      const day = minutes >= sunrise && minutes <= sunset;
      const temp = tempAt(d, h);
      hourly.time.push(`${ymd}T${String(h).padStart(2, '0')}:00`);
      hourly.temperature_2m.push(temp);
      hourly.apparent_temperature.push(Math.round((temp - 0.8) * 10) / 10);
      hourly.precipitation_probability.push(code >= 61 ? (h >= 10 && h <= 20 ? pop : Math.round(pop / 2)) : Math.min(pop, (h * 7) % 11));
      hourly.weather_code.push(code === 0 ? (h >= 17 && h <= 19 ? 1 : 0) : code);
      hourly.wind_speed_10m.push(Math.round((6 + 5 * Math.sin(((h - 6) / 24) * 2 * Math.PI) + 2) * 10) / 10);
      hourly.uv_index.push(day ? Math.max(0, Math.round(uv * Math.sin(((minutes - sunrise) / (sunset - sunrise)) * Math.PI) * 100) / 100) : 0);
      hourly.visibility.push(code >= 61 ? 9800 : 24140);
    }
  });
  const clock = tbilisiClock();
  const nowMin = clock.hour * 60 + clock.minute;
  const quarter = Math.floor(clock.minute / 15) * 15;
  const fracHour = clock.hour + clock.minute / 60;
  const temp = tempAt(0, fracHour);
  return {
    latitude: Math.round(lat * 50) / 50,
    longitude: Math.round(lng * 50) / 50,
    generationtime_ms: 0.0849,
    utc_offset_seconds: 14400,
    timezone: 'Asia/Tbilisi',
    timezone_abbreviation: 'GMT+4',
    elevation: 490,
    current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: '°C', apparent_temperature: '°C', weather_code: 'wmo code', precipitation: 'mm', rain: 'mm', wind_speed_10m: 'km/h', wind_gusts_10m: 'km/h', is_day: '' },
    current: {
      time: `${today}T${String(clock.hour).padStart(2, '0')}:${String(quarter).padStart(2, '0')}`,
      interval: 900,
      temperature_2m: temp,
      apparent_temperature: Math.round((temp - 0.8) * 10) / 10,
      weather_code: 0,
      precipitation: 0,
      rain: 0,
      wind_speed_10m: 8.6,
      wind_gusts_10m: 18.4,
      is_day: nowMin >= 7 * 60 + 1 && nowMin <= 18 * 60 + 39 ? 1 : 0,
    },
    hourly_units: { time: 'iso8601', temperature_2m: '°C', apparent_temperature: '°C', precipitation_probability: '%', weather_code: 'wmo code', wind_speed_10m: 'km/h', uv_index: '', visibility: 'm' },
    hourly,
    daily_units: { time: 'iso8601', temperature_2m_min: '°C', temperature_2m_max: '°C', precipitation_probability_max: '%', weather_code: 'wmo code', sunrise: 'iso8601', sunset: 'iso8601', uv_index_max: '' },
    daily,
  };
}

function openMeteoAirQuality(today, query = {}) {
  const lat = Number(query.latitude) || TBILISI.lat;
  const lng = Number(query.longitude) || TBILISI.lng;
  const time = [];
  const aqi = [];
  for (let d = 0; d < 2; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      time.push(`${addDays(today, d)}T${String(h).padStart(2, '0')}:00`);
      // Fair air: worse in the morning and evening traffic peaks.
      aqi.push(Math.round(24 + 9 * Math.exp(-((h - 9) ** 2) / 6) + 11 * Math.exp(-((h - 20) ** 2) / 8)));
    }
  }
  const clock = tbilisiClock();
  return {
    latitude: Math.round(lat * 25) / 25,
    longitude: Math.round(lng * 25) / 25,
    generationtime_ms: 0.112,
    utc_offset_seconds: 14400,
    timezone: 'Asia/Tbilisi',
    timezone_abbreviation: 'GMT+4',
    elevation: 490,
    current_units: { time: 'iso8601', interval: 'seconds', european_aqi: 'EAQI', pm2_5: 'μg/m³', pm10: 'μg/m³', nitrogen_dioxide: 'μg/m³', ozone: 'μg/m³', sulphur_dioxide: 'μg/m³' },
    current: {
      time: `${today}T${String(clock.hour).padStart(2, '0')}:00`,
      interval: 3600,
      european_aqi: aqi[clock.hour],
      pm2_5: 11.2,
      pm10: 21.6,
      nitrogen_dioxide: 17.8,
      ozone: 64,
      sulphur_dioxide: 3.4,
    },
    hourly_units: { time: 'iso8601', european_aqi: 'EAQI' },
    hourly: { time, european_aqi: aqi },
  };
}

// ───────────────────────── seed ─────────────────────────

function seed(state, ctx) {
  const today = ctx.today;
  const userId = state.user?.id || (ctx.persona === 'man' ? 'mock-user-man-0001' : 'mock-user-women-0001');
  const week = isoWeekKey(today);
  const monday = mondayOf(today);
  const quests = [
    // Daily, in assignment order (template priority: medi 5, steps 10, hydration 20). 1 of 3 done.
    questRow(userId, 'daily_medi', today, {
      target: 1,
      progress: 1,
      status: 'CLAIMED',
      assignedAt: pastAt(today, '07:42', 0.2),
      completedAt: pastAt(today, '09:11', 0.5),
      claimedAt: pastAt(today, '09:12', 0.52),
      expiresAt: endOfLocalDay(today),
    }),
    // Kept in line with health.mjs: 6 400 steps today (personalised 8 000 target from a ~7 450 median,
    // smartQuestEngine.resolveDailyMovementTarget) and 1.25 / 2.5 L water = 50 %.
    questRow(userId, 'daily_steps', today, {
      target: 8000,
      progress: 6400,
      status: 'ACTIVE',
      smart: { targetSource: 'PERSONALIZED', difficulty: 'NORMAL', reasonKey: 'PERSONAL_BASELINE' },
      assignedAt: pastAt(today, '07:42', 0.2),
      expiresAt: endOfLocalDay(today),
    }),
    questRow(userId, 'daily_hydration', today, { target: 100, progress: 50, status: 'ACTIVE', assignedAt: pastAt(today, '07:42', 0.2), expiresAt: endOfLocalDay(today) }),
    // Weekly steps mission: 32 205 / 35 000.
    questRow(userId, 'weekly_steps', week, {
      target: 35000,
      progress: 32205,
      status: 'ACTIVE',
      assignedAt: monday === today ? pastAt(today, '07:42', 0.2) : isoAt(monday, '08:03'),
      expiresAt: endOfLocalDay(addDays(monday, 6)),
    }),
  ];
  state.engage = {
    seededFor: today,
    userId,
    // „გაანათე თბილისი“: 0.23 % of Tbilisi lit (spark reached; below the 0.25 % lantern and 1 % grand gate).
    medirun: { percent: 0.42, paintedKm2: round((0.42 / 100) * CAMPAIGN.area.km2) },
    // MEDI QUEST: level 4 (750–1099 XP), 1 240 Medi Coins.
    quest: { timezone: 'Asia/Tbilisi', totalXp: 920, coins: 1240, currentStreak: 3, longestStreak: 11, quests },
    news: { cards: [newsCard(today)], receipts: {} },
    identity: { avatarUrl: null, qrToken: tokenFrom(`qr:${userId}:0`), qrRotations: 0 },
    // Women's space launch gate closed (CommunityConfig.open = false); this person is not a member.
    community: { open: false, member: null },
    coach: { trainerProfile: null, clientLink: null, photos: [] },
  };
}

function patchProfileLocation(state, today) {
  if (LOCATION_MODE === 'off') return;
  const extra = state.healthProfile?.extraAnswers;
  if (!extra || typeof extra !== 'object' || (extra.location && typeof extra.location === 'object')) return;
  const gps = LOCATION_MODE === 'gps';
  extra.locationPrompted = true;
  extra.location = {
    prompted: true,
    enabled: true,
    countryCode: 'GE',
    countryKa: 'საქართველო',
    cityKa: 'თბილისი',
    lat: gps ? TBILISI.lat : null,
    lng: gps ? TBILISI.lng : null,
    accuracy: gps ? 35 : null,
    updatedAt: isoAt(addDays(today, -12), '18:20'),
  };
}

export function init(state, ctx) {
  seed(state, ctx);
  patchProfileLocation(state, ctx.today);
}

// ───────────────────────── routes ─────────────────────────

export const routes = [
  // MEDIRUN — pulseApi('/grand'): Bearer + X-Medicard-Lang, plain JSON (no envelope).
  {
    method: 'GET',
    path: '/api/medipulsi/grand',
    handler: (rq) => unauthorized(rq) || grandView({ share: slice(rq).medirun, lang: en(rq) ? 'en' : 'ka' }),
  },

  // MEDI QUEST
  {
    method: 'GET',
    path: '/api/quests',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const q = slice(rq).quest;
      const tz = rq.query.timezone ? validTimezone(rq.query.timezone) : null;
      if (tz) q.timezone = tz; // setQuestTimezone().catch(() => null): a bad zone is ignored here
      return questDashboard(q, rq.today);
    },
  },
  {
    method: 'GET',
    path: '/api/quests/profile',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const q = slice(rq).quest;
      const p = questProfile(q);
      return {
        profile: {
          userId: slice(rq).userId,
          currentLevel: p.level,
          totalXp: p.totalXp,
          cachedCoinBalance: q.coins,
          coinBalance: q.coins,
          currentStreak: q.currentStreak,
          longestStreak: q.longestStreak,
          lastActiveQuestDate: rq.today,
          level: p.levelProgress,
          levelProgress: p.levelProgress,
          rankKey: p.rankKey,
          timezone: q.timezone,
          updatedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
        },
      };
    },
  },
  {
    method: 'PUT',
    path: '/api/quests/timezone',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const raw = rq.body?.timezone;
      if (typeof raw !== 'string' || raw.trim().length < 3 || raw.trim().length > 64) {
        return rq.reply(400, {
          error: t(rq, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'),
          fields: [{ field: 'timezone', message: t(rq, 'არასწორი მნიშვნელობა.', 'Invalid value.') }],
        });
      }
      const tz = validTimezone(raw);
      if (!tz) return rq.reply(400, { error: t(rq, 'არასწორი დროის სარტყელი.', 'არასწორი დროის სარტყელი.') });
      slice(rq).quest.timezone = tz;
      return { ok: true, timezone: tz };
    },
  },
  {
    method: 'POST',
    path: '/api/quests/:id/claim',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      if (!UUID_RE.test(rq.params.id)) {
        return rq.reply(400, {
          error: t(rq, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'),
          fields: [{ field: 'id', message: t(rq, 'არასწორი მნიშვნელობა.', 'Invalid value.') }],
        });
      }
      const q = slice(rq).quest;
      const row = q.quests.find((x) => x.id === rq.params.id);
      if (!row) return rq.reply(404, { error: t(rq, 'ქვესტი ვერ მოიძებნა.', 'Quest not found.') });
      const previousLevel = levelProgress(q.totalXp).level;
      let claimed = false;
      let reward = { coinsAwarded: 0, xpAwarded: 0 };
      if (row.status === 'CANCELLED' || row.status === 'EXPIRED') return rq.reply(409, { error: t(rq, 'ქვესტის ვადა ამოიწურა.', 'ქვესტის ვადა ამოიწურა.') });
      if (row.status !== 'CLAIMED') {
        if (row.status === 'ACTIVE') {
          if (row.progress < row.target) return rq.reply(400, { error: t(rq, 'ქვესტი ჯერ არ დასრულებულა.', 'ქვესტი ჯერ არ დასრულებულა.') });
          row.completedAt = new Date().toISOString();
        }
        row.completedAt ||= new Date().toISOString();
        q.totalXp += row.rewardXp;
        q.coins += row.rewardCoins;
        row.status = 'CLAIMED';
        row.claimedAt = new Date().toISOString();
        claimed = true;
        reward = { coinsAwarded: row.rewardCoins, xpAwarded: row.rewardXp };
      }
      const lp = levelProgress(q.totalXp);
      return {
        ok: true,
        claimed,
        alreadyClaimed: !claimed,
        quest: { id: row.id, key: row.key, status: row.status, completedAt: row.completedAt, claimedAt: row.claimedAt },
        reward,
        profile: {
          coinBalance: q.coins,
          totalXp: lp.totalXp,
          previousLevel,
          currentLevel: lp.level,
          leveledUp: lp.level > previousLevel,
          levelProgress: lp,
          currentStreak: q.currentStreak,
          longestStreak: q.longestStreak,
          timezone: q.timezone,
          rankKey: lp.rankKey,
        },
      };
    },
  },

  // Home news („სიახლეები“). Image first: it is public and two segments deep.
  {
    method: 'GET',
    path: '/api/announcements/image/:id',
    handler: (rq) => {
      if (rq.params.id !== uuidFrom('announcement-image:medirun-glow-2026')) {
        return rq.reply(404, { error: t(rq, 'სურათი ვერ მოიძებნა.', 'Image not found.') });
      }
      try {
        newsImage ??= readFileSync(NEWS_IMAGE_FILE);
      } catch {
        return rq.reply(404, { error: t(rq, 'სურათი ვერ მოიძებნა.', 'Image not found.') });
      }
      return rq.reply(200, newsImage, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    },
  },
  {
    method: 'GET',
    path: '/api/announcements',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const placement = rq.query.placement === 'home' || !rq.query.placement ? 'home' : null;
      if (!placement) return { announcements: [] };
      const news = slice(rq).news;
      const now = Date.now();
      return {
        announcements: news.cards
          .filter((card) => !news.receipts[card.id]?.dismissedAt)
          .filter((card) => !card.endsAt || Date.parse(card.endsAt) > now)
          .slice(0, 5),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/announcements/:id',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      // A dismissed card still opens from its detail link (publishedCard ignores receipts).
      const card = slice(rq).news.cards.find((c) => c.id === rq.params.id);
      if (!card) return rq.reply(404, { error: t(rq, 'ეს სიახლე აღარ არის აქტიური.', 'This news item is no longer available.'), code: 'ANNOUNCEMENT_GONE' });
      return { announcement: card };
    },
  },
  {
    method: 'POST',
    path: '/api/announcements/:id/events',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const type = rq.body?.type;
      if (!['view', 'click', 'dismiss'].includes(type)) {
        return rq.reply(400, {
          error: t(rq, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'),
          fields: [{ field: 'type', message: t(rq, 'არასწორი მნიშვნელობა.', 'Invalid value.') }],
        });
      }
      const news = slice(rq).news;
      if (!news.cards.some((c) => c.id === rq.params.id)) return rq.reply(404, { ok: false });
      const column = { view: 'seenAt', click: 'clickedAt', dismiss: 'dismissedAt' }[type];
      const receipt = (news.receipts[rq.params.id] ||= {});
      receipt[column] ||= new Date().toISOString();
      return { ok: true };
    },
  },

  // MEDI COACH — a normal client: no trainer profile, no link (Home section hidden; Profile shows the QR card).
  {
    method: 'GET',
    path: '/api/trainer/me',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const coach = slice(rq).coach;
      return { trainerProfile: coach.trainerProfile, clientLink: coach.clientLink, consentVersion: 'coach-2026-09-28b' };
    },
  },
  { method: 'GET', path: '/api/trainer/photos', handler: (rq) => unauthorized(rq) || { photos: slice(rq).coach.photos } },
  { method: 'GET', path: '/api/trainer/overview', handler: (rq) => unauthorized(rq) || { link: null } },

  // Women's space launch gate — closed, not a member → entry hidden (canJoin false).
  {
    method: 'GET',
    path: '/api/community/membership',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const user = userOf(rq);
      if (user.gender !== 'FEMALE' || (user.status && user.status !== 'ACTIVE')) {
        return rq.reply(403, { error: t(rq, 'ეს სივრცე ქალებისთვისაა. გადაამოწმე ანგარიშის პროფილი.', 'This space is for women. Please check your account profile.') });
      }
      const c = slice(rq).community;
      const avatarId = rq.state.healthProfile?.extraAnswers?.avatarId;
      return {
        open: c.open,
        canJoin: c.open === true || !!c.member,
        member: c.member
          ? { ...c.member, profile: { name: user.fullName, avatarId: /^avatar-(?:[1-9]|1[0-2])$/.test(avatarId || '') ? avatarId : null } }
          : null,
        rulesVersion: '2026-09-23',
      };
    },
  },

  // Identity: no photo avatar; personal QR is a random renewable token, never the user id.
  { method: 'GET', path: '/api/identity/avatar/me', handler: (rq) => unauthorized(rq) || { avatarUrl: slice(rq).identity.avatarUrl } },
  {
    method: 'GET',
    path: '/api/identity/qr/me',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const token = slice(rq).identity.qrToken;
      return { token, link: `https://medicard.ge/u/${token}` };
    },
  },
  {
    method: 'POST',
    path: '/api/identity/qr/rotate',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const identity = slice(rq).identity;
      identity.qrRotations += 1;
      identity.qrToken = tokenFrom(`qr:${slice(rq).userId}:${identity.qrRotations}`);
      return { token: identity.qrToken, link: `https://medicard.ge/u/${identity.qrToken}` };
    },
  },

  // Push copy (loadPushTemplates runs after sign-in on web too). Code defaults, no admin overrides.
  {
    method: 'GET',
    path: '/api/push/templates',
    handler: async (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const { defaults, english } = await loadPushDefaults();
      return {
        templates: defaults.map((def) => {
          const eng = en(rq) ? english[def.key] : null;
          if (eng) return { ...def, title: eng.title, body: eng.body, custom: false, safetyOverride: false, updatedAt: null };
          return { ...def, custom: false, safetyOverride: false, updatedAt: null };
        }),
      };
    },
  },

  // Open-Meteo stand-ins (the app fetches api.open-meteo.com / air-quality-api.open-meteo.com itself).
  { method: 'GET', path: '/__ext/open-meteo/forecast', handler: (rq) => openMeteoForecast(rq.today, rq.query) },
  { method: 'GET', path: '/__ext/open-meteo/air-quality', handler: (rq) => openMeteoAirQuality(rq.today, rq.query) },
];

// Playwright interception for the weather host (ENGAGE_LOCATION=gps), e.g. in shoot.mjs:
//   await context.route(/open-meteo\.com\//, async (route) => {
//     const u = new URL(route.request().url());
//     const kind = u.hostname.startsWith('air-quality') ? 'air-quality' : 'forecast';
//     const r = await fetch(`${API}/__ext/open-meteo/${kind}${u.search}`);
//     await route.fulfill({ status: r.status, contentType: 'application/json',
//       headers: { 'access-control-allow-origin': '*' }, body: await r.text() });
//   });
