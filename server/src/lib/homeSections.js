/**
 * Home sections under admin control (owner 2026-10-13: „ნებისმიერ მთავარ გვერდზე რა გამოჩნდეს და რა დაიმალოს,
 * რეალურ რეჟიმში“). Per Home layout the admin can hide sections and change their order; the app reads it from
 * /api/app/status (`home`) and gets an `app:config` socket event the moment it changes.
 *
 * The section ids and default orders mirror mobile/src/lib/home/homeSectionOrder.ts (homeSections.test.js checks
 * it). A layout with no row uses the app's own default. Locked sections (the greeting header, the disclaimer) can
 * neither be hidden nor moved. Module switches (#/features) still hide a paused module's sections on top of this.
 * One row, raw SQL (install-home-sections.mjs; also created lazily).
 */
import { prisma } from './prisma.js';

export const HOME_LAYOUTS = ['women', 'active', 'weight', 'standard'];

export const HOME_LAYOUT_LABELS = {
  women: 'ქალის',
  active: 'აქტიური',
  weight: 'წონა და კვება',
  standard: 'სტანდარტული',
};

/** The app's default order per layout (same as HOME_LAYOUT_ORDER in the app). */
export const HOME_DEFAULT_ORDER = {
  standard: ['dashboard', 'hero', 'ask', 'nextDose', 'attention', 'coach', 'cycle', 'week', 'sleep', 'horoscope', 'challenges', 'checkup', 'news', 'nutrition', 'profileNudge', 'customize', 'disclaimer'],
  women: ['dashboard', 'cycleHero', 'ask', 'nextDose', 'attention', 'coach', 'cycleAhead', 'community', 'cycleTips', 'dayPair', 'nutritionLite', 'sleep', 'horoscope', 'womenCare', 'news', 'cycleStats', 'profileNudge', 'customize', 'disclaimer'],
  active: ['dashboard', 'moveHero', 'ask', 'nextDose', 'attention', 'coach', 'waterOutdoor', 'sleep', 'horoscope', 'medirun', 'quest', 'cycle', 'news', 'nutritionLite', 'profileNudge', 'customize', 'disclaimer'],
  weight: ['dashboard', 'energy', 'quickLog', 'ask', 'nextDose', 'attention', 'coach', 'weightProgress', 'meals', 'waterSteps', 'sleep', 'horoscope', 'cycle', 'news', 'nutritionTools', 'profileNudge', 'customize', 'disclaimer'],
};

/**
 * Recommended orders after MEDISLEEP + MEDIHOROSCOPE (analysis 2026-10-13): each layout's own core stays in the
 * first two screens, sleep follows the core, the horoscope (entertainment) moves below the health blocks, news
 * leaves the top. One click in the admin applies it; nothing is applied automatically.
 */
export const HOME_RECOMMENDED_ORDER = {
  standard: ['dashboard', 'hero', 'ask', 'nextDose', 'attention', 'coach', 'cycle', 'week', 'challenges', 'checkup', 'sleep', 'nutrition', 'news', 'horoscope', 'profileNudge', 'customize', 'disclaimer'],
  women: ['dashboard', 'cycleHero', 'ask', 'nextDose', 'attention', 'coach', 'cycleAhead', 'community', 'cycleTips', 'dayPair', 'sleep', 'nutritionLite', 'womenCare', 'horoscope', 'news', 'cycleStats', 'profileNudge', 'customize', 'disclaimer'],
  active: ['dashboard', 'moveHero', 'ask', 'nextDose', 'attention', 'coach', 'medirun', 'waterOutdoor', 'quest', 'sleep', 'cycle', 'nutritionLite', 'news', 'horoscope', 'profileNudge', 'customize', 'disclaimer'],
  weight: ['dashboard', 'energy', 'quickLog', 'ask', 'nextDose', 'attention', 'coach', 'weightProgress', 'meals', 'waterSteps', 'sleep', 'cycle', 'nutritionTools', 'news', 'horoscope', 'profileNudge', 'customize', 'disclaimer'],
};

