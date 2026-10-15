import {
  Activity, Brain, Dumbbell, Eye, FlaskConical, Glasses, HandMetal, HeartPulse, Scissors, Sparkles, Stethoscope, Syringe, Waves, type LucideIcon,
} from 'lucide-react-native';
import { tx } from '../../i18n/locale.js';
import type { BookCategoryId } from './bookTypes';

export type BookCategoryMeta = { id: BookCategoryId; label: string; short: string; color: string; icon: LucideIcon };

/** Mirrors server/src/lib/book/catalog.js CATEGORIES (labels, pin colours); icons are the app's. */
export const BOOK_CATEGORIES: readonly BookCategoryMeta[] = [
  { id: 'DENTAL', label: tx('სტომატოლოგია', 'Dental'), short: tx('სტომატოლოგია', 'Dental'), color: '#0EA5E9', icon: Stethoscope },
  { id: 'BEAUTY', label: tx('სილამაზის სალონი', 'Beauty salon'), short: tx('სილამაზე', 'Beauty'), color: '#EC4899', icon: Sparkles },
  { id: 'HAIR', label: tx('თმა და ბარბერი', 'Hair and barber'), short: tx('თმა', 'Hair'), color: '#F59E0B', icon: Scissors },
  { id: 'NAILS', label: tx('ფრჩხილები', 'Nails'), short: tx('ფრჩხილები', 'Nails'), color: '#F472B6', icon: HandMetal },
  { id: 'AESTHETIC', label: tx('ესთეტიკა და კოსმეტოლოგია', 'Aesthetics and cosmetology'), short: tx('ესთეტიკა', 'Aesthetics'), color: '#A21CAF', icon: Syringe },
  { id: 'SPA', label: tx('სპა და მასაჟი', 'Spa and massage'), short: tx('სპა', 'Spa'), color: '#14B8A6', icon: Waves },
  { id: 'CLINIC', label: tx('კლინიკა და ექიმები', 'Clinics and doctors'), short: tx('კლინიკა', 'Clinic'), color: '#2563EB', icon: HeartPulse },
  { id: 'FITNESS', label: tx('ფიტნესი და იოგა', 'Fitness and yoga'), short: tx('ფიტნესი', 'Fitness'), color: '#22C55E', icon: Dumbbell },
  { id: 'OPTICS', label: tx('ოპტიკა', 'Optics'), short: tx('ოპტიკა', 'Optics'), color: '#6366F1', icon: Glasses },
  { id: 'LAB', label: tx('ლაბორატორია', 'Laboratory'), short: tx('ლაბორატორია', 'Lab'), color: '#4F46E5', icon: FlaskConical },
  { id: 'MIND', label: tx('ფსიქოლოგი', 'Psychology'), short: tx('ფსიქოლოგი', 'Psychology'), color: '#8B5CF6', icon: Brain },
  { id: 'PHYSIO', label: tx('ფიზიოთერაპია', 'Physiotherapy'), short: tx('ფიზიო', 'Physio'), color: '#0D9488', icon: Activity },
  { id: 'TATTOO', label: tx('ტატუ და პირსინგი', 'Tattoo and piercing'), short: tx('ტატუ', 'Tattoo'), color: '#374151', icon: Eye },
  { id: 'OTHER', label: tx('სხვა', 'Other'), short: tx('სხვა', 'Other'), color: '#64748B', icon: Sparkles },
];

const BY_ID = new Map(BOOK_CATEGORIES.map((c) => [c.id, c]));

export function bookCategory(id: string | null | undefined): BookCategoryMeta {
  return BY_ID.get(String(id ?? '').toUpperCase() as BookCategoryId) ?? BY_ID.get('OTHER')!;
}

/** The chips on the hub and the map (every category but „other“). */
export const BOOK_CATEGORY_CHIPS = BOOK_CATEGORIES.filter((c) => c.id !== 'OTHER');
