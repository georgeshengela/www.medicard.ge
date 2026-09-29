import { api } from '@/lib/api';
import { ENGAGE_FALLBACKS } from '@/lib/mediEngageCopy';
import { redactCyclePushLog } from '@/lib/cycleNotificationContract.js';
import { getToken } from '@/lib/storage';

export type PushTemplate = {
  key: string;
  group: string;
  label: string;
  title: string;
  body: string;
  placeholders: string[];
};

const FALLBACKS: Record<string, { title: string; body: string }> = {
  medication: {
    title: '{name}-ის დროა 💊',
    body: 'არ დაგავიწყდეს შენი {name} {dosage} 🤍 Medi შეგახსენებს, რომ საკუთარ თავზე ზრუნვის დროა.',
  },
  'med-refill': {
    title: '{name} ხომ არ გვითავდება? 👀',
    body: 'მგონი {name}-ის მარაგის შემოწმების დროა. გადაავლე თვალი, რომ საჭირო დროს ხელთ გქონდეს 💚',
  },
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
    body: 'დაასრულე დღე ერთი ჩანაწერით — streak-ი და პროგრესი შენს მხარესაა 💚',
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

let cache: Record<string, PushTemplate> | null = null;

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

export function applyPushCopy(
  key: string,
  vars: Record<string, string | number | undefined> = {},
): { title: string; body: string } {
  const row = cache?.[key];
  const fallback = FALLBACKS[key] ?? ENGAGE_FALLBACKS[key] ?? { title: 'მე ვარ, Medi 💚', body: 'შენთვის პატარა შენიშვნა მაქვს.' };
  return {
    title: interpolatePushCopy(row?.title ?? fallback.title, vars),
    body: interpolatePushCopy(row?.body ?? fallback.body, vars),
  };
}

export function previewPushCopy(key: string): { title: string; body: string } {
  return applyPushCopy(key, {
    name: 'ასპირინი',
    firstName: 'ნინო',
    dosage: '1 ტაბლეტი',
    days: 2,
    doctor: 'თერაპევტი',
    time: '14:30',
    place: ' — კლინიკა',
    steps: '6,200',
    kg: 70,
    item: 'ანატომიის ულტრაბგერა',
    when: 'ხვალ',
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
