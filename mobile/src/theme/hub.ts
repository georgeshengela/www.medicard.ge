import { StyleSheet } from 'react-native';

/**
 * The Home hub design language. Every page that adopts the hub look reads
 * from here — spacing, radii, the tint recipe and the type scale — so the
 * app converges on one style instead of one style per screen.
 *
 * Rules of the language:
 *  - Canvas is `bg100`; cards are flat `surface` with no border and no shadow.
 *  - A section is a title *outside* its card, then the card.
 *  - Icons sit in a tinted tile: the ink at 8% (light) / 15% (dark) behind it.
 *  - One spotlight per page (a dark teal card); everything else stays quiet.
 */
export const HUB = {
  gutter: 20,
  sectionGap: 28,
  headingGap: 12,
  cardRadius: 22,
  cardPad: 18,
  tileRadius: 14,
  tile: 42,
  spotlightBg: '#102C35',
} as const;

export type HubInk = 'teal' | 'blue' | 'violet' | 'rose' | 'amber' | 'green' | 'sky' | 'neutral';

const INK: Record<HubInk, { light: string; dark: string }> = {
  teal: { light: '#0F766E', dark: '#5EEAD4' },
  blue: { light: '#1D4ED8', dark: '#93C5FD' },
  violet: { light: '#6B50A0', dark: '#C4B5FD' },
  rose: { light: '#BE185D', dark: '#F9A8D4' },
  amber: { light: '#B45309', dark: '#FCD34D' },
  green: { light: '#15803D', dark: '#86EFAC' },
  sky: { light: '#0369A1', dark: '#7DD3FC' },
  neutral: { light: '#374151', dark: '#D1D5DB' },
};

export function hubInk(ink: HubInk, dark: boolean): string {
  return dark ? INK[ink].dark : INK[ink].light;
}

/** Tile fill behind an icon: the ink itself, faded. */
export function hubTint(inkHex: string, dark: boolean): string {
  return `${inkHex}${dark ? '26' : '14'}`;
}

export const hubText = StyleSheet.create({
  sectionTitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, lineHeight: 24 },
  link: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 20 },
  cardTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 22 },
  value: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 },
  body: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17 },
  small: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 16 },
});
