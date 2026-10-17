/**
 * Influencer program — pure rules (no database). Money is integer tetri everywhere (100 tetri = 1 ₾).
 *
 * Pay is marginal per credited registration: with the default ladder registrations 1–1 000 earn 25 tetri,
 * 1 001–5 000 earn 28 and 5 001+ earn 35. A registration's position is fixed when it is credited (after the hold),
 * so a later change of the ladder never rewrites money already earned.
 */

export const TETRI = 100;

/** Owner defaults (2026-10-16). Every value is editable in admin #/influencers → პარამეტრები. */
export const DEFAULT_CONFIG = Object.freeze({
  tiers: Object.freeze([
    Object.freeze({ from: 0, rate: 25 }),
    Object.freeze({ from: 1000, rate: 28 }),
    Object.freeze({ from: 5000, rate: 35 }),
  ]),
  /** Days a registration waits before it counts (account deleted / blocked inside it = not paid). */
  holdDays: 14,
  /** A new account may enter an influencer code only this many days after signing up. */
  entryWindowDays: 7,
  /** Smallest payout request, tetri. */
  minPayout: 2000,
  /** From this many registrations of one influencer from one network within 24 h, the next ones wait for an admin. */
  networkFlag: 3,
  /** Medi coins for the new user who enters an influencer code (same as a friend's code; no cash value). */
  inviteeCoins: 25,
  /** New influencer sign-ups on medicard.ge/promo. */
  signupOpen: true,
});

/** Status names follow the tier ladder by position — light that grows with every person brought in. */
export const TIER_LOOKS = Object.freeze([
  Object.freeze({ key: 'SPARK', ka: 'ნაპერწკალი', en: 'Spark' }),
  Object.freeze({ key: 'STAR', ka: 'ვარსკვლავი', en: 'Star' }),
  Object.freeze({ key: 'SUPERNOVA', ka: 'სუპერნოვა', en: 'Supernova' }),
  Object.freeze({ key: 'GALAXY', ka: 'გალაქტიკა', en: 'Galaxy' }),
  Object.freeze({ key: 'COSMOS', ka: 'კოსმოსი', en: 'Cosmos' }),
]);
export const MAX_TIERS = TIER_LOOKS.length;

export const ACCOUNT_STATUSES = Object.freeze(['PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED']);
export const ACCOUNT_STATUS_LABELS = Object.freeze({
  PENDING: { ka: 'განხილვაში', en: 'Under review' },
  ACTIVE: { ka: 'აქტიური', en: 'Active' },
  SUSPENDED: { ka: 'შეჩერებული', en: 'Paused' },
  BLOCKED: { ka: 'დაბლოკილი', en: 'Blocked' },
});
export const REFERRAL_STATUS_LABELS = Object.freeze({
  PENDING: { ka: 'მოლოდინში', en: 'On hold' },
  FLAGGED: { ka: 'შემოწმებაზე', en: 'Under review' },
  CREDITED: { ka: 'ჩაითვალა', en: 'Counted' },
  REVERSED: { ka: 'გაუქმდა', en: 'Reversed' },
  REJECTED: { ka: 'არ ჩაითვალა', en: 'Not counted' },
});
export const PAYOUT_STATUS_LABELS = Object.freeze({
  REQUESTED: { ka: 'მოთხოვნილია', en: 'Requested' },
  APPROVED: { ka: 'დამტკიცებულია', en: 'Approved' },
  PAID: { ka: 'ჩარიცხულია', en: 'Paid' },
  REJECTED: { ka: 'უარყოფილია', en: 'Rejected' },
});
/** Why a registration did not count (shown to the admin; the influencer sees only counts). */
export const REASON_LABELS = Object.freeze({
  ACCOUNT_DELETED: 'ანგარიში წაიშალა მოლოდინის დროს',
  ACCOUNT_BLOCKED: 'ანგარიში დაიბლოკა',
  NO_PHONE: 'ტელეფონი დაუდასტურებელია',
  AGE: '18 წლამდეა',
  AGE_UNKNOWN: 'დაბადების თარიღი უცნობია',
  INFLUENCER_BLOCKED: 'ინფლუენსერი დაიბლოკა',
  ADMIN: 'ადმინის გადაწყვეტილება',
});

