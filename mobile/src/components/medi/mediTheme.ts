import { MODULE_BRANDS } from '@/theme/moduleBrand';

/**
 * The one Medi chat's two voices. Medi (teal, the MEDI brand) and the consilium — several specialists
 * reviewing together — in indigo, so the switch is visible at a glance on the composer, the orb and
 * every consilium answer. Not a module colour: the consilium is a mode of Medi, not a MEDI* module.
 */
export const MEDI_SPHERE = {
  core: '#0D9488',
  light: '#5EEAD4',
  deep: '#0B4D47',
  glow: MODULE_BRANDS.medi.glow,
} as const;

export const CONSILIUM_SPHERE = {
  core: '#4F46E5',
  light: '#A5B4FC',
  deep: '#1E1B4B',
  glow: 'rgba(129,140,248,0.38)',
} as const;

export function consiliumInk(dark: boolean): string {
  return dark ? '#A5B4FC' : '#4338CA';
}

export function mediInk(dark: boolean): string {
  return dark ? MODULE_BRANDS.medi.ink.dark : MODULE_BRANDS.medi.ink.light;
}
