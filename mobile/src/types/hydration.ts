export type HydrationContainer = 'small' | 'medium' | 'large';
export type HydrationDrink = 'water' | 'coffee' | 'tea' | 'other';
export type HydrationPeriod = '1d' | '1w' | '1m' | '1y' | 'all';

export type HydrationLog = {
  id: string;
  date: string;
  at: string;
  ml: number;
  container: HydrationContainer;
  drink: HydrationDrink;
  color: string;
};

export type HydrationLevel = 1 | 2 | 3 | 4 | 5;

export const HYDRATION_CONTAINERS: {
  key: HydrationContainer;
  ml: number;
  oz: string;
}[] = [
  { key: 'small', ml: 200, oz: '6.8 fl oz' },
  { key: 'medium', ml: 350, oz: '11.8 fl oz' },
  { key: 'large', ml: 700, oz: '23.7 fl oz' },
];

export const HYDRATION_COLORS = [
  '#1F2937',
  '#14B8A6',
  '#F43F5E',
  '#F59E0B',
  '#22C55E',
  '#A855F7',
  '#14B8A6',
  '#F97316',
  '#6366F1',
] as const;

export const DEFAULT_HYDRATION_GOAL_ML = 2000;
export const HYDRATION_DROP_ML = 250;
export const HYDRATION_GLASS_MAX_ML = 2500;
