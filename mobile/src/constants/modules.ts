import {
  Bot,
  CalendarClock,
  CalendarHeart,
  FlaskConical,
  ScanLine,
  Sparkles,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { ka } from '@/i18n/ka';

export type ModuleTile = {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  href: string;
  /** Tailwind classes for the icon tile — each module gets its own tint. */
  tint: string;
  iconColor: string;
  /** When set, tile only shows for this gender. */
  gender?: 'FEMALE' | 'MALE';
};

export const MODULE_TILES: ModuleTile[] = [
  {
    key: 'doctor',
    title: ka.modules.doctor.title,
    subtitle: ka.modules.doctor.subtitle,
    icon: Bot,
    href: '/chat/doctor',
    tint: 'bg-primary-200',
    iconColor: '#ffffff',
  },
  {
    key: 'cycle',
    title: ka.modules.cycle.title,
    subtitle: ka.modules.cycle.subtitle,
    icon: CalendarHeart,
    href: '/cycle',
    tint: 'bg-[#F7C6D0]',
    iconColor: '#D4738A',
    gender: 'FEMALE',
  },
  {
    key: 'lab',
    title: ka.modules.lab.title,
    subtitle: ka.modules.lab.subtitle,
    icon: FlaskConical,
    href: '/module/lab',
    tint: 'bg-accent-100/60',
    iconColor: '#26A69A',
  },
  {
    key: 'imaging',
    title: ka.modules.imaging.title,
    subtitle: ka.modules.imaging.subtitle,
    icon: ScanLine,
    href: '/module/imaging',
    tint: 'bg-accent-100/60',
    iconColor: '#26A69A',
  },
  {
    key: 'skin',
    title: ka.modules.skin.title,
    subtitle: ka.modules.skin.subtitle,
    icon: Stethoscope,
    href: '/module/skin',
    tint: 'bg-accent-100/60',
    iconColor: '#26A69A',
  },
  {
    key: 'skincare',
    title: ka.modules.skincare.title,
    subtitle: ka.modules.skincare.subtitle,
    icon: Sparkles,
    href: '/module/skincare',
    tint: 'bg-accent-100/60',
    iconColor: '#26A69A',
  },
  {
    key: 'consilium',
    title: ka.modules.consilium.title,
    subtitle: ka.modules.consilium.subtitle,
    icon: Users,
    href: '/chat/consilium',
    tint: 'bg-accent-100/60',
    iconColor: '#26A69A',
  },
  {
    key: 'calendar',
    title: ka.modules.calendar.title,
    subtitle: ka.modules.calendar.subtitle,
    icon: CalendarClock,
    href: '/(tabs)/medications',
    tint: 'bg-accent-100/60',
    iconColor: '#26A69A',
  },
];

export function modulesForGender(gender: string | null | undefined): ModuleTile[] {
  return MODULE_TILES.filter((tile) => !tile.gender || tile.gender === gender);
}