/** Never hidden or moved: the greeting header opens every Home, the disclaimer closes it. */
export const HOME_LOCKED = new Set(['dashboard', 'disclaimer']);

/**
 * Admin labels. `module` = the module colour/name in the admin (null = core), `size` = how tall it is on a phone
 * (s ≈ one row, m ≈ a card, l ≈ a hero), `feature` = the module switch that also hides it.
 */
export const HOME_SECTIONS = {
  dashboard: { label: 'მისალმება და თარიღი', hint: 'გვერდის თავი: სახელი, თარიღი, მოდულების ღილაკი', size: 's', module: null },
  hero: { label: '„დღეს“', hint: 'ერთი პასუხი დღისთვის, რგოლები და სწრაფი ღილაკები', size: 'l', module: null },
  ask: { label: 'ჰკითხე Medi-ს', hint: 'Medi-ს ველი და მზა კითხვები', size: 's', module: 'medi', feature: 'medi' },
  nextDose: { label: 'შემდეგი მიღება', hint: 'დღევანდელი დოზები; დოზის გარეშე არ ჩანს', size: 'm', module: 'pill', feature: 'medications' },
  attention: { label: 'არ გამოგრჩეს', hint: 'ვიზიტი 7 დღეში, ანალიზი 14 დღეში, ბავშვის აცრა', size: 's', module: null },
  coach: { label: 'ტრენერი', hint: 'მხოლოდ ტრენერთან დაკავშირებულს', size: 'm', module: 'coach', feature: 'coach' },
  cycle: { label: 'ქალის ჯანმრთელობა', hint: 'ციკლის მოკლე ბარათი (მხოლოდ ქალებს)', size: 'm', module: 'cycle', feature: 'cycle' },
  week: { label: 'შენი კვირა', hint: 'ნაბიჯები 7 დღეში', size: 'm', module: null, feature: 'steps' },
  sleep: { label: 'MEDISLEEP', hint: 'დაწოლის დრო ან წუხანდელი ღამე', size: 's', module: 'sleep', feature: 'sleep' },
  horoscope: { label: 'MEDIHOROSCOPE', hint: 'დღის ჰოროსკოპი შენი ნიშნისთვის', size: 's', module: 'horo', feature: 'horoscope' },
  challenges: { label: 'გამოწვევები', hint: 'MEDIRUN და MEDIQUEST ერთ რიგში', size: 'm', module: 'run' },
  checkup: { label: 'MEDISCAN და სიმპტომები', hint: 'გადაიღე ან ატვირთე, სად გტკივა?', size: 'l', module: 'scan' },
  news: { label: 'სიახლეები', hint: 'ადმინის სიახლეების ბარათები (#/news)', size: 'l', module: null, feature: 'news' },
  nutrition: { label: 'MEDIFOOD', hint: 'კალორიები და წონა', size: 'm', module: 'food', feature: 'nutrition' },
  profileNudge: { label: 'დაასრულე პროფილი', hint: 'ქრება, როცა პროფილი სრულია', size: 'm', module: null },
  customize: { label: 'მთავარი გვერდის მორგება', hint: 'გვერდის ვარიანტის შეცვლა', size: 's', module: null, feature: 'homeLayouts' },
  disclaimer: { label: 'MEDICARD ექიმს არ ცვლის', hint: 'სამართლებრივი შენიშვნა, 112', size: 's', module: null },
  cycleHero: { label: 'ციკლი დღეს', hint: 'კვირის ზოლი, ციკლის ტალღა, მოქმედებები', size: 'l', module: 'cycle', feature: 'cycle' },
  cycleAhead: { label: 'წინ რა გელის', hint: 'მენსტრუაცია, ნაყოფიერი დღეები, ოვულაცია', size: 'm', module: 'cycle', feature: 'cycle' },
  community: { label: 'ქალების სივრცე', hint: 'ბოლო პოსტები', size: 'm', module: 'cycle', feature: 'community' },
  cycleTips: { label: 'დღეს შენთვის', hint: 'ფაზის რჩევები', size: 'm', module: 'cycle', feature: 'cycle' },
  dayPair: { label: 'შენი დღე', hint: 'ნაბიჯები და წყალი გვერდიგვერდ', size: 'm', module: null },
  nutritionLite: { label: 'MEDIFOOD (მოკლედ)', hint: 'კალორიები და წონა ერთ რიგში', size: 's', module: 'food', feature: 'nutrition' },
  womenCare: { label: 'MEDISCAN და სიმპტომები', hint: 'ქალის გვერდზე', size: 'l', module: 'scan' },
  cycleStats: { label: 'ჩემი ციკლი', hint: 'ციკლის სიგრძე და ციფრები', size: 'm', module: 'cycle', feature: 'cycle' },
  moveHero: { label: 'დღევანდელი მოძრაობა', hint: 'ნაბიჯების რგოლი და 7 დღე', size: 'l', module: null, feature: 'steps' },
  waterOutdoor: { label: 'წყალი და გარეთ', hint: 'წყალი და საუკეთესო დრო გარეთ', size: 'm', module: null },
  medirun: { label: 'MEDIRUN', hint: 'კვირის გასეირნებები და თბილისის პროგრესი', size: 'l', module: 'run', feature: 'medirun' },
  quest: { label: 'MEDIQUEST', hint: 'მონეტები, დონე და მისიები', size: 'm', module: 'quest', feature: 'quest' },
  energy: { label: 'დღის ბიუჯეტი', hint: 'კალორიების რგოლი და მაკროები', size: 'l', module: 'food', feature: 'nutrition' },
  quickLog: { label: 'ჩაწერე კვება', hint: 'ძიება, ფოტო, ხმა', size: 's', module: 'food', feature: 'nutrition' },
  weightProgress: { label: 'წონა და მიზანი', hint: 'ბოლო აწონვა და გზა მიზნამდე', size: 'm', module: null, feature: 'weight' },
  meals: { label: 'დღის კვება', hint: 'დღევანდელი ჭამები', size: 'm', module: 'food', feature: 'nutrition' },
  waterSteps: { label: 'წყალი და ნაბიჯები', hint: 'ორი ფილა გვერდიგვერდ', size: 'm', module: null },
  nutritionTools: { label: 'კვების ხელსაწყოები', hint: 'რაციონი, პროგრესი, რეცეპტები', size: 'm', module: 'food', feature: 'nutrition' },
};

