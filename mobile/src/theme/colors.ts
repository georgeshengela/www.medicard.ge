import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'nativewind';
import { BRAND_ROSE, useBrandTone } from './brandTone';

/**
 * The same tokens as `global.css`, as plain values for the places React Native cannot
 * take a className — icon `color`, navigation options, `StatusBar`.
 *
 * Keep this in sync with `global.css`; that file drives every `className`, this one
 * drives every imperative prop. Surfaces stay flat — no soft shadows.
 */

export const lightColors = {
  bg100: '#f5f7f7',
  bg200: '#eaeeef',
  bg300: '#dde3e4',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',

  primary100: '#0f766e',
  primary200: '#14b8a6',
  primary300: '#2dd4bf',
  accent100: '#ccfbf1',
  accent200: '#5eead4',

  text100: '#0f1a1c',
  text200: '#46565a',
  text300: '#7b8b8f',

  success: '#0f8a5f',
  successBg: '#e3f4ec',
  warning: '#b87400',
  warningBg: '#fbf0de',
  danger: '#c62b3f',
  dangerBg: '#fbeaec',

  /** Fixed: sits on the brand fill in both themes. */
  onPrimary: '#ffffff',
  white: '#ffffff',
} as const;

export type Palette = { [K in keyof typeof lightColors]: string };

/** Cool gray-950 navy. Page `#030712` sits under cards `#111827`; brand stays `#14B8A6`. */
export const darkColors: Palette = {
  bg100: '#030712',
  bg200: '#1f2937',
  bg300: '#374151',
  surface: '#111827',
  surfaceRaised: '#1f2937',

  primary100: '#99f6e4',
  primary200: '#14b8a6',
  primary300: '#5eead4',
  accent100: '#042f2e',
  accent200: '#115e59',

  text100: '#ffffff',
  text200: '#d1d5db',
  text300: '#6b7280',

  success: '#22c55e',
  successBg: '#052e16',
  warning: '#f59e0b',
  warningBg: '#451a03',
  danger: '#f43f5e',
  dangerBg: '#4c0519',

  onPrimary: '#ffffff',
  white: '#ffffff',
};

/** Palette for the currently active scheme. Re-renders when the theme changes. */
/** The women's-Home rose over the brand tokens (brandTone.ts); built once so identities stay stable. */
const roseLight: Palette = { ...lightColors, ...BRAND_ROSE.light };
const roseDark: Palette = { ...darkColors, ...BRAND_ROSE.dark };

/**
 * A MEDI module's own accent over the brand tokens inside its pages (owner 2026-10-04: MEDIVET's
 * pages speak sky blue like its wordmark). Mounted by the module's layout (`ModuleToneProvider`);
 * canvas, surfaces and text stay shared. It wins over the women's rose inside that module.
 */
