import { createContext, useContext } from 'react';
import { useIsDark, useThemeColors } from '@/theme/colors';
import type { HomeLayoutId } from '@/lib/home/homeLayout';

/**
 * One page-wide accent per Home layout (owner-approved 2026-10-02: „ქალის“ is rose,
 * „აქტიური“ ember, „კვება და წონა“ green, „სტანდარტული“ today's teal).
 *
 * Only the Home screen mounts the provider. Components shared with module pages
 * (HomeSectionHeading, HubFeatureCard, HomeAskMedi, …) fall back to the teal defaults below,
 * which equal the colours they used before, so module pages stay pixel-identical.
 * Never re-token `colors.ts`, `global.css`, the tab bar or the status bar from here.
 */
export type HomeAccent = {
  layout: HomeLayoutId;
  /** Links, icons, small text and progress fills on surface/canvas. */
  ink: string;
  /** Quiet fills: avatar fallback, orb, tonal buttons, inner stat tiles. */
  soft: string;
  /** Ink faded for 42 px icon tiles (8 % light / 15 % dark — the hub tint recipe). */
  tint: string;
  /** Filled call-to-action background; white text on it passes AA in both themes. */
  cta: string;
  onCta: string;
  /** Medi orb ring and the active news dot. */
  ring: string;
  /** Static wash behind the header and the first card; null = plain canvas (standard). */
  wash: string | null;
};

type Pair = { light: Omit<HomeAccent, 'layout' | 'tint'>; dark: Omit<HomeAccent, 'layout' | 'tint'> };

const ACCENTS: Record<Exclude<HomeLayoutId, 'standard'>, Pair> = {
  women: {
    light: { ink: '#C92A55', soft: '#FDEEF2', cta: '#C92A55', onCta: '#FFFFFF', ring: '#C92A55', wash: '#FBEAF0' },
    dark: { ink: '#FF8FA8', soft: '#35192A', cta: '#C92A55', onCta: '#FFFFFF', ring: '#FF8FA8', wash: '#1A0D16' },
  },
  active: {
    light: { ink: '#C2410C', soft: '#FFEFE4', cta: '#C2410C', onCta: '#FFFFFF', ring: '#C2410C', wash: '#FFF0E3' },
    dark: { ink: '#FDBA74', soft: '#3A2312', cta: '#C2410C', onCta: '#FFFFFF', ring: '#FDBA74', wash: '#1A1007' },
  },
  weight: {
    light: { ink: '#3F6B12', soft: '#ECF3E2', cta: '#3F6B12', onCta: '#FFFFFF', ring: '#3F6B12', wash: '#EEF6E2' },
    dark: { ink: '#BEF264', soft: '#1E2A10', cta: '#3F6B12', onCta: '#FFFFFF', ring: '#BEF264', wash: '#0B1408' },
  },
};

const tintOf = (hex: string, dark: boolean) => `${hex}${dark ? '26' : '14'}`;

/** Today's Home colours, read from the theme so nothing changes for `standard` or module pages. */
function standardAccent(colors: ReturnType<typeof useThemeColors>, dark: boolean): HomeAccent {
  return {
    layout: 'standard',
    ink: colors.primary100,
    soft: colors.accent100,
    tint: tintOf(dark ? '#5EEAD4' : '#0F766E', dark),
    cta: dark ? '#0D9488' : '#0F766E',
    onCta: '#FFFFFF',
    ring: colors.primary200,
    wash: null,
  };
}

export function homeAccentFor(layout: HomeLayoutId, dark: boolean, colors: ReturnType<typeof useThemeColors>): HomeAccent {
  if (layout === 'standard') return standardAccent(colors, dark);
  const tokens = dark ? ACCENTS[layout].dark : ACCENTS[layout].light;
  return { layout, ...tokens, tint: tintOf(tokens.ink, dark) };
}

export const HomeAccentContext = createContext<HomeAccent | null>(null);

/** The Home accent inside the Home screen; today's teal everywhere else. */
export function useHomeAccent(): HomeAccent {
  const fromHome = useContext(HomeAccentContext);
  const colors = useThemeColors();
  const dark = useIsDark();
  return fromHome ?? standardAccent(colors, dark);
}