export const HOME_SECTIONS_SQL = `CREATE TABLE IF NOT EXISTS "HomeSectionConfig" (
  "id" TEXT PRIMARY KEY,
  "config" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT
)`;

const TTL_MS = 15_000;
let cache = { at: 0, row: null };
let ensured = false;
const EMPTY = { config: { layouts: {} }, version: 0, updatedAt: null, updatedBy: null };

async function ensureTable(db) {
  if (ensured) return;
  await db.$executeRawUnsafe(HOME_SECTIONS_SQL);
  ensured = true;
}

/**
 * Keeps only what the app can use: known layouts, ids of that layout, locked sections in place.
 * `order` = the full order (missing ids are put back at their default place); `hidden` = ids not to show.
 * A layout equal to its default is dropped, so „ნაგულისხმევი“ really is no row.
 */
export function sanitizeHomeConfig(input) {
  const layouts = {};
  const src = input && typeof input === 'object' && input.layouts && typeof input.layouts === 'object' ? input.layouts : {};
  for (const layout of HOME_LAYOUTS) {
    const raw = src[layout];
    if (!raw || typeof raw !== 'object') continue;
    const known = HOME_DEFAULT_ORDER[layout];
    const hidden = [...new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter((id) => known.includes(id) && !HOME_LOCKED.has(id)))];
    let order = Array.isArray(raw.order) ? mergeOrder(known, raw.order) : null;
    if (order && order.every((id, i) => id === known[i])) order = null;
    const out = {};
    if (order) out.order = order;
    if (hidden.length) out.hidden = hidden.sort((a, b) => known.indexOf(a) - known.indexOf(b));
    if (Object.keys(out).length) layouts[layout] = out;
  }
  return { layouts };
}

/**
 * The admin's order over the defaults: its known ids first (no duplicates), every default id it lacks put back
 * after its nearest default predecessor; the greeting stays first and the disclaimer last. Same rule as the app.
 */