export function tetriToGel(tetri) {
  return Math.round(Number(tetri) || 0) / TETRI;
}

/** "25.50 ₾" / "0.25 ₾" — always two decimals. */
export function formatGel(tetri) {
  const value = (Math.round(Number(tetri) || 0) / TETRI).toFixed(2);
  return `${value} ₾`;
}

/** Ladder sorted by threshold; the first step always starts at 0. */
export function normalizeTiers(tiers) {
  const list = Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_CONFIG.tiers;
  return [...list].map((t) => ({ from: Math.max(0, Math.round(Number(t.from) || 0)), rate: Math.max(0, Math.round(Number(t.rate) || 0)) }))
    .sort((a, b) => a.from - b.from)
    .map((t, i) => (i === 0 ? { ...t, from: 0 } : t));
}

/** Tetri earned by the n-th credited registration (1-based). */
export function rateForPosition(n, tiers = DEFAULT_CONFIG.tiers) {
  const ladder = normalizeTiers(tiers);
  let rate = ladder[0].rate;
  for (const step of ladder) if (n > step.from) rate = step.rate;
  return rate;
}

/** Tetri for positions after+1 … after+count (marginal, across tier borders). */
export function amountForRange(after, count, tiers = DEFAULT_CONFIG.tiers) {
  const ladder = normalizeTiers(tiers);
  let total = 0;
  let pos = Math.max(0, Math.floor(after));
  let left = Math.max(0, Math.floor(count));
  while (left > 0) {
    const idx = tierIndexForCount(pos, ladder);
    const next = ladder[idx + 1];
    const room = next ? next.from - pos : left;
    const take = Math.min(left, Math.max(1, room));
    total += take * ladder[idx].rate;
    pos += take;
    left -= take;
  }
  return total;
}

/** Index of the tier that the NEXT registration falls into, given `count` credited so far. */
export function tierIndexForCount(count, tiers = DEFAULT_CONFIG.tiers) {
  const ladder = normalizeTiers(tiers);
  let idx = 0;
  ladder.forEach((step, i) => { if (count >= step.from) idx = i; });
  return idx;
}

/** Status (tier) for `credited` registrations, with what it takes to reach the next one. */
export function tierFor(credited, tiers = DEFAULT_CONFIG.tiers) {
  const ladder = normalizeTiers(tiers);
  const count = Math.max(0, Math.floor(Number(credited) || 0));
  const index = tierIndexForCount(count, ladder);
  const look = TIER_LOOKS[index] || TIER_LOOKS[TIER_LOOKS.length - 1];
  const step = ladder[index];
  const nextStep = ladder[index + 1] || null;
  const nextLook = nextStep ? TIER_LOOKS[index + 1] || TIER_LOOKS[TIER_LOOKS.length - 1] : null;
  const span = nextStep ? nextStep.from - step.from : 0;
  return {
    index,
    key: look.key,
    ka: look.ka,
    en: look.en,
    from: step.from,
    rate: step.rate,
    progress: nextStep ? Math.min(1, Math.max(0, (count - step.from) / Math.max(1, span))) : 1,
    next: nextStep ? { key: nextLook.key, ka: nextLook.ka, en: nextLook.en, from: nextStep.from, rate: nextStep.rate, remaining: Math.max(0, nextStep.from - count) } : null,
  };
}

/** The ladder as the portal shows it: name, from which registration, rate. */
export function tierLadder(tiers = DEFAULT_CONFIG.tiers) {
  return normalizeTiers(tiers).map((step, i) => {
    const look = TIER_LOOKS[i] || TIER_LOOKS[TIER_LOOKS.length - 1];
    return { key: look.key, ka: look.ka, en: look.en, from: step.from, rate: step.rate };
  });
}

