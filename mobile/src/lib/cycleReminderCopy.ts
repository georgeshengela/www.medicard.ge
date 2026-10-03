/**
 * Lock-screen copy for cycle reminders (brief §9 item 5, §5 complaint #6).
 *
 * The default-on family (period soon / today / late) never mentions fertility, ovulation, sex, libido
 * or discharge — those words may appear only in the optional reminders the person switched on herself.
 * Every estimate says „სავარაუდოდ“ / "estimated"; nothing here is a diagnosis.
 *
 * Georgian copy can be edited by the admin (push templates). The server still ships the pre-brief
 * texts as its code defaults, so a template that still equals that old default is treated as
 * "not customised" and the texts below win; a template the admin actually changed is honoured.
 * Pure (no app imports): node tests load it.
 */

export type ReminderCopy = {
  title: string;
  body: string;
  /** Used instead of `body` when the forecast confidence is low / irregular cycles. */
  bodyCautious?: string;
};

export const CYCLE_REMINDER_TEMPLATE_KEYS = Object.freeze([
  'cycle-period-soon',
  'cycle-period-start',
  'cycle-period-late',
  'cycle-ovulation',
  'cycle-fertile',
  'cycle-pms',
  'cycle-opk',
  'cycle-bbt',
  'cycle-log',
  'cycle-masked',
] as const);

export type CycleReminderTemplateKey = (typeof CYCLE_REMINDER_TEMPLATE_KEYS)[number];

export const CYCLE_REMINDER_COPY_KA: Record<CycleReminderTemplateKey, ReminderCopy> = {
  'cycle-period-soon': {
    title: 'მენსტრუაცია სავარაუდოდ {days} დღეში 🌸',
    body: 'შენი ბოლო ციკლების მიხედვით. ეს შეფასებაა — Medi მხოლოდ შეგახსენებს 💗',
    bodyCautious: 'შენი ციკლების მიხედვით — პროგნოზის სანდოობა ჯერ დაბალია, თარიღი შეიძლება შეიცვალოს 🤍',
  },
  'cycle-period-start': {
    title: 'მენსტრუაცია სავარაუდოდ დღეს 🌷',
    body: 'თუ დღეს არ დაიწყო, არაფერი — ციკლი ყოველთვის ზუსტად კალენდარს არ მიჰყვება 🤍',
  },
  'cycle-period-late': {
    title: 'სავარაუდო თარიღი გავიდა — ყველაფერი რიგზეა? 🤍',
    body: 'მენსტრუაცია ჯერ არ აღნიშნულა. თუ დაიწყო, მონიშნე ერთი შეხებით — თუ არა, ეს ციკლი შეიძლება უბრალოდ გრძელი იყოს 🤍',
  },
  'cycle-ovulation': {
    title: 'სავარაუდო ოვულაცია ახლოვდება ✨',
    body: 'კალენდრის მიხედვით, სავარაუდო ოვულაციის დღე ახლოვდება. ეს შეფასებაა — ციკლი ყოველთვის ზუსტად არ მიჰყვება კალენდარს 🤍',
    bodyCautious: 'ეს დღე შეიძლება სავარაუდო ოვულაციასთან ახლოს იყოს. პროგნოზის სანდოობა დაბალია 🤍',
  },
  'cycle-fertile': {
    title: 'სავარაუდო ნაყოფიერი ფანჯარა 🌱',
    body: 'შენი სავარაუდო ნაყოფიერი ფანჯარა შეიძლება იწყებოდეს. ეს კალენდარული შეფასებაა — პროგნოზი შეიძლება შეიცვალოს 🤍',
    bodyCautious: 'ეს დღე შეიძლება ნაყოფიერ ფანჯარაში იყოს. პროგნოზის სანდოობა დაბალია 🤍',
  },
  'cycle-pms': {
    title: 'შეიძლება PMS ახლოვდებოდეს 🌙',
    body: 'თუ დღეს თავს ცოტა სხვანაირად გრძნობ, შენი ციკლის მიხედვით PMS-ის პერიოდი შეიძლება ახლოვდებოდეს. მოუსმინე შენს სხეულს 🤍',
  },
  'cycle-opk': {
    title: 'OPK ტესტის დროა 🧪',
    body: 'თუ ამ ციკლში ოვულაციის ტესტს იყენებ, დღეს OPK-ის გაკეთება არ დაგავიწყდეს 💗',
  },
  'cycle-bbt': {
    title: 'დილა მშვიდობისა ☀️ BBT?',
    body: 'სანამ ადგები და დღეს დაიწყებ, ბაზალური ტემპერატურის გაზომვა არ დაგავიწყდეს 🌡️',
  },
  'cycle-log': {
    title: 'როგორ ხარ დღეს? 💚',
    body: 'ერთი წუთი Medi-სთვის? მონიშნე როგორ ჩაიარა დღემ — სიმპტომები, განწყობა და რაც შენთვის მნიშვნელოვანია.',
  },
  'cycle-masked': {
    title: 'Medi-სგან შეხსენება',
    body: 'როცა დრო გექნება, შემომიარე 💚',
  },
};

