/**
 * Module kill switches — let an admin pause a costly or misbehaving feature
 * without a deploy. Stored in an additive raw-SQL table ("FeatureFlag"),
 * created lazily. A missing table or row means ENABLED, so nothing changes
 * until an admin turns something off. Reads are cached for 15 s.
 */
import { prisma } from './prisma.js';

export const FEATURES = Object.freeze([
  {
    key: 'medi',
    label: 'Medi (AI ასისტენტი)',
    description: 'Medi-ს საუბარი, ექიმთან რეჟიმი, ღრმა ანალიზი, სიმპტომები, ლაბორატორია, კანი და გამოსახულებები.',
    defaultMessage: 'Medi დროებით მიუწვდომელია. ცოტა ხანში ისევ ჩაირთვება.',
  },
  {
    key: 'mediVet',
    label: 'Medi Vet (ცხოველების AI)',
    description: 'ცხოველების AI საუბარი. ცხოველების პროფილები და მოვლა მუშაობას აგრძელებს.',
    defaultMessage: 'Medi Vet დროებით მიუწვდომელია.',
  },
  {
    key: 'nutritionAi',
    label: 'კვების AI შეფასება',
    description: 'ფოტოდან, ეტიკეტიდან და აღწერიდან კალორიის შეფასება. ხელით აღრიცხვა და ძებნა რჩება.',
    defaultMessage: 'AI შეფასება დროებით გამორთულია — კვება ხელით ან ძებნით დაამატე.',
  },
  {
    key: 'rewardsStore',
    label: 'ჯილდოების გაცვლა',
    description: 'Medi Coins-ის ჯილდოებზე გაცვლა. ქულების დაგროვება გრძელდება.',
    defaultMessage: 'ჯილდოების გაცვლა დროებით შეჩერებულია. შენი Medi Coins შენახულია.',
  },
  {
    key: 'referralRewards',
    label: 'მოწვევის ჯილდოები',
    description: 'მეგობრის მოწვევისთვის 100 coin-ის ავტომატური დარიცხვა. კოდის შეყვანა გრძელდება, დარიცხვა ჩაირთვება ხელახლა ჩართვისას.',
    defaultMessage: 'მოწვევის ჯილდოები დროებით შეჩერებულია.',
  },
  {
    key: 'email',
    label: 'ელფოსტა (ყველა წერილი)',
    description: 'ყველა გამავალი წერილი: მისალმება, პაროლის აღდგენა, ანგარიშის წაშლა და კამპანიები. გამორთვისას პაროლის აღდგენა შეცდომას აჩვენებს.',
    defaultMessage: 'ელფოსტის გაგზავნა დროებით შეჩერებულია.',
  },
]);

const KEYS = new Set(FEATURES.map((f) => f.key));
const TTL_MS = 15_000;
let cache = { at: 0, rows: null };
let ensured = false;

async function ensureTable(db = prisma) {
  if (ensured) return;
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    "key" TEXT PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT
  )`);
  ensured = true;
}

async function readRows(db = prisma) {
  if (cache.rows && Date.now() - cache.at < TTL_MS) return cache.rows;
  try {
    await ensureTable(db);
    const rows = await db.$queryRaw`SELECT "key", "enabled", "message", "updatedAt", "updatedBy" FROM "FeatureFlag"`;
    cache = { at: Date.now(), rows };
    return rows;
  } catch (error) {
    console.warn('[feature-flags] read failed — treating all features as enabled', error?.message);
    return [];
  }
}

/** Full list for the admin console (definition + current state). */
export async function listFeatureFlags(db = prisma) {
  const rows = await readRows(db);
  return FEATURES.map((f) => {
    const row = rows.find((r) => r.key === f.key);
    return {
      ...f,
      enabled: row ? row.enabled !== false : true,
      message: row?.message || f.defaultMessage,
      updatedAt: row?.updatedAt || null,
      updatedBy: row?.updatedBy || null,
    };
  });
}

/** { medi: true, … } for clients (/api/app/status). */
export async function publicFeatureFlags(db = prisma) {
  const list = await listFeatureFlags(db);
  return Object.fromEntries(list.map((f) => [f.key, f.enabled]));
}

export async function isFeatureEnabled(key, db = prisma) {
  if (!KEYS.has(key)) return true;
  const rows = await readRows(db);
  const row = rows.find((r) => r.key === key);
  return row ? row.enabled !== false : true;
}

export async function setFeatureFlag(key, { enabled, message }, { admin, db = prisma } = {}) {
  if (!KEYS.has(key)) {
    const error = new Error('უცნობი მოდული.');
    error.status = 404;
    throw error;
  }
  await ensureTable(db);
  const text = message == null ? null : String(message).trim().slice(0, 240) || null;
  await db.$executeRaw`INSERT INTO "FeatureFlag" ("key", "enabled", "message", "updatedAt", "updatedBy")
    VALUES (${key}, ${Boolean(enabled)}, ${text}, CURRENT_TIMESTAMP, ${admin?.email || null})
    ON CONFLICT ("key") DO UPDATE SET "enabled" = EXCLUDED."enabled", "message" = EXCLUDED."message",
      "updatedAt" = CURRENT_TIMESTAMP, "updatedBy" = EXCLUDED."updatedBy"`;
  cache = { at: 0, rows: null };
  return (await listFeatureFlags(db)).find((f) => f.key === key);
}

/**
 * Express middleware: refuses writes (POST/PUT/PATCH) to a paused feature with
 * 503 FEATURE_DISABLED and the admin's message. Reads keep working so people
 * can still see their history. `match` narrows it to specific paths.
 */
export function requireFeature(key, { match } = {}) {
  return async (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (match && !match(req)) return next();
    try {
      if (await isFeatureEnabled(key)) return next();
      const flag = (await listFeatureFlags()).find((f) => f.key === key);
      return res.status(503).json({ error: flag?.message || 'ფუნქცია დროებით მიუწვდომელია.', code: 'FEATURE_DISABLED', feature: key });
    } catch {
      return next();
    }
  };
}

export function resetFeatureFlagCacheForTests() {
  cache = { at: 0, rows: null };
  ensured = false;
}