/** Admin input → a clean config, or { error } in Georgian (admin is Georgian only). */
export function validateConfig(input, base = DEFAULT_CONFIG) {
  const src = { ...base, ...(input || {}) };
  const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN);
  if (!Array.isArray(src.tiers) || !src.tiers.length) return { error: 'მიუთითე მინიმუმ ერთი საფეხური.' };
  if (src.tiers.length > MAX_TIERS) return { error: `საფეხური მაქსიმუმ ${MAX_TIERS} შეიძლება.` };
  const raw = src.tiers.map((t) => ({ from: int(t.from), rate: int(t.rate) }));
  if (raw.some((t) => !Number.isFinite(t.from) || !Number.isFinite(t.rate))) return { error: 'საფეხურის ზღვარი და ტარიფი რიცხვები უნდა იყოს.' };
  const tiers = [...raw].sort((a, b) => a.from - b.from);
  if (tiers[0].from !== 0) return { error: 'პირველი საფეხური 0-დან იწყება.' };
  for (let i = 1; i < tiers.length; i += 1) if (tiers[i].from <= tiers[i - 1].from) return { error: 'საფეხურების ზღვრები ერთმანეთზე მეტი უნდა იყოს.' };
  if (tiers.some((t) => t.rate < 1 || t.rate > 10000)) return { error: 'ტარიფი 1-დან 10 000 თეთრამდე (100 ₾) უნდა იყოს.' };
  const holdDays = int(src.holdDays);
  if (!(holdDays >= 0 && holdDays <= 90)) return { error: 'მოლოდინის პერიოდი 0–90 დღე უნდა იყოს.' };
  const entryWindowDays = int(src.entryWindowDays);
  if (!(entryWindowDays >= 1 && entryWindowDays <= 30)) return { error: 'კოდის შეყვანის ვადა 1–30 დღე უნდა იყოს.' };
  const minPayout = int(src.minPayout);
  if (!(minPayout >= 100 && minPayout <= 1000000)) return { error: 'მინიმალური გატანა 1 ₾-დან 10 000 ₾-მდე უნდა იყოს.' };
  const networkFlag = int(src.networkFlag);
  if (!(networkFlag >= 2 && networkFlag <= 100)) return { error: 'ერთი ქსელის ზღვარი 2–100 უნდა იყოს.' };
  const inviteeCoins = int(src.inviteeCoins);
  if (!(inviteeCoins >= 0 && inviteeCoins <= 500)) return { error: 'ახალი მომხმარებლის მონეტები 0–500 უნდა იყოს.' };
  return { config: { tiers, holdDays, entryWindowDays, minPayout, networkFlag, inviteeCoins, signupOpen: src.signupOpen !== false } };
}

/* ───────────── codes ───────────── */

export const CODE_LENGTH = 6;
/** Codes the system makes up: no 0/O, 1/I/L — the same alphabet as friends' invite codes (referral.js CODE_ALPHABET). */
export const AUTO_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Codes an influencer chooses: every Latin letter and 2–9. 0 and 1 are left out (they read as O and I). */
export const CUSTOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';

/** What a person typed → the stored form: upper case, 0 → O and 1 → I (they look alike on a screen), 6 signs. */
export function normalizeEnteredCode(raw) {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1/g, 'I');
  return code.length === CODE_LENGTH && [...code].every((c) => CUSTOM_ALPHABET.includes(c)) ? code : null;
}

/** Insults and slurs (English + Georgian in Latin letters), checked as substrings after undoing digit look-alikes. */
const BLOCKED_PARTS = Object.freeze([
  'FUCK', 'FUK', 'FCK', 'SHIT', 'CUNT', 'DICK', 'COCK', 'PUSSY', 'BITCH', 'WHORE', 'SLUT', 'PORN', 'NAZI', 'HITLER',
  'RAPE', 'NIGG', 'NIGA', 'PENIS', 'VAGIN', 'BOOB', 'TITS', 'JIHAD', 'ANAL', 'HORNY', 'NUDE', 'NAKED', 'DILDO', 'WANK',
  'TWAT', 'PEDO', 'SEX', 'FAG', 'KKK', 'CUM', 'XXX', 'ISIS', 'KILL', 'DRUG', 'COKE', 'WEED', 'METH', 'CASINO', 'ASSHOL',
  // Georgian / Russian street words written in Latin letters
  'TRAK', 'YLE', 'QLE', 'MUTEL', 'MUTL', 'CHATL', 'CATLA', 'BOZI', 'PIDAR', 'PIDOR', 'GANDON', 'XUI', 'HUI', 'HUY',
  'BLYAT', 'BLIAT', 'SUKA', 'MUDAK', 'EBAT', 'EBAL', 'PIZD', 'JOPA', 'ZHOPA', 'DEDAMO', 'DEDAS', 'DEDIS',
]);
/** Words that would pass for us or for a giveaway. */
const RESERVED_PARTS = Object.freeze(['ADMIN', 'MEDICA', 'OFFIC', 'SUPPORT', 'STAFF', 'PROMO', 'SYSTEM', 'NULL', 'UNDEF', 'TEST', 'FREE', 'BONUS', 'CASH', 'MONEY', 'PRIZE']);
const DELEET = { 4: 'A', 3: 'E', 5: 'S', 7: 'T', 8: 'B', 9: 'G', 2: 'Z', 6: 'G' };

