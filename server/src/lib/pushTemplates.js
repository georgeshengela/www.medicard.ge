import { prisma } from './prisma.js';
import { PUSH_ENGAGE_TEMPLATE_DEFAULTS } from './pushEngageTemplates.js';

export const PUSH_TEMPLATE_DEFAULTS = [
  {
    key: 'medication',
    group: 'med',
    label: '💊 მედიკამენტის მიღების შეხსენება',
    title: '{name}-ის დროა 💊',
    body: 'არ დაგავიწყდეს შენი {name} {dosage} 🤍 Medi შეგახსენებს, რომ საკუთარ თავზე ზრუნვის დროა.',
    placeholders: ['name', 'dosage'],
    sample: { name: 'ასპირინი', dosage: '1 ტაბლეტი' },
  },
  {
    key: 'med-refill',
    group: 'med',
    label: '📦 მედიკამენტის მარაგის შეხსენება',
    title: '{name} ხომ არ გვითავდება? 👀',
    body: 'მგონი {name}-ის მარაგის შემოწმების დროა. გადაავლე თვალი, რომ საჭირო დროს ხელთ გქონდეს 💚',
    placeholders: ['name'],
    sample: { name: 'ასპირინი' },
  },
  {
    key: 'cycle-period-soon',
    group: 'cycle',
    label: '🩸 მენსტრუაციის მოახლოება',
    title: 'პერიოდი ახლოვდება 🌸',
    body: 'შენი ციკლის მიხედვით, მენსტრუაცია დაახლოებით {days} დღეშია მოსალოდნელი. პატარა heads-up Medi-სგან 💗',
    placeholders: ['days'],
    sample: { days: '2' },
  },
  {
    key: 'cycle-period-start',
    group: 'cycle',
    label: '🌷 მენსტრუაციის სავარაუდო დაწყება',
    title: 'დღეს შეიძლება დაიწყოს 🌷',
    body: 'Medi-ს გამოთვლებით, მენსტრუაცია სავარაუდოდ დღეს დაიწყება. თუ სხვაგვარად იქნება, არაფერი — ციკლი ყოველთვის ზუსტად კალენდარს არ მიჰყვება 🤍',
    placeholders: [],
    sample: {},
  },
  {
    key: 'cycle-ovulation',
    group: 'cycle',
    label: '🥚 ოვულაციის შეხსენება (TTC)',
    title: 'ოვულაციის დრო ახლოვდება ✨',
    body: 'თუ ორსულობას გეგმავ, დღეს შეიძლება ერთ-ერთი მნიშვნელოვანი დღე იყოს 💗 Medi შენთანაა.',
    placeholders: [],
    sample: {},
  },
  {
    key: 'cycle-fertile',
    group: 'cycle',
    label: '🌱 ნაყოფიერი ფანჯარა',
    title: 'ნაყოფიერი დღეები დაიწყო 🌱',
    body: 'შენი სავარაუდო ნაყოფიერი ფანჯარა დაიწყო. თუ ორსულობას გეგმავ, შეგიძლია ეს დღეები გაითვალისწინო 💚',
    placeholders: [],
    sample: {},
  },
  {
    key: 'cycle-pms',
    group: 'cycle',
    label: '🌙 PMS-ის ნიშნები',
    title: 'შეიძლება PMS ახლოვდებოდეს 🌙',
    body: 'თუ დღეს თავს ცოტა სხვანაირად გრძნობ, შენი ციკლის მიხედვით PMS-ის პერიოდი შეიძლება ახლოვდებოდეს. მოუსმინე შენს სხეულს 🤍',
    placeholders: [],
    sample: {},
  },
  {
    key: 'cycle-opk',
    group: 'cycle',
    label: '🧪 ოვულაციის ტესტის შეხსენება',
    title: 'OPK ტესტის დროა 🧪',
    body: 'თუ ამ ციკლში ოვულაციას აკვირდები, დღეს OPK ტესტის გაკეთება არ დაგავიწყდეს 💗',
    placeholders: [],
    sample: {},
  },
  {
    key: 'cycle-bbt',
    group: 'cycle',
    label: '🌡️ BBT-ის გაზომვა',
    title: 'დილა მშვიდობისა ☀️ BBT?',
    body: 'სანამ ადგები და დღეს დაიწყებ, ბაზალური ტემპერატურის გაზომვა არ დაგავიწყდეს 🌡️',
    placeholders: [],
    sample: {},
  },
  {
    key: 'cycle-log',
    group: 'cycle',
    label: '✍️ დღიური ჩანაწერის შეხსენება',
    title: 'როგორ ხარ დღეს? 💚',
    body: 'ერთი წუთი Medi-სთვის? მონიშნე როგორ ჩაიარა დღემ — სიმპტომები, განწყობა და რაც შენთვის მნიშვნელოვანია.',
    placeholders: [],
    sample: {},
  },
  {
    key: 'cycle-tip',
    group: 'cycle',
    label: '💚 Medi-ს ყოველდღიური რჩევა',
    title: 'Medi-სგან შენთვის 💚',
    body: 'დღეს შენთვის პატარა რჩევა მაქვს. შემომიარე, როცა დრო გექნება ✨',
    placeholders: [],
    sample: {},
  },
  {
    key: 'cycle-masked',
    group: 'cycle',
    label: '🔒 დისკრეტული შეტყობინებები',
    title: 'Medi-სგან შეხსენება',
    body: 'როცა დრო გექნება, შემომიარე 💚',
    placeholders: [],
    sample: {},
  },
  {
    key: 'visit',
    group: 'visit',
    label: '🩺 ექიმთან ვიზიტის შეხსენება',
    title: 'ვიზიტი არ დაგავიწყდეს 🩺',
    body: 'დღეს {time}-ზე {doctor}-თან ვიზიტი გაქვს{place}. ყველაფერი მზად გაქვს? Medi უბრალოდ შეგახსენებს 💚',
    placeholders: ['doctor', 'time', 'place'],
    sample: { doctor: 'თერაპევტი', time: '14:30', place: ' — კლინიკა' },
  },
  {
    key: 'steps',
    group: 'activity',
    label: '👟 დღიური ნაბიჯების მიზანი',
    title: 'ცოტაც და მიზანთან ხარ 👟',
    body: 'დღეს უკვე {steps} ნაბიჯი გაქვს. პატარა გასეირნება და კიდევ უფრო მიუახლოვდები შენს მიზანს 💚',
    placeholders: ['steps'],
    sample: { steps: '6,200' },
  },
  {
    key: 'weight',
    group: 'activity',
    label: '⚖️ წონის მიზნის შეხსენება',
    title: 'პატარა check-in? ⚖️',
    body: 'თუ დღეს წონის დაფიქსირება გინდოდა, შეგიძლია Medi-ში ჩაინიშნო — ბოლო მონაცემი: {kg} კგ. არანაირი წნეხი 🤍',
    placeholders: ['kg'],
    sample: { kg: '70' },
  },
  {
    key: 'admin-push',
    group: 'admin',
    label: '📣 ადმინის broadcast',
    title: 'მე ვარ, Medi 💚',
    body: 'შენთვის პატარა ამბავი მაქვს.',
    placeholders: [],
    sample: {},
  },
  ...PUSH_ENGAGE_TEMPLATE_DEFAULTS,
];

