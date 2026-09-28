/**
 * Module kill switches — let an admin pause a module or a costly feature
 * without a deploy or an app build. Stored in an additive raw-SQL table
 * ("FeatureFlag"), created lazily. A missing table or row means ENABLED, so
 * nothing changes until an admin turns something off. Reads are cached for 15 s.
 *
 * Two layers act on a paused key:
 *   - server: `requireFeature` answers writes with 503 FEATURE_DISABLED and the
 *     admin's message — every app build shows that message, old ones included;
 *   - app (1.0.0.16.2+): reads `features` from /api/app/status and hides the
 *     module's entries and screens altogether.
 */
import { prisma } from './prisma.js';

/**
 * `group`: module = a whole product area, ai = one AI feature, system = background
 * behaviour with no screen of its own.
 * `parent`: a child is effectively off while its parent is off (pets → Medi Vet).
 */
export const FEATURES = Object.freeze([
  {
    key: 'cycle',
    group: 'module',
    label: 'ციკლი და ორსულობა',
    description: 'ციკლის კალენდარი, სიმპტომები, ორსულობის კვირები, მშობიარობის შემდგომი პერიოდი და პერიმენოპაუზა. ახალი ჩანაწერი ვერ ემატება; ახალ ვერსიაში მოდული საერთოდ იმალება.',
    defaultMessage: 'ციკლის მოდული დროებით შეჩერებულია. შენი ჩანაწერები შენახულია.',
  },
  {
    key: 'nutrition',
    group: 'module',
    label: 'კვების დღიური',
    description: 'კვების დღიური, პროგრამა, რეცეპტები, მარხვის ტაიმერი და გაზომვები. ახალი ჩანაწერი ვერ ემატება.',
    defaultMessage: 'კვების დღიური დროებით შეჩერებულია. შენი ჩანაწერები შენახულია.',
  },
  {
    key: 'nutritionAi',
    group: 'ai',
    parent: 'nutrition',
    label: 'კვების AI შეფასება',
    description: 'ფოტოდან, ეტიკეტიდან და აღწერიდან კალორიის შეფასება. ხელით აღრიცხვა და ძებნა რჩება.',
    defaultMessage: 'AI შეფასება დროებით გამორთულია — კვება ხელით ან ძებნით დაამატე.',
  },
  {
    key: 'medi',
    group: 'ai',
    label: 'Medi (AI ასისტენტი)',
    description: 'Medi-ს საუბარი, ექიმთან რეჟიმი, ღრმა ანალიზი, სიმპტომები, ლაბორატორია, კანი და გამოსახულებები.',
    defaultMessage: 'Medi დროებით მიუწვდომელია. ცოტა ხანში ისევ ჩაირთვება.',
  },
  {
    key: 'pets',
    group: 'module',
    label: 'ჩემი ცხოველები',
    description: 'ცხოველების პროფილები, მოვლა, წონა, ალერგიები და Medi Vet. ცვლილებები ჩერდება.',
    defaultMessage: 'ცხოველების მოდული დროებით შეჩერებულია. შენი მონაცემები შენახულია.',
  },
  {
    key: 'mediVet',
    group: 'ai',
    parent: 'pets',
    label: 'Medi Vet (ცხოველების AI)',
    description: 'ცხოველების AI საუბარი. ცხოველების პროფილები და მოვლა მუშაობას აგრძელებს.',
    defaultMessage: 'Medi Vet დროებით მიუწვდომელია.',
  },
  {
    key: 'medirun',
    group: 'module',
    label: 'MEDIRUN',
    description: 'გასეირნება-აღმოჩენის თამაში რუკაზე. ყურადღება: გამორთვის მომენტში დაწყებული სირბილი ვეღარ შეინახება.',
    defaultMessage: 'MEDIRUN დროებით შეჩერებულია. ცოტა ხანში დავბრუნდებით.',
  },
  {
    key: 'quest',
    group: 'module',
    label: 'MEDI QUEST',
    description: 'მისიები, პროგრესი, Medi Coins-ის აღება და ჯილდოები. მისიების დასრულება და coin-ის აღება ჩერდება.',
    defaultMessage: 'MEDI QUEST დროებით შეჩერებულია. შენი coin-ები და პროგრესი შენახულია.',
  },
  {
    key: 'rewardsStore',
    group: 'ai',
    parent: 'quest',
    label: 'ჯილდოების გაცვლა',
    description: 'Medi Coins-ის ჯილდოებზე გაცვლა. ქულების დაგროვება გრძელდება.',
    defaultMessage: 'ჯილდოების გაცვლა დროებით შეჩერებულია. შენი Medi Coins შენახულია.',
  },
  {
    key: 'coach',
    group: 'module',
    label: 'MEDI COACH (ფიტნეს ტრენერები)',
    description: 'ტრენერის განაცხადი, კლიენტის დაკავშირება, ვარჯიშების დანიშვნა, კვების გეგმა და პროგრეს-ფოტოები. ნახვა რჩება, ცვლილებები ჩერდება.',
    defaultMessage: 'ტრენერის ფუნქცია დროებით შეჩერებულია. შენი მონაცემები შენახულია.',
  },
  {
    key: 'community',
    group: 'module',
    label: 'ქალების სივრცე',
    description: 'პოსტები, კომენტარები და გაწევრიანება. გაშვების ცალკე ფლაგი (ქალების სივრცე → გაშვება) უცვლელია.',
    defaultMessage: 'ქალების სივრცე დროებით შეჩერებულია.',
  },
  {
    key: 'pharmacy',
    group: 'module',
    label: 'აფთიაქი',
    description: 'ფასების ძებნა და ფასის დაკლების შეტყობინებები. ძველ ვერსიებში ძებნა ჩანს — იბლოკება მხოლოდ ახალი შეტყობინების დაყენება.',
    defaultMessage: 'აფთიაქის ძებნა დროებით შეჩერებულია.',
  },
  {
    key: 'news',
    group: 'module',
    label: 'სიახლეები მთავარ გვერდზე',
    description: 'ადმინიდან გამოქვეყნებული სიახლის ბარათები. გამორთვისას ყველა ბარათი ერთბაშად იმალება; თავად სიახლეები არ იშლება.',
    defaultMessage: 'სიახლეები დროებით დამალულია.',
  },
  {
    key: 'referralRewards',
    group: 'system',
    label: 'მოწვევის ჯილდოები',
    description: 'მეგობრის მოწვევისთვის 100 coin-ის ავტომატური დარიცხვა. კოდის შეყვანა გრძელდება, დარიცხვა ჩაირთვება ხელახლა ჩართვისას.',
    defaultMessage: 'მოწვევის ჯილდოები დროებით შეჩერებულია.',
  },
  {
    key: 'email',
    group: 'system',
    label: 'ელფოსტა (ყველა წერილი)',
    description: 'ყველა გამავალი წერილი: მისალმება, პაროლის აღდგენა, ანგარიშის წაშლა და კამპანიები. გამორთვისას პაროლის აღდგენა შეცდომას აჩვენებს.',
    defaultMessage: 'ელფოსტის გაგზავნა დროებით შეჩერებულია.',
  },
]);

