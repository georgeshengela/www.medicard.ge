import { useSyncExternalStore } from 'react';

/**
 * The app's brand tone (owner 2026-10-04): with the women's Home layout chosen, the whole app takes
 * the women's Home rose instead of the teal — bottom bar, links, icons, buttons, tints — so the app
 * feels soft and the cycle does not stand apart. Everyone else keeps the teal.
 *
 * `BrandToneSync` (app/_layout.tsx) sets it from the resolved Home layout; `useThemeColors()` merges
 * `BRAND_ROSE` over the palette and the root view re-points NativeWind's CSS variables, so both
 * `className="bg-primary-200"` and `colors.primary200` follow. Hard-coded teal hex values do not.
 */
export type BrandTone = 'teal' | 'rose';

type RoseTokens = { primary100: string; primary200: string; primary300: string; accent100: string; accent200: string };

/** The women's Home accent (homeAccent.ts `women`) spread over the five brand tokens. */
export const BRAND_ROSE: { light: RoseTokens; dark: RoseTokens } = {
  light: { primary100: '#B8244C', primary200: '#D6406A', primary300: '#F27A9A', accent100: '#FDEEF2', accent200: '#F5A3B8' },
  dark: { primary100: '#FFB3C4', primary200: '#FF8FA8', primary300: '#FFA3B8', accent100: '#35192A', accent200: '#6B2440' },
};

/** Channel triplets for global.css's `--color-*` variables (Tailwind `rgb(var(...) / alpha)`). */
function channels(hex: string): string {
  const raw = hex.replace('#', '');
  return `${parseInt(raw.slice(0, 2), 16)} ${parseInt(raw.slice(2, 4), 16)} ${parseInt(raw.slice(4, 6), 16)}`;
}

export function roseCssVars(dark: boolean): Record<string, string> {
  const t = dark ? BRAND_ROSE.dark : BRAND_ROSE.light;
  return {
    '--color-primary-100': channels(t.primary100),
    '--color-primary-200': channels(t.primary200),
    '--color-primary-300': channels(t.primary300),
    '--color-accent-100': channels(t.accent100),
    '--color-accent-200': channels(t.accent200),
  };
}

let tone: BrandTone = 'teal';
const listeners = new Set<() => void>();

export function getBrandTone(): BrandTone {
  return tone;
}

export function setBrandTone(next: BrandTone): void {
  if (next === tone) return;
  tone = next;
  listeners.forEach((listener) => listener());
}

export function useBrandTone(): BrandTone {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getBrandTone,
    getBrandTone,
  );
}

// ---------- teal → rose for hard-coded brand colours (owner 2026-10-04: „every page“) ----------

/** The app's teal brand shades and their women's-Home rose counterparts (same role, same weight). */
const TEAL_TO_ROSE: Record<string, string> = {
  '#14B8A6': '#D6406A',
  '#0D9488': '#C92A55',
  '#0F766E': '#B8244C',
  '#2DD4BF': '#F06A90',
  '#5EEAD4': '#FF8FA8',
  '#99F6E4': '#FFC2D1',
  '#CCFBF1': '#FDE2EA',
  '#F0FDFA': '#FFF1F5',
  '#042F2E': '#35192A',
  '#115E59': '#6B2440',
  '#134E4A': '#5A1E36',
};
const RGB_TO_ROSE: Record<string, string> = {
  '20,184,166': '214,64,106',
  '13,148,136': '201,42,85',
  '15,118,110': '184,36,76',
  '45,212,191': '240,106,144',
  '94,234,212': '255,143,168',
  '153,246,228': '255,194,209',
};

/** A colour string in the rose tone: teal hex (with or without alpha suffix) and teal rgba() map; others pass. */
export function roseHex(value: string): string {
  const hex = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(value);
  if (hex) {
    const mapped = TEAL_TO_ROSE[`#${hex[1].toUpperCase()}`];
    return mapped ? `${mapped}${hex[2] ?? ''}` : value;
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,.*)?\)$/.exec(value);
  if (rgba) {
    const mapped = RGB_TO_ROSE[`${rgba[1]},${rgba[2]},${rgba[3]}`];
    if (mapped) return `${value.startsWith('rgba') ? 'rgba' : 'rgb'}(${mapped}${rgba[4] ?? ''})`;
  }
  return value;
}

/** A brand teal literal, read at render time: rose while the women's brand tone is on. */
export function brandHex(value: string): string {
  return tone === 'rose' ? roseHex(value) : value;
}

/**
 * Wraps a token object (figma*Layout constants) so every colour read goes through `brandHex` at the
 * moment it is read — the hooks' spreads and direct `FIGMA_X.brand` reads both follow the tone.
 * Nested objects (shadows, typography) come back as they are.
 */
export function toned<T extends object>(tokens: T): T {
  return new Proxy(tokens, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'string') return value;
      // A frozen token object (React Native deep-freezes style props in dev) may only report its real
      // value — returning the rose there throws a Proxy invariant TypeError and crashed the app into
      // the maintenance screen (1.0.0.20.13). Frozen reads stay teal; everything else follows the tone.
      const desc = Reflect.getOwnPropertyDescriptor(target, key);
      if (desc && !desc.configurable && !desc.writable) return value;
      return brandHex(value);
    },
  });
}
