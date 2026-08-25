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

export const darkColors: Palette = {
  bg100: '#0d1214',
  bg200: '#1a2225',
  bg300: '#273236',
  surface: '#141b1d',
  surfaceRaised: '#1a2225',

  primary100: '#5eead4',
  primary200: '#14b8a6',
  primary300: '#2dd4bf',
  accent100: '#134e4a',
  accent200: '#0f766e',

  text100: '#eaf0f0',
  text200: '#a6b4b7',
  text300: '#74858a',

  success: '#34d399',
  successBg: '#0e2a21',
  warning: '#fbbf24',
  warningBg: '#2e220b',
  danger: '#f87171',
  dangerBg: '#2e1416',

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