export function isOffensiveCode(code) {
  const plain = String(code || '').toUpperCase().replace(/[2-9]/g, (d) => DELEET[d] || d);
  return BLOCKED_PARTS.some((part) => plain.includes(part) || String(code).toUpperCase().includes(part));
}

export function isReservedCode(code) {
  const upper = String(code || '').toUpperCase();
  return RESERVED_PARTS.some((part) => upper.includes(part));
}

function isRun(code) {
  const ranks = [...code].map((c) => CUSTOM_ALPHABET.indexOf(c));
  const step = ranks[1] - ranks[0];
  return Math.abs(step) === 1 && ranks.every((r, i) => i === 0 || r - ranks[i - 1] === step);
}

/** Error key for a custom code, or null when it may be used (availability is checked in the database). */
export function customCodeProblem(raw) {
  const typed = String(raw ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (typed.length !== CODE_LENGTH) return 'LENGTH';
  if (!/^[A-Z0-9]+$/.test(typed)) return 'CHARS';
  if (/[01]/.test(typed)) return 'ZERO_ONE';
  if ((typed.match(/[A-Z]/g) || []).length < 2) return 'LETTERS';
  if (new Set(typed).size === 1 || isRun(typed)) return 'SIMPLE';
  if (isOffensiveCode(typed)) return 'OFFENSIVE';
  if (isReservedCode(typed)) return 'RESERVED';
  return null;
}

export const CODE_PROBLEMS = Object.freeze({
  LENGTH: { ka: 'კოდი ზუსტად 6 ნიშანია.', en: 'A code is exactly 6 characters.' },
  CHARS: { ka: 'მხოლოდ ლათინური ასოები და ციფრები.', en: 'Latin letters and digits only.' },
  ZERO_ONE: { ka: '0 და 1 არ გამოიყენება — ეკრანზე O-ს და I-ს ჰგავს. გამოიყენე O, I ან 2–9.', en: "0 and 1 aren't used — on screen they look like O and I. Use O, I or 2–9." },
  LETTERS: { ka: 'კოდში მინიმუმ 2 ასო უნდა იყოს.', en: 'Use at least 2 letters.' },
  SIMPLE: { ka: 'ძალიან მარტივი კოდია — მოიფიქრე სხვა.', en: 'That code is too simple — try another.' },
  OFFENSIVE: { ka: 'ეს კოდი ვერ გამოიყენება.', en: "That code can't be used." },
  RESERVED: { ka: 'ეს სიტყვა დაცულია — აირჩიე სხვა.', en: 'That word is reserved — choose another.' },
  TAKEN: { ka: 'ეს კოდი დაკავებულია.', en: 'That code is taken.' },
  TOO_SOON: { ka: 'საკუთარი კოდის შეცვლა 30 დღეში ერთხელ შეიძლება.', en: 'You can change your own code once every 30 days.' },
  TOO_MANY: { ka: 'კოდების ლიმიტი ამოწურულია — მოგვწერე და დაგეხმარებით.', en: "You've reached the code limit — write to us and we'll help." },
  SAME: { ka: 'ეს კოდი უკვე შენია.', en: 'This code is already yours.' },
});
export const CUSTOM_CODE_COOLDOWN_DAYS = 30;
export const MAX_CODES = 5;

/* ───────────── people, socials, bank ───────────── */

export function normalizeEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(email) && email.length <= 254 ? email : null;
}