export const CYCLE_REMINDER_COPY_EN: Record<CycleReminderTemplateKey, ReminderCopy> = {
  'cycle-period-soon': {
    title: 'Period estimated in {days} 🌸',
    body: 'Based on your recent cycles. This is an estimate — Medi is just reminding you 💗',
    bodyCautious: 'Based on your cycles — confidence is still low, so the date may move 🤍',
  },
  'cycle-period-start': {
    title: 'Period estimated today 🌷',
    body: 'If it doesn’t start today, that’s okay — cycles don’t always follow the calendar exactly 🤍',
  },
  'cycle-period-late': {
    title: 'The estimated date has passed — everything okay? 🤍',
    body: 'No period logged yet. If it started, log it with one tap — if not, this cycle may simply be longer.',
  },
  'cycle-ovulation': {
    title: 'Estimated ovulation is coming up ✨',
    body: 'Based on the calendar, your estimated ovulation day is getting close. This is an estimate — cycles don’t always follow the calendar exactly 🤍',
    bodyCautious: 'This day may be close to your estimated ovulation. Prediction confidence is low 🤍',
  },
  'cycle-fertile': {
    title: 'Estimated fertile window 🌱',
    body: 'Your estimated fertile window may be starting. This is a calendar estimate — the prediction can change 🤍',
    bodyCautious: 'This day may be in your fertile window. Prediction confidence is low 🤍',
  },
  'cycle-pms': {
    title: 'PMS may be coming up 🌙',
    body: 'If you feel a little different today, your cycle suggests PMS may be coming up. Listen to your body 🤍',
  },
  'cycle-opk': {
    title: 'Time for your OPK test 🧪',
    body: 'If you’re using ovulation tests this cycle, don’t forget today’s OPK 💗',
  },
  'cycle-bbt': {
    title: 'Good morning ☀️ BBT?',
    body: 'Before you get up and start your day, remember to take your basal temperature 🌡️',
  },
  'cycle-log': {
    title: 'How are you today? 💚',
    body: 'A minute for Medi? Note how your day went — symptoms, mood and whatever matters to you.',
  },
  'cycle-masked': {
    title: 'A reminder from Medi',
    body: 'Stop by when you have a moment 💚',
  },
};

/**
 * The server's pre-brief code defaults (server/src/lib/pushTemplates.js, 2026-09). A cached admin
 * template equal to one of these was never customised, so the app copy above replaces it.
 * Drop this map once the server templates carry the new texts.
 */
