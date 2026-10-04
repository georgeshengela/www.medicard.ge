/**
 * Copy for the screens shown right before an OS permission sheet.
 *
 * App Review 5.1.1(iv), 2026-09-27: a message before a permission request must
 * have one button, worded "Continue"/"Next" (never "Allow"), and that button must
 * always go on to the system sheet. No "Not now", "Later", "Skip", close button or
 * tap-outside dismissal before the request. The person says yes or no in the
 * system sheet itself. The copy follows the app language (Georgian / English).
 */
import { Platform } from 'react-native';
import { appLang, type AppLang } from '../i18n/locale.js';
import { getPreference, setPreference } from '@/lib/storage';

export type PrimerKind = 'notifications' | 'health' | 'location' | 'temperature';

type PrimerCopy = { title: string; body: string; cta: string };

const KA: Record<PrimerKind, PrimerCopy> = {
  notifications: {
    title: 'შეტყობინებები',
    body: 'შეტყობინებებით დროულად მიიღებ შენ მიერ ჩართულ შეხსენებებს: წამლის მიღებას, ვიზიტებს და მნიშვნელოვან განახლებებს. შემდეგ ტელეფონი გკითხავს, გინდა თუ არა შეტყობინებების მიღება. არჩევანის შეცვლა ნებისმიერ დროს შეგიძლია პარამეტრებში.',
    cta: 'გაგრძელება',
  },
  health: {
    title: 'Apple Health',
    body: 'MEDICARD-ს შეუძლია Apple Health-იდან წაიკითხოს ნაბიჯები, წონა, წნევა, პულსი, ძილი და ციკლის ჩანაწერები, რომ ისინი აქ ხელით არ შეიყვანო. შემდეგ Apple Health გაჩვენებს ფანჯარას, სადაც თავად აირჩევ, რა გააზიარო, ან არაფერი. არჩევანის შეცვლა ნებისმიერ დროს შეგიძლია Health აპის პარამეტრებში.',
    cta: 'გაგრძელება',
  },
  location: {
    title: 'რომელ ქალაქში ხარ?',
    body: 'მდებარეობით განვსაზღვრავთ შენს ქალაქს, რომ ადგილობრივი ამინდი გაჩვენოთ. GPS-ს მხოლოდ აპის გამოყენებისას ვიყენებთ. შემდეგ ტელეფონი გკითხავს, გინდა თუ არა წვდომის მიცემა.',
    cta: 'გაგრძელება',
  },
  // Cycle settings → პროფილი (train 1.0.0.20): BBT + wrist / skin temperature, read only.
  temperature: {
    title: 'ტემპერატურა Apple Health-იდან',
    body: 'MEDICARD-ს შეუძლია Apple Health-იდან წაიკითხოს საბაზისო ტემპერატურა (BBT) და ძილის დროს მაჯის ტემპერატურა ბოლო 40 დღიდან, რომ ციკლის გვერდზე ოვულაცია სავარაუდოდ, რეტროსპექტულად გაჩვენოს. ისინი მხოლოდ შენს ციკლის ჩანაწერებში ინახება და Medi-ს, პარტნიორს ან ანალიტიკას არ გადაეცემა. შემდეგ Apple Health გაჩვენებს ფანჯარას, სადაც თავად აირჩევ, რა გააზიარო, ან არაფერი.',
    cta: 'გაგრძელება',
  },
};

const EN: Record<PrimerKind, PrimerCopy> = {
  notifications: {
    title: 'Notifications',
    body: 'Notifications deliver the reminders you turn on: medication times, visits and important updates. Next, your device will ask whether MEDICARD may send notifications. You can change this at any time in Settings.',
    cta: 'Continue',
  },
  health: {
    title: 'Apple Health',
    body: 'MEDICARD can read steps, weight, blood pressure, heart rate, sleep and cycle records from Apple Health so you do not have to type them in. Next, Apple Health will show a screen where you choose what to share, or nothing. You can change this at any time in the Health app.',
    cta: 'Continue',
  },
  location: {
    title: 'Which city are you in?',
    body: 'Your location sets your city so we can show local weather. It is used only while you use the app. Next, your device will ask whether MEDICARD may access your location.',
    cta: 'Continue',
  },
  temperature: {
    title: 'Temperature from Apple Health',
    body: 'MEDICARD can read your basal body temperature (BBT) and sleeping wrist temperature from the last 40 days in Apple Health to show a likely, in-hindsight ovulation estimate on the cycle page. They are kept only in your cycle log and never shared with Medi, a partner or analytics. Next, Apple Health will show a screen where you choose what to share, or nothing.',
    cta: 'Continue',
  },
};

export function primerCopy(kind: PrimerKind, lang: AppLang = appLang()): PrimerCopy {
  const copy = (lang === 'en' ? EN : KA)[kind];
  if ((kind !== 'health' && kind !== 'temperature') || Platform.OS !== 'android') return copy;
  if (kind === 'temperature') {
    // Health Connect has skin temperature (a deviation), not Apple's sleeping wrist temperature.
    return {
      ...copy,
      title: copy.title.replace('Apple Health', 'Health Connect'),
      body: copy.body.replace(/Apple Health-იდან/g, 'Health Connect-იდან').replace(/Apple Health/g, 'Health Connect')
        .replace('ძილის დროს მაჯის ტემპერატურა', 'კანის ტემპერატურა').replace('sleeping wrist temperature', 'skin temperature'),
    };
  }
  // Same wording, Android's store: Health Connect instead of Apple Health / the Health app.
  return {
    ...copy,
    title: 'Health Connect',
    body: copy.body.replace(/Apple Health-იდან/g, 'Health Connect-იდან').replace(/Apple Health/g, 'Health Connect')
      .replace('Health აპის', 'Health Connect-ის').replace('the Health app', 'Health Connect'),
  };
}

/** After a denial the system sheet is done; the person may close our screen now. */
export function primerCloseLabel(lang: AppLang = appLang()): string {
  return lang === 'en' ? 'Close' : 'დახურვა';
}

export function primerSettingsLabel(lang: AppLang = appLang()): string {
  return lang === 'en' ? 'Open Settings' : 'პარამეტრების გახსნა';
}

const askedKey = (kind: PrimerKind) => `permissionPrimer.asked.${kind}`;

/** The OS sheet was shown for this kind on this device; never prime it again. */
export async function markPrimerAsked(kind: PrimerKind): Promise<void> {
  await setPreference(askedKey(kind), '1').catch(() => undefined);
}

export async function wasPrimerAsked(kind: PrimerKind): Promise<boolean> {
  return (await getPreference(askedKey(kind)).catch(() => null)) === '1';
}
