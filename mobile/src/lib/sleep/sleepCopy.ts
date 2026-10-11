import {
  Baby, BedSingle, Brain, Coffee, Droplet, Dumbbell, Plane, Smartphone, Thermometer, ThermometerSun,
  UtensilsCrossed, Volume2, Wine, Zap, type LucideIcon,
} from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import type { SleepCategory, SleepFactor, SleepRegularityBand, SleepScoreBand, SleepTimesSource } from './sleepTypes';

/** MEDISLEEP words in one place (ka + en). Server labels for Medi/admin live in server/src/lib/sleep.js. */

export const FACTOR_COPY: Record<SleepFactor, { label: string; icon: LucideIcon }> = {
  caffeine: { label: tx('ყავა ან ჩაი გვიან', 'Late coffee or tea'), icon: Coffee },
  alcohol: { label: tx('ალკოჰოლი', 'Alcohol'), icon: Wine },
  late_meal: { label: tx('გვიანი ვახშამი', 'Late dinner'), icon: UtensilsCrossed },
  screens: { label: tx('ეკრანი საწოლში', 'Screens in bed'), icon: Smartphone },
  stress: { label: tx('სტრესი', 'Stress'), icon: Brain },
  exercise: { label: tx('ვარჯიში', 'Exercise'), icon: Dumbbell },
  nap: { label: tx('დღის ძილი', 'Daytime nap'), icon: BedSingle },
  noise: { label: tx('ხმაური', 'Noise'), icon: Volume2 },
  pain: { label: tx('ტკივილი', 'Pain'), icon: Zap },
  illness: { label: tx('ავად ვიყავი', 'Feeling ill'), icon: Thermometer },
  period: { label: tx('მენსტრუაცია', 'Period'), icon: Droplet },
  kids: { label: tx('ბავშვმა გამაღვიძა', 'Woken by a child'), icon: Baby },
  heat: { label: tx('სიცხე ოთახში', 'Warm room'), icon: ThermometerSun },
  travel: { label: tx('მოგზაურობა', 'Travel'), icon: Plane },
};

/** 1…5, same words as the server and the registration question family. */
export const QUALITY_COPY: Record<number, string> = {
  1: tx('ძალიან ცუდად', 'Very badly'),
  2: tx('ცუდად', 'Badly'),
  3: tx('საშუალოდ', 'So-so'),
  4: tx('კარგად', 'Well'),
  5: tx('ძალიან კარგად', 'Very well'),
};

export const SCORE_BAND_COPY: Record<SleepScoreBand, string> = {
  great: tx('შესანიშნავი', 'Excellent'),
  good: tx('კარგი', 'Good'),
  fair: tx('საშუალო', 'Fair'),
  low: tx('დაბალი', 'Low'),
};

export const REGULARITY_COPY: Record<SleepRegularityBand, { label: string; note: string }> = {
  steady: { label: tx('ძალიან თანაბარი', 'Very steady'), note: tx('ყოველ ღამე თითქმის ერთსა და იმავე დროს გძინავს.', 'You sleep at almost the same time every night.') },
  regular: { label: tx('თანაბარი', 'Steady'), note: tx('რიტმი კარგია — ერთი საათის ფარგლებში.', 'A good rhythm — within an hour.') },
  variable: { label: tx('ცვალებადი', 'Variable'), note: tx('ძილის დრო ღამიდან ღამემდე იცვლება.', 'Your sleep time moves from night to night.') },
  irregular: { label: tx('არათანაბარი', 'Irregular'), note: tx('ძილის დრო ბევრს იცვლება — რიტმი ხანგრძლივობაზე არანაკლებ მნიშვნელოვანია.', 'Your sleep time moves a lot — rhythm matters as much as length.') },
};

export const SOURCE_COPY: Record<SleepTimesSource, string> = {
  mode: tx('ძილის რეჟიმიდან', 'From sleep mode'),
  manual: tx('შენ ჩაწერე', 'Entered by you'),
  health: 'Apple Health / Health Connect',
};

export const CATEGORY_COPY: Record<SleepCategory, string> = {
  rain: tx('წვიმა', 'Rain'),
  nature: tx('ბუნება', 'Nature'),
  noise: tx('ხმაური', 'Noise'),
  music: tx('მელოდიები', 'Melodies'),
};

/** „საღამო მშვიდობისა“ / … for the header line by the clock. */
export function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return tx('დილა მშვიდობისა', 'Good morning');
  if (h >= 12 && h < 18) return tx('ძილი და დასვენება', 'Sleep and rest');
  if (h >= 18 && h < 22) return tx('საღამო მშვიდობისა', 'Good evening');
  return tx('ღამე მშვიდობისა', 'Good night');
}

/** Ask Medi about sleep (prefilled; Medi reads the MEDISLEEP context for these words). */
export const SLEEP_ASK_MEDI: string[] = [
  tx('რატომ ვიღვიძებ ღამით?', 'Why do I wake up at night?'),
  tx('როგორ დავიძინო უფრო ადრე?', 'How can I fall asleep earlier?'),
  tx('რა მოქმედებს ჩემს ძილზე?', 'What affects my sleep?'),
];