const KEYS = new Set(FEATURES.map((f) => f.key));
const BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));
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

function ownState(rows, key) {
  const row = rows.find((r) => r.key === key);
  return row ? row.enabled !== false : true;
}

/** The key that pauses `key` — itself, or its parent module — or null when it runs. */
function blockingKey(rows, key) {
  if (!ownState(rows, key)) return key;
  const parent = BY_KEY.get(key)?.parent;
  return parent && !ownState(rows, parent) ? parent : null;
}

function messageFor(rows, key) {
  const row = rows.find((r) => r.key === key);
  return row?.message || BY_KEY.get(key)?.defaultMessage || 'ფუნქცია დროებით მიუწვდომელია.';
}

/** Full list for the admin console (definition + own and effective state). */
export async function listFeatureFlags(db = prisma) {
  const rows = await readRows(db);
  return FEATURES.map((f) => {
    const row = rows.find((r) => r.key === f.key);
    const blocker = blockingKey(rows, f.key);
    return {
      ...f,
      enabled: ownState(rows, f.key),
      effective: blocker == null,
      blockedBy: blocker && blocker !== f.key ? blocker : null,
      message: row?.message || f.defaultMessage,
      updatedAt: row?.updatedAt || null,
      updatedBy: row?.updatedBy || null,
    };
  });
}

/** { medi: true, … } for clients (/api/app/status) — effective state, parents included. */
export async function publicFeatureFlags(db = prisma) {
  const rows = await readRows(db);
  return Object.fromEntries(FEATURES.map((f) => [f.key, blockingKey(rows, f.key) == null]));
}

/** { cycle: '…' } — the user-facing text for each paused key only. */
export async function publicFeatureMessages(db = prisma) {
  const rows = await readRows(db);
  const out = {};
  for (const f of FEATURES) {
    const blocker = blockingKey(rows, f.key);
    if (blocker) out[f.key] = messageFor(rows, blocker);
  }
  return out;
}

export async function isFeatureEnabled(key, db = prisma) {
  if (!KEYS.has(key)) return true;
  const rows = await readRows(db);
  return blockingKey(rows, key) == null;
}

/** The admin's message for a paused key — its own, or its parent's when the parent is the cause. */
export async function featureDisabledMessage(key, db = prisma) {
  const rows = await readRows(db);
  return messageFor(rows, blockingKey(rows, key) || key);
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
 * Express middleware: refuses writes (POST/PUT/PATCH/DELETE) to a paused feature with
 * 503 FEATURE_DISABLED and the admin's message. Reads keep working so people
 * can still see their history. `match` narrows it to specific paths.
 */
export function requireFeature(key, { match } = {}) {
  return async (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (match && !match(req)) return next();
    try {
      if (await isFeatureEnabled(key)) return next();
      return res.status(503).json({ error: await featureDisabledMessage(key), code: 'FEATURE_DISABLED', feature: key });
    } catch {
      return next();
    }
  };
}

export function resetFeatureFlagCacheForTests() {
  cache = { at: 0, rows: null };
  ensured = false;
}
