import { useThemeColors, useIsDark, type Palette } from '@/theme/colors';
import { cycleDark, cycleLight } from '@/theme/cyclePalette';

/**
 * The women's space speaks the women's Home colours (owner 2026-10-03: „make it look like the
 * women's Home, add some warmth“): blush canvas and rose actions from the cycle palette instead of
 * the app's teal. Same token names as the theme, so every screen piece reads `c.primary100`,
 * `c.accent100`, `c.bg100` … unchanged. Status colours (danger, warning, success) stay the theme's.
 */
export function useCommunityColors(): Palette {
  const base = useThemeColors();
  const dark = useIsDark();
  const p = dark ? cycleDark : cycleLight;
  return {
    ...base,
    bg100: p.cream,
    bg200: p.cardSoft,
    bg300: p.creamDeep,
    surface: p.card,
    surfaceRaised: p.card,
    primary100: p.brand,
    primary200: p.brand,
    primary300: p.accentBorder,
    accent100: p.accentSoft,
    accent200: p.accentBorder,
    text100: p.ink,
    text200: p.muted,
    text300: p.mutedSoft,
  };
}

/** Filled rose action (both themes) — the women's Home CTA. */
export const COMMUNITY_CTA = cycleLight.cta;
/** The soft rose wash behind the top of the space, like the women's Home header. */
export const communityWash = (dark: boolean) => (dark ? '#1A0D16' : '#FBEAF0');
