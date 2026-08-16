import { useColorScheme } from 'nativewind';

/** Soft blush / lavender palette — Flo-inspired women's health. */
export const cycleLight = {
  blush: '#F7C6D0',
  blushDeep: '#E891A3',
  rose: '#D4738A',
  roseSoft: '#F9E4EA',
  lavender: '#A78BDB',
  lavenderSoft: '#EDE6F8',
  peach: '#F3D5C0',
  mint: '#B8E0D8',
  cream: '#FBF6F4',
  creamDeep: '#F3E8E4',
  ink: '#2F2228',
  muted: '#8A6F78',
  mutedSoft: '#B5A0A8',
  period: '#E5738A',
  fertile: '#9B7EDE',
  ovulation: '#7C5CBF',
  todayRing: '#26A69A',
  card: '#FFFFFF',
  cardSoft: '#FFFCFB',
  fab: '#E891A3',
  border: 'rgba(61, 44, 50, 0.06)',
  shadow: '#D4738A',
  danger: '#C62B3F',
  success: '#2D9B7F',
  white: '#FFFFFF',
  overlay: 'rgba(47, 34, 40, 0.35)',
};

export const cycleDark = {
  blush: '#5A3340',
  blushDeep: '#C97B8C',
  rose: '#E891A3',
  roseSoft: '#3A2830',
  lavender: '#B8A4E8',
  lavenderSoft: '#2A2438',
  peach: '#4A3A32',
  mint: '#2A4A45',
  cream: '#141014',
  creamDeep: '#1C1518',
  ink: '#F8ECF0',
  muted: '#B59AA3',
  mutedSoft: '#7A6570',
  period: '#E891A3',
  fertile: '#B8A4E8',
  ovulation: '#D4C4FF',
  todayRing: '#2dbeaf',
  card: '#1E161A',
  cardSoft: '#241C20',
  fab: '#E891A3',
  border: 'rgba(245, 232, 236, 0.08)',
  shadow: '#000000',
  danger: '#F07178',
  success: '#4DB6A0',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export type CyclePalette = typeof cycleLight;

export function useCycleColors(): CyclePalette {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? cycleDark : cycleLight;
}

export const cycleShadow = {
  soft: {
    shadowColor: '#D4738A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  fab: {
    shadowColor: '#D4738A',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  card: {
    shadowColor: '#3D2C32',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
