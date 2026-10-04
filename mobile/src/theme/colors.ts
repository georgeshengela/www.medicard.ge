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
export type ModuleTone = 'vet' | 'food';
type ToneTokens = { primary100: string; primary200: string; primary300: string; accent100: string; accent200: string };
const MODULE_TONES: Record<ModuleTone, { light: ToneTokens; dark: ToneTokens }> = {
  // MEDIVET (moduleBrand `vet`): #0369A1 / #7DD3FC.
  vet: {
    light: { primary100: '#0369A1', primary200: '#0284C7', primary300: '#38BDF8', accent100: '#E0F2FE', accent200: '#7DD3FC' },
    dark: { primary100: '#7DD3FC', primary200: '#38BDF8', primary300: '#0EA5E9', accent100: '#0C2A3D', accent200: '#075985' },
  },
  // MEDIFOOD (moduleBrand `food`): #047857 / #34D399.
  food: {
    light: { primary100: '#047857', primary200: '#059669', primary300: '#34D399', accent100: '#D1FAE5', accent200: '#6EE7B7' },
    dark: { primary100: '#34D399', primary200: '#10B981', primary300: '#6EE7B7', accent100: '#022C22', accent200: '#065F46' },
  },
};
const TONED: Record<ModuleTone, { light: Palette; dark: Palette }> = {
  vet: { light: { ...lightColors, ...MODULE_TONES.vet.light }, dark: { ...darkColors, ...MODULE_TONES.vet.dark } },
  food: { light: { ...lightColors, ...MODULE_TONES.food.light }, dark: { ...darkColors, ...MODULE_TONES.food.dark } },
};
const ModuleToneContext = createContext<ModuleTone | null>(null);

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
  if (module) return colorScheme === 'dark' ? TONED[module].dark : TONED[module].light;
  if (colorScheme === 'dark') return rose ? roseDark : darkColors;
  return rose ? roseLight : lightColors;
}

/** True when the dark palette is active — for icon swaps and status-bar style. */
export function useIsDark(): boolean {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark';
}

/**
 * Static fallbacks for module-scope constants and non-React code. Anything rendered
 * inside a component should use `useThemeColors()` instead so it follows the theme.
 */
export const colors = lightColors;
