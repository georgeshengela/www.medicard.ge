import { useColorScheme } from 'nativewind';

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
export function useThemeColors(): Palette {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
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