export const LEGACY_SERVER_CYCLE_COPY: Partial<Record<CycleReminderTemplateKey, { title: string; body: string }>> = {
  'cycle-period-soon': {
    title: 'სავარაუდო მენსტრუაცია ახლოვდება 🌸',
    body: 'შენი ციკლის მიხედვით, მენსტრუაცია დაახლოებით {days} დღეშია მოსალოდნელი. ეს შეფასებაა — Medi მხოლოდ შეგახსენებს 💗',
  },
  'cycle-period-start': {
    title: 'დღეს შეიძლება დაიწყოს 🌷',
    body: 'Medi-ს გამოთვლებით, მენსტრუაცია სავარაუდოდ დღეს დაიწყება. თუ სხვაგვარად იქნება, არაფერი — ციკლი ყოველთვის ზუსტად კალენდარს არ მიჰყვება 🤍',
  },
  'cycle-ovulation': {
    title: 'სავარაუდო ოვულაცია ახლოვდება ✨',
    body: 'კალენდრის მიხედვით, სავარაუდო ოვულაციის დღე ახლოვდება. ეს შეფასებაა — ციკლი ყოველთვის ზუსტად არ მიჰყვება კალენდარს 🤍',
  },
  'cycle-fertile': {
    title: 'სავარაუდო ნაყოფიერი ფანჯარა 🌱',
    body: 'შენი სავარაუდო ნაყოფიერი ფანჯარა შეიძლება იწყებოდეს. ეს კალენდარული შეფასებაა — პროგნოზი შეიძლება შეიცვალოს 🤍',
  },
  'cycle-pms': {
    title: 'შეიძლება PMS ახლოვდებოდეს 🌙',
    body: 'თუ დღეს თავს ცოტა სხვანაირად გრძნობ, შენი ციკლის მიხედვით PMS-ის პერიოდი შეიძლება ახლოვდებოდეს. მოუსმინე შენს სხეულს 🤍',
  },
};

const norm = (s: string | undefined | null) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** True when an admin template differs from the server's old code default (i.e. the admin wrote it). */
export function isCustomisedCycleTemplate(
  key: string,
  cached: { title?: string | null; body?: string | null } | null | undefined,
): boolean {
  if (!cached) return false;
  const legacy = LEGACY_SERVER_CYCLE_COPY[key as CycleReminderTemplateKey];
  if (!legacy) return true;
  return norm(cached.title) !== norm(legacy.title) || norm(cached.body) !== norm(legacy.body);
}

/**
 * Raw (uninterpolated) copy for one reminder. `cached` is the admin template from the server when
 * loaded; English readers always get the English copy (admin templates are Georgian).
 */
export function pickCycleReminderCopy(
  key: string,
  opts: { en: boolean; cautious?: boolean; cached?: { title?: string | null; body?: string | null } | null },
): { title: string; body: string } {
  const table = opts.en ? CYCLE_REMINDER_COPY_EN : CYCLE_REMINDER_COPY_KA;
  const own = table[key as CycleReminderTemplateKey] ?? table['cycle-masked'];
  if (!opts.en && isCustomisedCycleTemplate(key, opts.cached) && opts.cached) {
    return { title: String(opts.cached.title ?? own.title), body: String(opts.cached.body ?? own.body) };
  }
  return { title: own.title, body: opts.cautious && own.bodyCautious ? own.bodyCautious : own.body };
}

/** Words the default-on reminders must never carry (ka + en stems). */
export const CYCLE_SENSITIVE_REMINDER_WORDS = Object.freeze([
  'ნაყოფიერ',
  'ოვულაც',
  'სექს',
  'ლიბიდო',
  'გამონადენ',
  'fertil',
  'ovulat',
  'sex',
  'libido',
  'discharge',
]);

export function mentionsSensitiveCycleWord(text: string): boolean {
  const hay = String(text ?? '').toLowerCase();
  return CYCLE_SENSITIVE_REMINDER_WORDS.some((w) => hay.includes(w));
}

/** The `{days}` value for the period-soon reminder: "2" in Georgian, "2 days" / "1 day" in English. */
export function periodSoonDaysVar(days: number, en: boolean): string {
  const n = Math.max(1, Math.round(days));
  if (!en) return String(n);
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}
