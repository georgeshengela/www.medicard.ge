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
import { isEnglish } from './i18n.js';

/**
 * `group`: module = a whole product area, ai = one AI feature, system = background
 * behaviour with no screen of its own.
 * `parent`: a child is effectively off while its parent is off (pets → MEDIVET).
 */
export const FEATURES = Object.freeze([
  {
    key: 'medications',
    group: 'module',
    label: 'მედიკამენტები',
    description: 'მედიკამენტების სია, მიღების აღრიცხვა და შეხსენებების დაყენება. ახალი მედიკამენტი ვერ ემატება; ახალ ვერსიაში ჩანართი იმალება. უკვე დაყენებული შეხსენებები ტელეფონზე გრძელდება — დოზა არავინ გამოტოვოს.',
    defaultMessage: 'მედიკამენტების განყოფილება დროებით შეჩერებულია. დაყენებული შეხსენებები ჩვეულებრივ მოგივა.',
    defaultMessageEn: 'Medications are paused for a moment. Reminders you set still arrive as usual.',
  },
  {
    key: 'visits',
    group: 'module',
    label: 'ექიმთან ვიზიტები',
    description: 'ვიზიტების კალენდარი და ჩაწერა. ახალი ვიზიტი ვერ ემატება (Medi-ს მეშვეობითაც); ახალ ვერსიაში მოდული იმალება. უკვე დაყენებული შეხსენებები ტელეფონზე რჩება.',
    defaultMessage: 'ექიმთან ვიზიტების ჩაწერა დროებით შეჩერებულია. შენი ვიზიტები შენახულია.',
    defaultMessageEn: 'Doctor visits are paused for a moment. Your visits are saved.',
  },
  {
    key: 'records',
    group: 'module',
    label: 'სამედიცინო ჩანაწერები',
    description: 'ანალიზების, კვლევებისა და დოკუმენტების ბარათი. ახალი ჩანაწერი ვერ ემატება; ახალ ვერსიაში ჩანართი იმალება. არსებული ჩანაწერები ინახება.',
    defaultMessage: 'სამედიცინო ჩანაწერები დროებით შეჩერებულია. შენი ჩანაწერები შენახულია.',
    defaultMessageEn: 'Medical records are paused for a moment. Your records are saved.',
  },
  {
    key: 'labs',
    group: 'module',
    label: 'ლაბორატორიული ანალიზები',
    description: 'ანალიზების ისტორია, პარამეტრების დინამიკა და ფოტოდან/PDF-დან ამოკითხვა. ახალი ანალიზის წაკითხვა ჩერდება.',
    defaultMessage: 'ლაბორატორიული ანალიზები დროებით შეჩერებულია. შენი შედეგები შენახულია.',
    defaultMessageEn: 'Lab results are paused for a moment. Your results are saved.',
  },
  {
    key: 'hydration',
    group: 'module',
    label: 'წყალი',
    description: 'წყლის აღრიცხვა და დღიური მიზანი. ახალ ვერსიაში იმალება მთავარი გვერდის რგოლიც; ძველ ვერსიებში მხოლოდ მიზნის შეცვლა იბლოკება.',
    defaultMessage: 'წყლის აღრიცხვა დროებით შეჩერებულია.',
    defaultMessageEn: 'Water tracking is paused for a moment.',
  },
  {
    key: 'steps',
    group: 'module',
    label: 'ნაბიჯები',
    description: 'ნაბიჯების ეკრანი და მთავარი გვერდის რგოლი. ტელეფონის სინქრონიზაცია ფონურად გრძელდება, რომ ისტორია არ დაიკარგოს. მოქმედებს ახალ ვერსიაში.',
    defaultMessage: 'ნაბიჯები დროებით შეჩერებულია.',
    defaultMessageEn: 'Steps are paused for a moment.',
  },
  {
    key: 'weight',
    group: 'module',
    label: 'წონა და მიზანი',
    description: 'წონის ჩანაწერები, მიზანი და პროგრესი. მოქმედებს ახალ ვერსიაში.',
    defaultMessage: 'წონის განყოფილება დროებით შეჩერებულია. შენი ჩანაწერები შენახულია.',
    defaultMessageEn: 'Weight is paused for a moment. Your entries are saved.',
  },
  {
    key: 'cycle',
    group: 'module',
    label: 'ციკლი და ორსულობა',
    description: 'ციკლის კალენდარი, სიმპტომები, ორსულობის კვირები, მშობიარობის შემდგომი პერიოდი და პერიმენოპაუზა. ახალი ჩანაწერი ვერ ემატება; ახალ ვერსიაში მოდული საერთოდ იმალება.',
    defaultMessage: 'ციკლის მოდული დროებით შეჩერებულია. შენი ჩანაწერები შენახულია.',
    defaultMessageEn: 'Cycle tracking is paused for a moment. Your entries are saved.',
  },
  {
    key: 'nutrition',
    group: 'module',
    label: 'კვების დღიური',
    description: 'კვების დღიური, პროგრამა, რეცეპტები, მარხვის ტაიმერი და გაზომვები. ახალი ჩანაწერი ვერ ემატება.',
    defaultMessage: 'კვების დღიური დროებით შეჩერებულია. შენი ჩანაწერები შენახულია.',
    defaultMessageEn: 'The food diary is paused for a moment. Your entries are saved.',
  },
  {
    key: 'nutritionAi',
    group: 'ai',
    parent: 'nutrition',
    label: 'კვების AI შეფასება',
    description: 'ფოტოდან, ეტიკეტიდან და აღწერიდან კალორიის შეფასება. ხელით აღრიცხვა და ძებნა რჩება.',
    defaultMessage: 'AI შეფასება დროებით გამორთულია — კვება ხელით ან ძებნით დაამატე.',
    defaultMessageEn: 'AI estimates are off for now — add food by hand or with search.',
  },
  {
    key: 'medi',
    group: 'ai',
    label: 'Medi (AI ასისტენტი)',
    description: 'Medi-ს საუბარი, ექიმთან რეჟიმი, ღრმა ანალიზი, სიმპტომები, ლაბორატორია, კანი და გამოსახულებები.',
    defaultMessage: 'Medi დროებით მიუწვდომელია. ცოტა ხანში ისევ ჩაირთვება.',
    defaultMessageEn: 'Medi is unavailable for a moment. It will be back shortly.',
  },
  {
    key: 'mediDoctor',
    group: 'ai',
    parent: 'medi',
    label: 'Medi · ექიმთან',
    description: '„ექიმთან“ რეჟიმი — კლინიკური კონსულტაცია Medi-სთან. ჩვეულებრივი Medi და დანარჩენი ფუნქციები მუშაობს.',
    defaultMessage: '„ექიმთან“ რეჟიმი დროებით გამორთულია. Medi-სთან ჩვეულებრივი საუბარი მუშაობს.',
    defaultMessageEn: 'Doctor mode is off for a moment. The regular Medi chat still works.',
  },
  {
    key: 'mediDeep',
    group: 'ai',
    parent: 'medi',
    label: 'Medi · ღრმა ანალიზი',
    description: '„ღრმა ანალიზის“ რეჟიმი (კონსილიუმი) — ყველაზე ძვირი AI პასუხები. ჩვეულებრივი Medi მუშაობს.',
    defaultMessage: 'ღრმა ანალიზი დროებით გამორთულია. Medi-სთან ჩვეულებრივი საუბარი მუშაობს.',
    defaultMessageEn: 'Deep analysis is off for a moment. The regular Medi chat still works.',
  },
  {
    key: 'symptoms',
    group: 'ai',
    parent: 'medi',
    label: 'სიმპტომების შემოწმება',
    description: 'სხეულის რუკით სიმპტომების შემოწმება და შედეგი. ძველი შედეგები ჩანს.',
    defaultMessage: 'სიმპტომების შემოწმება დროებით გამორთულია.',
    defaultMessageEn: 'Symptom check is off for a moment.',
  },
  {
    key: 'imaging',
    group: 'ai',
    parent: 'medi',
    label: 'რენტგენი, CT და MRI',
    description: 'სამედიცინო გამოსახულებების (რენტგენი, CT, MRI) AI ანალიზი. ძველი შედეგები ჩანს.',
    defaultMessage: 'გამოსახულებების ანალიზი დროებით გამორთულია.',
    defaultMessageEn: 'Imaging analysis is off for a moment.',
  },
  {
    key: 'skin',
    group: 'ai',
    parent: 'medi',
    label: 'კანის ანალიზი და მოვლა',
    description: 'კანის ფოტოს AI ანალიზი და კანის მოვლის რჩევები. ძველი შედეგები ჩანს.',
    defaultMessage: 'კანის ანალიზი დროებით გამორთულია.',
    defaultMessageEn: 'Skin analysis is off for a moment.',
  },
  {
    key: 'voice',
    group: 'ai',
    parent: 'medi',
    label: 'ხმოვანი Medi',
    description: 'ხმით საუბარი Medi-სთან: მეტყველების ამოცნობა და პასუხის ხმამაღლა წაკითხვა. ტექსტური საუბარი მუშაობს.',
    defaultMessage: 'ხმოვანი რეჟიმი დროებით გამორთულია — Medi-ს ტექსტით მიწერე.',
    defaultMessageEn: 'Voice is off for a moment — type to Medi instead.',
  },
  {
    key: 'pets',
    group: 'module',
    label: 'ჩემი ცხოველები',
    description: 'ცხოველების პროფილები, მოვლა, წონა, ალერგიები და MEDIVET. ცვლილებები ჩერდება.',
    defaultMessage: 'ცხოველების მოდული დროებით შეჩერებულია. შენი მონაცემები შენახულია.',
    defaultMessageEn: 'Pets is paused for a moment. Your data is saved.',
  },
  {
    key: 'mediVet',
    group: 'ai',
    parent: 'pets',
    label: 'MEDIVET (ცხოველების AI)',
    description: 'ცხოველების AI საუბარი. ცხოველების პროფილები და მოვლა მუშაობას აგრძელებს.',
    defaultMessage: 'MEDIVET დროებით მიუწვდომელია.',
    defaultMessageEn: 'MEDIVET is unavailable for a moment.',
  },
  {
    key: 'medirun',
    group: 'module',
    label: 'MEDIRUN',
    description: 'გასეირნება-აღმოჩენის თამაში რუკაზე. ყურადღება: გამორთვის მომენტში დაწყებული სირბილი ვეღარ შეინახება.',
    defaultMessage: 'MEDIRUN დროებით შეჩერებულია. ცოტა ხანში დავბრუნდებით.',
    defaultMessageEn: 'MEDIRUN is paused for a moment. We will be back shortly.',
  },
  {
    key: 'medirunAutopilot',
    group: 'system',
    parent: 'medirun',
    label: 'MEDIRUN ავტოპილოტი („გაანათე თბილისი“)',
    description: 'კამპანიის საჩუქრების ავტომატური დაყრა: სამუშაო დღეებში მცირე ყუთები, შაბათ-კვირას უკეთესი, შაბათის წვიმა და 31 დეკემბრის დიდი საჩუქარი. გამორთვისას ახალი ყუთები აღარ ჩნდება; უკვე დაყრილი რჩება.',
    defaultMessage: 'კამპანიის საჩუქრები დროებით შეჩერებულია.',
    defaultMessageEn: 'Campaign gifts are paused for a moment.',
  },
  {
    key: 'medirunDecor',
    group: 'system',
    parent: 'medirun',
    label: 'MEDIRUN ქალაქის დეკორი',
    description: 'ღამის რუკის მორთულობა თბილისში: სადღესასწაულო ტრაილერები რუსთაველზე (თავისუფლების მოედანი ⇄ ფილარმონია) და მთაწმინდის განათებული ბორბალი. გამორთვისას რუკაზე აღარ ჩანს; სირბილზე გავლენა არ აქვს.',
    defaultMessage: 'ქალაქის მორთულობა დროებით გამორთულია.',
    defaultMessageEn: 'City decorations are off for a moment.',
  },
  {
    key: 'medirunPartners',
    group: 'system',
    parent: 'medirun',
    defaultOff: true,
    label: 'MEDIRUN პარტნიორები რუკაზე (მაკდონალდსი)',
    description: 'პარტნიორი ადგილების 3D შენობები და განათებული ლოგოები ღამის რუკაზე — ახლა მაკდონალდსი რუსთაველის მოედანზე. თავიდან გამორთულია: ჩართე მხოლოდ პარტნიორთან ხელშეკრულების შემდეგ (ლოგო მათი სავაჭრო ნიშანია).',
    defaultMessage: 'პარტნიორები რუკაზე დროებით არ ჩანს.',
    defaultMessageEn: 'Partners are hidden on the map for a moment.',
  },
  {
    key: 'quest',
    group: 'module',
    label: 'MEDIQUEST',
    description: 'მისიები, პროგრესი, Medi Coins-ის აღება და ჯილდოები. მისიების დასრულება და coin-ის აღება ჩერდება.',
    defaultMessage: 'MEDIQUEST დროებით შეჩერებულია. შენი coin-ები და პროგრესი შენახულია.',
    defaultMessageEn: 'MEDIQUEST is paused for a moment. Your coins and progress are saved.',
  },
  {
    key: 'rewardsStore',
    group: 'ai',
    parent: 'quest',
    label: 'ჯილდოების გაცვლა',
    description: 'Medi Coins-ის ჯილდოებზე გაცვლა. ქულების დაგროვება გრძელდება.',
    defaultMessage: 'ჯილდოების გაცვლა დროებით შეჩერებულია. შენი Medi Coins შენახულია.',
    defaultMessageEn: 'Reward redemption is paused for a moment. Your Medi Coins are saved.',
  },
  {
    key: 'coach',
    group: 'module',
    label: 'MEDICOACH (ფიტნეს ტრენერები)',
    description: 'ტრენერის განაცხადი, კლიენტის დაკავშირება, ვარჯიშების დანიშვნა, კვების გეგმა და პროგრეს-ფოტოები. ნახვა რჩება, ცვლილებები ჩერდება.',
    defaultMessage: 'ტრენერის ფუნქცია დროებით შეჩერებულია. შენი მონაცემები შენახულია.',
    defaultMessageEn: 'MEDICOACH is paused for a moment. Your data is saved.',
  },
  {
    key: 'community',
    group: 'module',
    label: 'ქალების სივრცე',
    description: 'პოსტები, კომენტარები და გაწევრიანება. გაშვების ცალკე ფლაგი (ქალების სივრცე → გაშვება) უცვლელია.',
    defaultMessage: 'ქალების სივრცე დროებით შეჩერებულია.',
    defaultMessageEn: "The women's space is paused for a moment.",
  },
  {
    key: 'pharmacy',
    group: 'module',
    label: 'აფთიაქი',
    description: 'ფასების ძებნა და ფასის დაკლების შეტყობინებები. ძველ ვერსიებში ძებნა ჩანს — იბლოკება მხოლოდ ახალი შეტყობინების დაყენება.',
    defaultMessage: 'აფთიაქის ძებნა დროებით შეჩერებულია.',
    defaultMessageEn: 'Pharmacy search is paused for a moment.',
  },
  {
    key: 'news',
    group: 'module',
    label: 'სიახლეები მთავარ გვერდზე',
    description: 'ადმინიდან გამოქვეყნებული სიახლის ბარათები. გამორთვისას ყველა ბარათი ერთბაშად იმალება; თავად სიახლეები არ იშლება.',
    defaultMessage: 'სიახლეები დროებით დამალულია.',
    defaultMessageEn: 'News is hidden for a moment.',
  },
  {
    // UI only: the choice is saved through PUT /api/health-profile, which is never gated.
    key: 'homeLayouts',
    group: 'module',
    label: 'მთავარი გვერდის ვარიანტები',
    description: 'ქალის / აქტიური / კვება და წონის მთავარი გვერდები და მათი არჩევა (მათ შორის რეგისტრაციისას). გამორთვისას ყველა სტანდარტულ მთავარ გვერდს ხედავს; არჩევანი ინახება.',
    defaultMessage: 'მთავარი გვერდის ვარიანტები დროებით შეჩერებულია.',
    defaultMessageEn: 'Home layouts are paused for a moment.',
  },
  {
    key: 'weather',
    group: 'module',
    label: 'ამინდი და თავის შეგრძნება',
    description: 'ამინდის გვერდი და ამინდზე დაფუძნებული რჩევები/შეხსენებები. მოქმედებს ახალ ვერსიაში.',
    defaultMessage: 'ამინდის გვერდი დროებით შეჩერებულია.',
    defaultMessageEn: 'Weather is paused for a moment.',
  },
  {
    key: 'weeklyReport',
    group: 'module',
    label: 'კვირის ანგარიში („ჩემი კვირა“)',
    description: 'კვირის შეჯამების გვერდი და კვირის ანგარიშის შეხსენება. მოქმედებს ახალ ვერსიაში.',
    defaultMessage: 'კვირის ანგარიში დროებით შეჩერებულია.',
    defaultMessageEn: 'The weekly report is paused for a moment.',
  },
  {
    key: 'healthPassport',
    group: 'module',
    label: 'ჯანმრთელობის პასპორტი (PDF)',
    description: 'პროფილიდან PDF-ის შექმნა და გაზიარება. მოქმედებს ახალ ვერსიაში.',
    defaultMessage: 'ჯანმრთელობის პასპორტი დროებით შეჩერებულია.',
    defaultMessageEn: 'The health passport is paused for a moment.',
  },
  {
    key: 'invites',
    group: 'module',
    label: 'მეგობრის მოწვევა',
    description: 'მოწვევის კოდი, ბმული და კოდის შეყვანა. ახალი კოდი ვერ შეიყვანება; გამორთვა აჩერებს მოწვევის ჯილდოებსაც.',
    defaultMessage: 'მეგობრის მოწვევა დროებით შეჩერებულია.',
    defaultMessageEn: 'Invites are paused for a moment.',
  },
  {
    key: 'referralRewards',
    group: 'system',
    parent: 'invites',
    label: 'მოწვევის ჯილდოები',
    description: 'კოდის შეყვანისთანავე 25 coin ორივე მხარეს. გამორთვისას კოდის შეყვანა გრძელდება, დარიცხვა ხდება ხელახლა ჩართვისას.',
    defaultMessage: 'მოწვევის ჯილდოები დროებით შეჩერებულია.',
    defaultMessageEn: 'Invite rewards are paused for a moment.',
  },
  {
    key: 'email',
    group: 'system',
    label: 'ელფოსტა (ყველა წერილი)',
    description: 'ყველა გამავალი წერილი: მისალმება, პაროლის აღდგენა, ანგარიშის წაშლა და კამპანიები. გამორთვისას პაროლის აღდგენა შეცდომას აჩვენებს.',
    defaultMessage: 'ელფოსტის გაგზავნა დროებით შეჩერებულია.',
    defaultMessageEn: 'Sending email is paused for a moment.',
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
  // a missing row means enabled — except features that must be switched on on purpose (`defaultOff`)
  return row ? row.enabled !== false : !BY_KEY.get(key)?.defaultOff;
}

/** The key that pauses `key` — itself, or its parent module — or null when it runs. */
function blockingKey(rows, key) {
  if (!ownState(rows, key)) return key;
  const parent = BY_KEY.get(key)?.parent;
  return parent && !ownState(rows, parent) ? parent : null;
}

const GEORGIAN_LETTER = /[ა-ჿ]/;
const FALLBACK_MESSAGE_EN = 'This feature is paused for a moment. Please try again later.';

/**
 * Admin-typed messages are Georgian. English requests get the feature's English default,
 * unless the admin wrote the message without Georgian letters (then it is shown as typed).
 */
function messageFor(rows, key, lang = 'ka') {
  const row = rows.find((r) => r.key === key);
  if (isEnglish(lang)) {
    if (row?.message && !GEORGIAN_LETTER.test(row.message)) return row.message;
    return BY_KEY.get(key)?.defaultMessageEn || FALLBACK_MESSAGE_EN;
  }
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

/** { cycle: '…' } — the user-facing text for each paused key only, in `lang` ('ka' | 'en'). */
export async function publicFeatureMessages(db = prisma, lang = 'ka') {
  const rows = await readRows(db);
  const out = {};
  for (const f of FEATURES) {
    const blocker = blockingKey(rows, f.key);
    if (blocker) out[f.key] = messageFor(rows, blocker, lang);
  }
  return out;
}

export async function isFeatureEnabled(key, db = prisma) {
  if (!KEYS.has(key)) return true;
  const rows = await readRows(db);
  return blockingKey(rows, key) == null;
}

/** The admin's message for a paused key — its own, or its parent's when the parent is the cause. */
export async function featureDisabledMessage(key, db = prisma, lang = 'ka') {
  const rows = await readRows(db);
  return messageFor(rows, blockingKey(rows, key) || key, lang);
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
      return res.status(503).json({ error: await featureDisabledMessage(key, prisma, req.lang), code: 'FEATURE_DISABLED', feature: key });
    } catch {
      return next();
    }
  };
}

export function resetFeatureFlagCacheForTests() {
  cache = { at: 0, rows: null };
  ensured = false;
}

/** Tests: serve these rows instead of the table (for 15 s, or until the reset above). */
export function primeFeatureFlagsForTests(rows) {
  cache = { at: Date.now(), rows: rows.map((r) => ({ message: null, updatedAt: null, updatedBy: null, ...r })) };
  ensured = true;
}