export type ModuleTone = 'vet' | 'food' | 'quest' | 'run' | 'sleep' | 'family';
type ToneTokens = { primary100: string; primary200: string; primary300: string; accent100: string; accent200: string };
const MODULE_TONES: Record<ModuleTone, { light: ToneTokens; dark: ToneTokens }> = {
  // MEDIVET (moduleBrand `vet`): #0369A1 / #7DD3FC.
  vet: {
    light: { primary100: '#0369A1', primary200: '#0284C7', primary300: '#38BDF8', accent100: '#E0F2FE', accent200: '#7DD3FC' },
    dark: { primary100: '#7DD3FC', primary200: '#38BDF8', primary300: '#0EA5E9', accent100: '#0C2A3D', accent200: '#075985' },
  },
  // MEDIQUEST (moduleBrand `quest`): #6D28D9 / #C4B5FD (owner 2026-10-04: the whole module speaks its violet).
  quest: {
    light: { primary100: '#6D28D9', primary200: '#7C3AED', primary300: '#A78BFA', accent100: '#EDE9FE', accent200: '#C4B5FD' },
    dark: { primary100: '#C4B5FD', primary200: '#A78BFA', primary300: '#8B5CF6', accent100: '#221437', accent200: '#4C1D95' },
  },
  // MEDIRUN (moduleBrand `run`): the app's own teal, kept even when the women's Home turns the brand rose
  // (owner 2026-10-04: „მედირანზე ფირუზისფერი უნდა დაიცვა“).
  run: {
    light: { primary100: '#0f766e', primary200: '#14b8a6', primary300: '#2dd4bf', accent100: '#ccfbf1', accent200: '#5eead4' },
    dark: { primary100: '#99f6e4', primary200: '#14b8a6', primary300: '#5eead4', accent100: '#042f2e', accent200: '#115e59' },
  },
  // MEDIFOOD (moduleBrand `food`): #047857 / #34D399.
  food: {
    light: { primary100: '#047857', primary200: '#059669', primary300: '#34D399', accent100: '#D1FAE5', accent200: '#6EE7B7' },
    dark: { primary100: '#34D399', primary200: '#10B981', primary300: '#6EE7B7', accent100: '#022C22', accent200: '#065F46' },
  },
  // MEDISLEEP (moduleBrand `sleep`): #8A35C2 / #D9A8FF. Always shown on its night canvas (SLEEP_NIGHT below).
  sleep: {
    light: { primary100: '#8A35C2', primary200: '#9A4FD6', primary300: '#B57BEA', accent100: '#F3E8FF', accent200: '#D9A8FF' },
    dark: { primary100: '#E4C8FF', primary200: '#B57BEA', primary300: '#9A4FD6', accent100: '#2A1A4A', accent200: '#5E3399' },
  },
  // MEDIFAMILY (moduleBrand `family`): #C2410C / #FDBA74 — warm coral, the family's sunrise.
  family: {
    light: { primary100: '#C2410C', primary200: '#EA580C', primary300: '#FB923C', accent100: '#FFEDD5', accent200: '#FDBA74' },
    dark: { primary100: '#FDBA74', primary200: '#FB923C', primary300: '#F97316', accent100: '#2A1608', accent200: '#9A3412' },
  },
};
const TONED: Record<ModuleTone, { light: Palette; dark: Palette }> = {
  vet: { light: { ...lightColors, ...MODULE_TONES.vet.light }, dark: { ...darkColors, ...MODULE_TONES.vet.dark } },
  food: { light: { ...lightColors, ...MODULE_TONES.food.light }, dark: { ...darkColors, ...MODULE_TONES.food.dark } },
  quest: { light: { ...lightColors, ...MODULE_TONES.quest.light }, dark: { ...darkColors, ...MODULE_TONES.quest.dark } },
  run: { light: { ...lightColors, ...MODULE_TONES.run.light }, dark: { ...darkColors, ...MODULE_TONES.run.dark } },
  sleep: { light: { ...lightColors, ...MODULE_TONES.sleep.light }, dark: { ...darkColors, ...MODULE_TONES.sleep.dark } },
  family: { light: { ...lightColors, ...MODULE_TONES.family.light }, dark: { ...darkColors, ...MODULE_TONES.family.dark } },
};
const ModuleToneContext = createContext<ModuleTone | null>(null);
/**
 * MEDIRUN is a night-city game (owner 2026-10-09: „მთელი ჰაბი ღამის სტილში“): inside `NightProvider` every
 * palette is the dark one whatever the phone's theme, on a deep night blue instead of the app's grey dark.
 */
const NightContext = createContext(false);
const NIGHT_BASE = { bg100: '#050B16', bg200: '#16233A', bg300: '#26364F', surface: '#0C1729', surfaceRaised: '#14223A', text300: '#7D8DA6' };
const NIGHT: Record<ModuleTone, Palette> = {
  vet: { ...TONED.vet.dark, ...NIGHT_BASE },
  food: { ...TONED.food.dark, ...NIGHT_BASE },
  quest: { ...TONED.quest.dark, ...NIGHT_BASE },
  run: { ...TONED.run.dark, ...NIGHT_BASE },
  // MEDISLEEP's night is plum-indigo instead of MEDIRUN's city blue; the lavender greys keep text calm at night.
  sleep: { ...TONED.sleep.dark, bg100: '#0B0A1F', bg200: '#1C1938', bg300: '#2C2852', surface: '#15132E', surfaceRaised: '#1E1B3F', text200: '#CFCBE6', text300: '#8B86AE' },
  family: { ...TONED.family.dark, ...NIGHT_BASE },
};
const NIGHT_PLAIN: Palette = { ...darkColors, ...NIGHT_BASE };
export function NightProvider({ children }: { children: ReactNode }) {
  return createElement(NightContext.Provider, { value: true }, children);
}
export function useIsNight(): boolean {
  return useContext(NightContext);
}

export function ModuleToneProvider({ tone, children }: { tone: ModuleTone; children: ReactNode }) {
  return createElement(ModuleToneContext.Provider, { value: tone }, children);
}

/** The module tone around this component, if any (chat tokens and other non-palette colours follow it). */
export function useModuleTone(): ModuleTone | null {
  return useContext(ModuleToneContext);
}

export function useThemeColors(): Palette {
  const { colorScheme } = useColorScheme();
  const rose = useBrandTone() === 'rose';
  const module = useContext(ModuleToneContext);
  if (useContext(NightContext)) return module ? NIGHT[module] : NIGHT_PLAIN;
  if (module) return colorScheme === 'dark' ? TONED[module].dark : TONED[module].light;
  if (colorScheme === 'dark') return rose ? roseDark : darkColors;
  return rose ? roseLight : lightColors;
}

/** True when the dark palette is active — for icon swaps and status-bar style. */
export function useIsDark(): boolean {
  const { colorScheme } = useColorScheme();
  const night = useContext(NightContext);
  return night || colorScheme === 'dark';
}

/**
 * Static fallbacks for module-scope constants and non-React code. Anything rendered
 * inside a component should use `useThemeColors()` instead so it follows the theme.
 */
export const colors = lightColors;
