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

export type PrimerKind = 'notifications' | 'health' | 'location';

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
    body: 'მდებარეობით განვსაზღვრავთ შენს ქალაქს, რომ ადგილობრივი ამინდი და ახლომახლო აფთიაქები გაჩვენოთ. GPS-ს მხოლოდ აპის გამოყენებისას ვიყენებთ. შემდეგ ტელეფონი გკითხავს, გინდა თუ არა წვდომის მიცემა.',
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
    body: 'Your location sets your city so we can show local weather and nearby pharmacies. It is used only while you use the app. Next, your device will ask whether MEDICARD may access your location.',
    cta: 'Continue',
  },
};

export function primerCopy(kind: PrimerKind, lang: AppLang = appLang()): PrimerCopy {
  const copy = (lang === 'en' ? EN : KA)[kind];
  if (kind !== 'health' || Platform.OS !== 'android') return copy;
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