export function mergeOrder(defaults, custom) {
  const seen = new Set();
  const order = [];
  for (const id of custom) {
    if (defaults.includes(id) && !seen.has(id) && !HOME_LOCKED.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  defaults.forEach((id, i) => {
    if (seen.has(id) || HOME_LOCKED.has(id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(defaults[j]);
      if (k >= 0) { at = k + 1; break; }
    }
    order.splice(at, 0, id);
    seen.add(id);
  });
  const head = defaults.filter((id) => HOME_LOCKED.has(id) && defaults.indexOf(id) === 0);
  const tail = defaults.filter((id) => HOME_LOCKED.has(id) && defaults.indexOf(id) !== 0);
  return [...head, ...order, ...tail];
}

/** The current config (cached 15 s); never throws — a broken table means „app defaults“. */
export async function getHomeConfig(db = prisma) {
  if (cache.row && Date.now() - cache.at < TTL_MS) return cache.row;
  try {
    await ensureTable(db);
    const rows = await db.$queryRaw`SELECT "config", "version", "updatedAt", "updatedBy" FROM "HomeSectionConfig" WHERE "id" = 'default'`;
    const row = rows[0] ? { config: sanitizeHomeConfig(rows[0].config), version: Number(rows[0].version) || 0, updatedAt: rows[0].updatedAt, updatedBy: rows[0].updatedBy } : EMPTY;
    cache = { at: Date.now(), row };
    return row;
  } catch {
    return EMPTY;
  }
}

/** What every client gets in /api/app/status: only the changed layouts, plus a version to notice a change. */
export function publicHomeConfig(row) {
  return { v: row?.version || 0, layouts: row?.config?.layouts || {} };
}

/** Saves one layout (or all of them) and returns the new row; the caller audits and broadcasts. */
export async function saveHomeLayout({ layout, order, hidden, reset = false }, adminId, db = prisma) {
  if (!HOME_LAYOUTS.includes(layout)) throw Object.assign(new Error('უცნობი გვერდის ვარიანტი.'), { status: 400 });
  await ensureTable(db);
  const current = await getHomeConfig(db);
  const layouts = { ...current.config.layouts };
  if (reset) delete layouts[layout];
  else layouts[layout] = { order: order ?? layouts[layout]?.order ?? null, hidden: hidden ?? layouts[layout]?.hidden ?? [] };
  const config = sanitizeHomeConfig({ layouts });
  const rows = await db.$queryRaw`
    INSERT INTO "HomeSectionConfig" ("id", "config", "version", "updatedAt", "updatedBy")
    VALUES ('default', ${JSON.stringify(config)}::jsonb, 1, NOW(), ${adminId ?? null})
    ON CONFLICT ("id") DO UPDATE SET "config" = EXCLUDED."config", "version" = "HomeSectionConfig"."version" + 1,
      "updatedAt" = NOW(), "updatedBy" = EXCLUDED."updatedBy"
    RETURNING "config", "version", "updatedAt", "updatedBy"`;
  cache = { at: 0, row: null };
  const r = rows[0];
  return { config: sanitizeHomeConfig(r.config), version: Number(r.version) || 0, updatedAt: r.updatedAt, updatedBy: r.updatedBy };
}

/** How many people chose each layout (an explicit choice; everyone else sees their default). */
export async function homeLayoutCounts(db = prisma) {
  try {
    const rows = await db.$queryRaw`
      SELECT COALESCE(hp."extraAnswers"->>'homeLayout', '') AS layout, COUNT(*)::int AS n
      FROM "HealthProfile" hp JOIN "User" u ON u."id" = hp."userId"
      WHERE u."email" NOT LIKE '%@medicard.ge' OR u."email" IS NULL
      GROUP BY 1`;
    const out = { women: 0, active: 0, weight: 0, standard: 0, unset: 0 };
    for (const r of rows) {
      if (HOME_LAYOUTS.includes(r.layout)) out[r.layout] += r.n;
      else out.unset += r.n;
    }
    return out;
  } catch {
    return null;
  }
}
