import { api } from '@/lib/api';
import { ENGAGE_FALLBACKS } from '@/lib/mediEngageCopy';
import { redactCyclePushLog } from '@/lib/cycleNotificationContract.js';
import { getToken } from '@/lib/storage';
import { isEn, tx } from '../i18n/locale.js';

export type PushTemplate = {
  key: string;
  group: string;
  label: string;
  title: string;
  body: string;
  placeholders: string[];
  /** False when the server sends its own code default (no admin edit). */
  custom?: boolean;
};

const FALLBACKS_KA: Record<string, { title: string; body: string }> = {
  medication: {
    title: '{name}-ის დროა 💊',
    body: 'არ დაგავიწყდეს შენი {name} {dosage} 🤍 Medi შეგახსენებს, რომ საკუთარ თავზე ზრუნვის დროა.',
  },
  'med-refill': {
    title: '{name} ხომ არ გვითავდება? 👀',
    body: 'მგონი {name}-ის მარაგის შემოწმების დროა. გადაავლე თვალი, რომ საჭირო დროს ხელთ გქონდეს 💚',
  },
  // Cycle reminders are scheduled from cycleReminderCopy.ts; these fallbacks mirror it (brief §9 item 5).
  'cycle-period-soon': {
    title: 'მენსტრუაცია სავარაუდოდ {days} დღეში 🌸',
    body: 'შენი ბოლო ციკლების მიხედვით. ეს შეფასებაა — Medi მხოლოდ შეგახსენებს 💗',
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
  },
  'cycle-fertile': {
    title: 'სავარაუდო ნაყოფიერი ფანჯარა 🌱',
    body: 'შენი სავარაუდო ნაყოფიერი ფანჯარა შეიძლება იწყებოდეს. ეს კალენდარული შეფასებაა — პროგნოზი შეიძლება შეიცვალოს 🤍',
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
  'cycle-tip': {
    title: 'Medi-სგან შენთვის 💚',
    body: 'დღეს შენთვის პატარა რჩევა მაქვს. შემომიარე, როცა დრო გექნება ✨',
  },
  'cycle-masked': {
    title: 'Medi-სგან შეხსენება',
    body: 'როცა დრო გექნება, შემომიარე 💚',
  },
  'pregnancy-care-plan': {
    title: 'შეხსენება',
    body: 'შეგახსენებ: შენ დაგეგმე {item} {when}.',
  },
  'pregnancy-care-masked': {
    title: 'Medi-სგან შეხსენება',
    body: 'შენი დაგეგმილი მოვლის შეხსენება',
  },
  'pet-care': {
    title: '{pet} · {item}',
    body: 'დაგეგმილი მოვლის დღეა. გახსენი და დაადასტურე.',
  },
  'pet-care-masked': {
    title: 'Medi-სგან შეხსენება',
    body: 'შენი დაგეგმილი მოვლის შეხსენება',
  },
  visit: {
    title: 'ვიზიტი არ დაგავიწყდეს 🩺',
    body: 'დღეს {time}-ზე {doctor}-თან ვიზიტი გაქვს{place}. ყველაფერი მზად გაქვს? Medi უბრალოდ შეგახსენებს 💚',
  },
  steps: {
    title: 'ცოტაც და მიზანთან ხარ 👟',
    body: 'დღეს უკვე {steps} ნაბიჯი გაქვს. პატარა გასეირნება და კიდევ უფრო მიუახლოვდები შენს მიზანს 💚',
  },
  'nutrition-breakfast': {
    title: 'საუზმე ჩაწერე? 🍳',
    body: 'ერთი ფოტო ან ორი სიტყვა — და დღის ბალანსი უკვე შენს ხელშია. Medi 💚',
  },
  'nutrition-lunch': {
    title: 'სადილის დროა 🥗',
    body: 'რას მიირთმევ? გადაიღე, ჩაწერე ან უბრალოდ მითხარი — მე დავითვლი.',
  },
  'fasting-goal': {
    title: '{hours} საათი შესრულდა ⏱️',
    body: 'შიმშილის მიზანს მიაღწიე. დაასრულე ტაიმერი, როცა ჭამას დაიწყებ — ნელა და მშვიდად 💚',
  },
  'nutrition-dinner': {
    title: 'ვახშამი და დღის შეჯამება 🌙',
    body: 'დაასრულე დღე ერთი ჩანაწერით — სერია და პროგრესი შენს მხარესაა 💚',
  },
  weight: {
    title: 'წონის ჩანაწერი? ⚖️',
    body: 'თუ დღეს წონის დაფიქსირება გინდოდა, შეგიძლია Medi-ში ჩაინიშნო — ბოლო მონაცემი: {kg} კგ. არანაირი წნეხი 🤍',
  },
  'admin-push': {
    title: 'მე ვარ, Medi 💚',
    body: 'შენთვის პატარა ამბავი მაქვს.',
  },
  'quota-reset': {
    title: 'Medi ისევ შენთანაა ✨',
    body: 'შენი AI ლიმიტი განახლდა — დღეს {limit} შეკითხვა გაქვს. ჰკითხე რაც გინდა 💬',
  },
  'quota-reset-lock': {
    title: '24 საათი გავიდა 💚',
    body: 'ისევ შეგიძლია Medi-სთან საუბარი — {limit} შეკითხვა გელოდება. დავიწყოთ?',
  },
};

const FALLBACKS_EN: Record<string, { title: string; body: string }> = {
  medication: {
    title: 'Time for {name} 💊',
    body: "Don't forget your {name} {dosage} 🤍 Medi is here to remind you it's time to look after yourself.",
  },
  'med-refill': {
    title: 'Running low on {name}? 👀',
    body: "It might be time to check your {name} supply. Take a look so you have it when you need it 💚",
  },
  'cycle-period-soon': {
    title: 'Period estimated in {days} 🌸',
    body: 'Based on your recent cycles. This is an estimate — Medi is just reminding you 💗',
  },
  'cycle-period-start': {
    title: 'Period estimated today 🌷',
    body: "If it doesn't start today, that's okay — cycles don't always follow the calendar exactly 🤍",
  },
  'cycle-period-late': {
    title: 'The estimated date has passed — everything okay? 🤍',
    body: 'No period logged yet. If it started, log it with one tap — if not, this cycle may simply be longer.',
  },
  'cycle-ovulation': {
    title: 'Estimated ovulation is coming up ✨',
    body: "By the calendar, your estimated ovulation day is getting close. This is an estimate — cycles don't always follow the calendar exactly 🤍",
  },
  'cycle-fertile': {
    title: 'Estimated fertile window 🌱',
    body: 'Your estimated fertile window may be starting. This is a calendar estimate — the forecast can change 🤍',
  },
  'cycle-pms': {
    title: 'PMS may be on its way 🌙',
    body: 'If you feel a little different today, your cycle suggests PMS may be coming up. Listen to your body 🤍',
  },
  'cycle-opk': {
    title: 'Time for your OPK test 🧪',
    body: "If you're using ovulation tests this cycle, don't forget today's OPK 💗",
  },
  'cycle-bbt': {
    title: 'Good morning ☀️ BBT?',
    body: "Before you get up and start your day, don't forget to take your basal temperature 🌡️",
  },
  'cycle-log': {
    title: 'How are you today? 💚',
    body: 'A minute for Medi? Note how your day went — symptoms, mood and whatever matters to you.',
  },
  'cycle-tip': {
    title: 'From Medi, for you 💚',
    body: 'I have a small tip for you today. Stop by when you have a moment ✨',
  },
  'cycle-masked': {
    title: 'A reminder from Medi',
    body: 'Stop by when you have a moment 💚',
  },
  'pregnancy-care-plan': {
    title: 'Reminder',
    body: 'Just a reminder: you planned {item} {when}.',
  },
  'pregnancy-care-masked': {
    title: 'A reminder from Medi',
    body: 'Your planned care reminder',
  },
  'pet-care': {
    title: '{pet} · {item}',
    body: 'A care task is planned for today. Open the app to confirm it.',
  },
  'pet-care-masked': {
    title: 'A reminder from Medi',
    body: 'Your planned care reminder',
  },
  visit: {
    title: "Don't forget your visit 🩺",
    body: 'You have a visit with {doctor} today at {time}{place}. All set? Medi is just reminding you 💚',
  },
  steps: {
    title: "You're close to your goal 👟",
    body: 'You have {steps} steps so far today. A short walk will bring you even closer to your goal 💚',
  },
  'nutrition-breakfast': {
    title: 'Logged breakfast? 🍳',
    body: "One photo or a couple of words — and your day's balance is in your hands. Medi 💚",
  },
  'nutrition-lunch': {
    title: 'Lunchtime 🥗',
    body: "What are you having? Snap it, type it or just tell me — I'll do the counting.",
  },
  'fasting-goal': {
    title: '{hours} hours done ⏱️',
    body: 'You reached your fasting goal. End the timer when you start eating — slowly and calmly 💚',
  },
  'nutrition-dinner': {
    title: 'Dinner and your day in review 🌙',
    body: 'Finish the day with one entry — your streak and progress are on your side 💚',
  },
  weight: {
    title: 'Log your weight? ⚖️',
    body: 'If you wanted to log your weight today, you can do it in Medi — last entry: {kg} kg. No pressure 🤍',
  },
  'admin-push': {
    title: "It's me, Medi 💚",
    body: 'I have a little news for you.',
  },
  'quota-reset': {
    title: 'Medi is back with you ✨',
    body: 'Your AI limit has reset — you have {limit} questions today. Ask anything 💬',
  },
  'quota-reset-lock': {
    title: '24 hours have passed 💚',
    body: 'You can talk to Medi again — {limit} questions are waiting. Shall we start?',
  },
};

const FALLBACKS: Record<string, { title: string; body: string }> = tx(FALLBACKS_KA, FALLBACKS_EN);

let cache: Record<string, PushTemplate> | null = null;

const hasGeorgian = (text: string | undefined) => /[\u10A0-\u10FF]/.test(String(text ?? ''));

function isBlank(value: string | number | undefined | null): boolean {
  return value == null || String(value).trim() === '';
}

export function tidyPushCopy(text: string): string {
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
    // English templates: the same clean-up when a value is missing, plus singular units.
    .replace(/\bTime for (?=[^\p{L}\p{N}\s]|$)/u, 'Time for your medication ')
    .replace(/\bforget your (?=[^\p{L}\p{N}\s])/u, 'forget your medication ')
    .replace(/\blow on\?/, 'low on your medication?')
    .replace(/\bwith today\b/, 'with your doctor today')
    .replace(/ at(?=[.,!?]| [—–])/, '')
    .replace(/\bYou have steps so far today\./, 'Your steps are adding up today.')
    .replace(/ ?— last entry: kg\.?/, '.')
    .replace(/\bmorning, (?=[^\p{L}\p{N}\s]|$)/u, 'morning ')
    .replace(/\b1 (day|hour|question)s\b/g, '1 $1')
    .trim();
}

function interpolateValue(value: string | number | undefined | null): string {
  if (isBlank(value)) return '';
  const raw = String(value);
  const trimmed = raw.trim();
  if (/^[—–-]/.test(trimmed) && /^\s/.test(raw)) return ` ${trimmed}`;
  return trimmed;
}

export function interpolatePushCopy(
  text: string,
  vars: Record<string, string | number | undefined> = {},
): string {
  const filled = String(text ?? '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => interpolateValue(vars[key]));
  return tidyPushCopy(filled);
}

/** Admin-edited copy changes rarely: read at most every 10 minutes, and only when signed in. */
const TEMPLATES_TTL_MS = 10 * 60_000;
let templatesAt = 0;
let templatesInFlight: Promise<void> | null = null;

export async function loadPushTemplates(opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force && Date.now() - templatesAt < TEMPLATES_TTL_MS) return;
  if (templatesInFlight) return templatesInFlight;
  templatesInFlight = (async () => {
    try {
      if (!(await getToken())) return; // signed out: the endpoint answers 401, fallbacks are fine
      const { templates } = await api.push.templates();
      cache = Object.fromEntries((templates ?? []).map((row) => [row.key, row]));
      templatesAt = Date.now();
    } catch {
      // keep previous cache / fallbacks; a failure also waits out the TTL instead of retrying at once
      templatesAt = Date.now();
    } finally {
      templatesInFlight = null;
    }
  })();
  return templatesInFlight;
}

/** The admin template as last loaded from the server, or null while none is cached. */
export function getCachedPushTemplate(key: string): PushTemplate | null {
  return cache?.[key] ?? null;
}

export function applyPushCopy(
  key: string,
  vars: Record<string, string | number | undefined> = {},
): { title: string; body: string } {
  const cached = cache?.[key];
  // Admin-edited templates are Georgian; English users keep the English fallback copy.
  const row = cached && isEn() && (hasGeorgian(cached.title) || hasGeorgian(cached.body)) ? undefined : cached;
  const fallback = FALLBACKS[key] ?? ENGAGE_FALLBACKS[key] ?? {
    title: tx('მე ვარ, Medi 💚', "It's me, Medi 💚"),
    body: tx('შენთვის პატარა შენიშვნა მაქვს.', 'I have a small note for you.'),
  };
  return {
    title: interpolatePushCopy(row?.title ?? fallback.title, vars),
    body: interpolatePushCopy(row?.body ?? fallback.body, vars),
  };
}

export function previewPushCopy(key: string): { title: string; body: string } {
  return applyPushCopy(key, {
    name: tx('ასპირინი', 'Aspirin'),
    firstName: tx('ნინო', 'Nino'),
    dosage: tx('1 ტაბლეტი', '1 tablet'),
    days: 2,
    doctor: tx('თერაპევტი', 'your internist'),
    time: '14:30',
    place: tx(' — კლინიკა', ' — clinic'),
    steps: '6,200',
    kg: 70,
    item: tx('ანატომიის ულტრაბგერა', 'the anatomy scan'),
    when: tx('ხვალ', 'tomorrow'),
  });
}

export async function logPushEvent(opts: {
  source: 'local' | 'qa' | 'broadcast';
  key: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    await api.push.logEvent({ source: opts.source, ...redactCyclePushLog(opts) });
  } catch {
    /* admin log is best-effort */
  }
}