/** Georgian mobile → +9955XXXXXXXX; any other number in international form +XXXXXXXX (8–15 digits). */
export function normalizePhone(raw) {
  const text = String(raw ?? '').trim();
  const digits = text.replace(/\D/g, '');
  if (/^5\d{8}$/.test(digits)) return `+995${digits}`;
  if (/^9955\d{8}$/.test(digits)) return `+${digits}`;
  if (/^009955\d{8}$/.test(digits)) return `+${digits.slice(2)}`;
  if (text.startsWith('+') && /^\d{8,15}$/.test(digits) && !digits.startsWith('995')) return `+${digits}`;
  return null;
}

/** Last 9 digits — how two spellings of one number are compared. */
export function phoneKey(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
}

export function maskPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  const local = digits.slice(-9);
  return `${local.slice(0, 1)}•• ••• •${local.slice(-2)}`;
}

export const SOCIAL_KEYS = Object.freeze(['instagram', 'tiktok', 'facebook', 'youtube', 'other']);
const HOSTS = {
  instagram: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i,
  tiktok: /^(?:https?:\/\/)?(?:www\.|m\.|vm\.)?tiktok\.com\//i,
  facebook: /^(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\//i,
  youtube: /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i,
};

/** A typed handle or profile link → the stored value (handle without @ for Instagram/TikTok), or null if invalid. */
export function normalizeSocial(key, raw) {
  let text = String(raw ?? '').trim();
  if (!text) return '';
  if (key === 'other') {
    if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
    try {
      const url = new URL(text);
      return /^https?:$/.test(url.protocol) && url.hostname.includes('.') && text.length <= 200 ? url.toString() : null;
    } catch {
      return null;
    }
  }
  text = text.replace(HOSTS[key] || /^$/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (key === 'instagram') {
    const handle = text.replace(/^@/, '').split('/')[0];
    return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle.toLowerCase() : null;
  }
  if (key === 'tiktok') {
    const handle = text.replace(/^@/, '').split('/')[0];
    return /^[A-Za-z0-9._]{2,24}$/.test(handle) ? handle.toLowerCase() : null;
  }
  if (key === 'facebook') {
    const id = String(raw).match(/profile\.php\?id=(\d{5,20})/);
    if (id) return `profile.php?id=${id[1]}`;
    const name = text.replace(/^@/, '').split('/')[0];
    return /^[A-Za-z0-9.\-]{2,80}$/.test(name) ? name : null;
  }
  if (key === 'youtube') {
    return /^@?[A-Za-z0-9._\-]{2,40}(\/[A-Za-z0-9._\-]{2,60})?$/.test(text) ? text : null;
  }
  return null;
}

/** Public profile link for a stored social value. */
export function socialUrl(key, value) {
  if (!value) return null;
  if (key === 'instagram') return `https://instagram.com/${value}`;
  if (key === 'tiktok') return `https://www.tiktok.com/@${value}`;
  if (key === 'facebook') return `https://facebook.com/${value}`;
  if (key === 'youtube') return `https://youtube.com/${value.startsWith('@') || value.includes('/') ? value : `@${value}`}`;
  return value;
}

/** Georgian IBAN: GE + 2 check digits + 2-letter bank code + 16 digits, mod-97 = 1. */
export function normalizeIban(raw) {
  const iban = String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (!/^GE\d{2}[A-Z]{2}\d{16}$/.test(iban)) return null;
  const moved = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let rest = 0;
  for (const ch of moved) {
    const part = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of part) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1 ? iban : null;
}

/** Bank codes inside a Georgian IBAN that we are sure about; anything else asks for the bank's name. */
export const IBAN_BANKS = Object.freeze({
  TB: 'თიბისი ბანკი',
  BG: 'საქართველოს ბანკი',
  LB: 'ლიბერთი ბანკი',
  BS: 'ბაზისბანკი',
  PC: 'პროკრედიტ ბანკი',
  VT: 'ვითიბი ბანკი',
  HS: 'ხალიკ ბანკი',
  CR: 'ქართუ ბანკი',
  CD: 'კრედო ბანკი',
});

export function bankForIban(iban) {
  const code = String(iban || '').slice(4, 6);
  return IBAN_BANKS[code] || null;
}

export function maskIban(iban) {
  const s = String(iban || '');
  return s.length > 8 ? `${s.slice(0, 6)} •••• ${s.slice(-4)}` : s;
}

export const PAYEE_TYPES = Object.freeze({
  PERSON: { ka: 'ფიზიკური პირი', en: 'Individual', idDigits: 11 },
  ENTREPRENEUR: { ka: 'ინდივიდუალური მეწარმე', en: 'Sole proprietor', idDigits: 11 },
  COMPANY: { ka: 'კომპანია (შპს)', en: 'Company (LLC)', idDigits: 9 },
});

/** Payout account as entered → clean details or { field, ka, en } describing the first problem. */
export function validatePayoutDetails(input) {
  const src = input || {};
  const type = PAYEE_TYPES[src.payeeType] ? src.payeeType : null;
  if (!type) return { problem: { field: 'payeeType', ka: 'აირჩიე, ვის ერიცხება თანხა.', en: 'Choose who receives the money.' } };
  const iban = normalizeIban(src.iban);
  if (!iban) return { problem: { field: 'iban', ka: 'IBAN არასწორია. ქართული IBAN 22 ნიშანია და GE-თი იწყება.', en: 'That IBAN is not valid. A Georgian IBAN has 22 characters and starts with GE.' } };
  const holder = String(src.holder ?? '').trim().replace(/\s+/g, ' ');
  if (holder.length < 3 || holder.length > 120) return { problem: { field: 'holder', ka: 'ჩაწერე ანგარიშის მფლობელის სახელი და გვარი (ან კომპანიის სახელი).', en: "Enter the account holder's full name (or the company name)." } };
  const idCode = String(src.idCode ?? '').replace(/\D/g, '');
  if (idCode.length !== PAYEE_TYPES[type].idDigits) {
    return { problem: { field: 'idCode', ka: type === 'COMPANY' ? 'საიდენტიფიკაციო კოდი 9 ციფრია.' : 'პირადი ნომერი 11 ციფრია.', en: type === 'COMPANY' ? 'The company ID is 9 digits.' : 'The personal ID number is 11 digits.' } };
  }
  const bank = String(src.bank ?? '').trim().slice(0, 80) || bankForIban(iban);
  if (!bank) return { problem: { field: 'bank', ka: 'ჩაწერე ბანკის სახელი.', en: 'Enter the bank name.' } };
  return { details: { payeeType: type, iban, holder, idCode, bank } };
}

/** "Nino Beridze" stays; shown to people who entered the influencer's code. */
export function cleanName(raw, { min = 2, max = 80 } = {}) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  return name.length >= min && name.length <= max ? name : null;
}

export const PASSWORD_MIN = 8;
export function passwordProblem(raw) {
  const pw = String(raw ?? '');
  if (pw.length < PASSWORD_MIN) return { ka: `პაროლი მინიმუმ ${PASSWORD_MIN} სიმბოლოა.`, en: `The password needs at least ${PASSWORD_MIN} characters.` };
  if (pw.length > 128) return { ka: 'პაროლი ძალიან გრძელია.', en: 'The password is too long.' };
  return null;
}

const MONTHS_KA_DAT = ['იანვარს', 'თებერვალს', 'მარტს', 'აპრილს', 'მაისს', 'ივნისს', 'ივლისს', 'აგვისტოს', 'სექტემბერს', 'ოქტომბერს', 'ნოემბერს', 'დეკემბერს'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * An influencer code typed after the entry window, said plainly with the account's own sign-up day (Tbilisi time,
 * UTC+4): an account that existed before the code was not brought by the influencer (owner 2026-10-17).
 */
export function influencerTooLateText(lang, windowDays, accountCreatedAt) {
  const d = new Date(new Date(accountCreatedAt).getTime() + 4 * 3_600_000);
  const day = d.getUTCDate();
  return lang === 'en'
    ? `This is an influencer code — it can be entered within ${windowDays} days of signing up, and your account was created on ${MONTHS_EN[d.getUTCMonth()]} ${day}.`
    : `ეს ინფლუენსერის კოდია — ის რეგისტრაციიდან ${windowDays} დღეში შეიყვანება, შენი ანგარიში კი ${day} ${MONTHS_KA_DAT[d.getUTCMonth()]} შეიქმნა.`;
}

/** Program terms version — bump when the rules text in the portal changes. */
export const TERMS_VERSION = '2026-10-16';