export const PUSH_TEMPLATE_GROUP_LABELS = {
  med: 'მედიკამენტები',
  cycle: 'ციკლი',
  visit: 'ექიმთან ვიზიტი',
  activity: 'აქტივობა',
  admin: 'ადმინი · remote',
  engage: 'Engaging · Medi companion',
};

export const PUSH_PLACEHOLDER_HELP = [
  { key: 'name', label: 'მედიკამენტის სახელი' },
  { key: 'dosage', label: 'დოზა' },
  { key: 'days', label: 'დღეების რაოდენობა' },
  { key: 'doctor', label: 'ექიმის სახელი' },
  { key: 'time', label: 'ვიზიტის დრო' },
  { key: 'place', label: 'ვიზიტის ადგილი' },
  { key: 'steps', label: 'ნაბიჯების რაოდენობა' },
  { key: 'kg', label: 'წონა' },
  { key: 'firstName', label: 'სახელი' },
];

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

export function tidyPushCopy(text) {
  return String(text ?? '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/(^|\s)-ის(?=\s|$)/g, '$1')
    .replace(/(^|\s)-თან(?=\s|$|[.,!?])/g, '$1ექიმთან')
    .replace(/(^|\s)-ზე(?=\s|$|[.,!?])/g, '$1')
    .replace(/\s*[·•]\s*(?=[.,]|$)/g, '')
    .replace(/\s+—\s*(?=[.,]|$)/g, '')
    .replace(/\s*—\s*ბოლო მონაცემი:\s*კგ\.?/g, '')
    .replace(/უკვე\s+ნაბიჯი გაქვს/g, 'ნაბიჯები უკვე გროვდება')
    .replace(/(\S)([—–])/g, '$1 $2')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function interpolateValue(value) {
  if (isBlank(value)) return '';
  const raw = String(value);
  const trimmed = raw.trim();
  if (/^[—–-]/.test(trimmed) && /^\s/.test(raw)) return ` ${trimmed}`;
  return trimmed;
}

export function interpolatePushCopy(text, vars = {}) {
  const filled = String(text ?? '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => interpolateValue(vars[key]));
  return tidyPushCopy(filled);
}

export function applyPushTemplate(template, vars = {}) {
  return {
    title: interpolatePushCopy(template.title, vars),
    body: interpolatePushCopy(template.body, vars),
  };
}

/** Reject unmatched braces / illegal placeholder names before they reach production. */
export function validatePushTemplatePlaceholders(title, body) {
  const errors = [];
  for (const [field, text] of [['title', title], ['body', body]]) {
    const raw = String(text ?? '');
    const leftovers = raw.replace(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g, '');
    if (leftovers.includes('{') || leftovers.includes('}')) {
      errors.push(`${field} has a malformed placeholder`);
    }
  }
  return { ok: errors.length === 0, errors };
}

let tablesReady = false;

export async function ensurePushTemplateTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PushTemplate" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PushTemplate_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PushTemplate_key_key" ON "PushTemplate"("key")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PushEvent" (
      "id" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "userId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PushEvent_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PushEvent_createdAt_idx" ON "PushEvent"("createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PushEvent_key_idx" ON "PushEvent"("key")
  `);
  tablesReady = true;
}

export async function listPushTemplates() {
  await ensurePushTemplateTables();
  let overrides = [];
  try {
    overrides = await prisma.$queryRaw`SELECT key, title, body, "updatedAt" FROM "PushTemplate"`;
  } catch {
    overrides = [];
  }
  const byKey = new Map((overrides ?? []).map((row) => [row.key, row]));
  return PUSH_TEMPLATE_DEFAULTS.map((def) => {
    const custom = byKey.get(def.key);
    return {
      ...def,
      title: custom?.title ?? def.title,
      body: custom?.body ?? def.body,
      custom: Boolean(custom),
      updatedAt: custom?.updatedAt ?? null,
    };
  });
}

export function templateByKey(templates, key) {
  return templates.find((row) => row.key === key) ?? PUSH_TEMPLATE_DEFAULTS.find((row) => row.key === key) ?? null;
}

export async function getPushTemplate(key) {
  const templates = await listPushTemplates();
  return templateByKey(templates, key);
}

export async function savePushTemplate(key, { title, body }) {
  await ensurePushTemplateTables();
  const def = PUSH_TEMPLATE_DEFAULTS.find((row) => row.key === key);
  if (!def) throw new Error('unknown_template');
  const valid = validatePushTemplatePlaceholders(title, body);
  if (!valid.ok) {
    const err = new Error(valid.errors.join('; '));
    err.code = 'invalid_template';
    throw err;
  }
  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "PushTemplate" (id, key, title, body, "updatedAt")
    VALUES (${id}, ${key}, ${title}, ${body}, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, "updatedAt" = CURRENT_TIMESTAMP
  `;
  return getPushTemplate(key);
}

export async function resetPushTemplate(key) {
  await ensurePushTemplateTables();
  await prisma.$executeRaw`DELETE FROM "PushTemplate" WHERE key = ${key}`;
  return getPushTemplate(key);
}

export async function logPushEvent({ source, key, title, body, userId }) {
  await ensurePushTemplateTables();
  try {
    const id = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "PushEvent" (id, source, key, title, body, "userId", "createdAt")
      VALUES (
        ${id},
        ${String(source || 'local').slice(0, 32)},
        ${String(key || 'unknown').slice(0, 80)},
        ${String(title || '').slice(0, 160)},
        ${String(body || '').slice(0, 600)},
        ${userId || null},
        CURRENT_TIMESTAMP
      )
    `;
    return { id };
  } catch (error) {
    console.warn('[push] event log failed', error?.message);
    return null;
  }
}

export async function listPushEvents(take = 80) {
  await ensurePushTemplateTables();
  try {
    const rows = await prisma.$queryRaw`
      SELECT e.id, e.source, e.key, e.title, e.body, e."userId", e."createdAt",
             u."fullName" AS "userName", u.email AS "userEmail"
      FROM "PushEvent" e
      LEFT JOIN "User" u ON u.id = e."userId"
      ORDER BY e."createdAt" DESC
      LIMIT ${take}
    `;
    return (rows ?? []).map((row) => ({
      id: row.id,
      source: row.source,
      key: row.key,
      title: row.title,
      body: row.body,
      userId: row.userId,
      createdAt: row.createdAt,
      user: row.userName || row.userEmail ? { fullName: row.userName, email: row.userEmail } : null,
    }));
  } catch {
    return [];
  }
}
