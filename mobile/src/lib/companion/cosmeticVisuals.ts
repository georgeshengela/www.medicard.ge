/**
 * Phase 9.1 — visualKey → render params. Must match server visualRegistry.
 */
export const RENDERED_VISUAL_KEYS = [
  'accent.teal_core',
  'accent.gold',
  'accent.soft_blue',
  'accent.coral',
  'accent.violet',
  'accent.mint',
  'pose.wave',
  'pose.focused',
  'pose.proud',
  'pose.resting',
  'pose.curious',
  'accessory.pin',
  'accessory.visor',
  'accessory.scarf',
  'accessory.orbit',
  'accessory.badge',
  'bg.calm_navy',
  'bg.dawn',
  'bg.teal_room',
  'bg.city_night',
  'bg.garden_light',
  'bg.summit_dusk',
  'decor.plant',
  'decor.lamp',
  'decor.shelf',
  'decor.frame',
  'decor.window',
] as const;

export type VisualKey = (typeof RENDERED_VISUAL_KEYS)[number];

export const ACCENT_COLORS: Record<string, string> = {
  'accent.teal_core': '#14B8A6',
  'accent.gold': '#D4A017',
  'accent.soft_blue': '#38BDF8',
  'accent.coral': '#F472B6',
  'accent.violet': '#A78BFA',
  'accent.mint': '#5EEAD4',
};

export const POSE_TRANSFORMS: Record<string, { rotate: number; translateY: number; armLift?: 'left' | 'right' | 'both' }> = {
  'pose.wave': { rotate: -4, translateY: -1, armLift: 'right' },
  'pose.focused': { rotate: 2, translateY: 0 },
  'pose.proud': { rotate: 0, translateY: -2, armLift: 'both' },
  'pose.resting': { rotate: 3, translateY: 2 },
  'pose.curious': { rotate: -6, translateY: 0 },
};

export type BgPalette = {
  top: string;
  mid: string;
  bottom: string;
  accent: string;
  darkTop: string;
  darkMid: string;
  darkBottom: string;
  darkAccent: string;
};

export const BACKGROUND_PALETTES: Record<string, BgPalette> = {
  'bg.calm_navy': {
    top: '#E0F2FE',
    mid: '#F0FDFA',
    bottom: '#ECFDF5',
    accent: '#14B8A6',
    darkTop: '#0B1220',
    darkMid: '#111827',
    darkBottom: '#0F172A',
    darkAccent: '#14B8A6',
  },
  'bg.dawn': {
    top: '#FFEDD5',
    mid: '#FEF3C7',
    bottom: '#ECFDF5',
    accent: '#F59E0B',
    darkTop: '#1C1917',
    darkMid: '#292524',
    darkBottom: '#0F172A',
    darkAccent: '#FBBF24',
  },
  'bg.teal_room': {
    top: '#CCFBF1',
    mid: '#F0FDFA',
    bottom: '#E0F2FE',
    accent: '#0D9488',
    darkTop: '#042F2E',
    darkMid: '#134E4A',
    darkBottom: '#111827',
    darkAccent: '#2DD4BF',
  },
  'bg.city_night': {
    top: '#1E3A5F',
    mid: '#0F172A',
    bottom: '#020617',
    accent: '#38BDF8',
    darkTop: '#0B1220',
    darkMid: '#020617',
    darkBottom: '#000000',
    darkAccent: '#7DD3FC',
  },
  'bg.garden_light': {
    top: '#DCFCE7',
    mid: '#ECFDF5',
    bottom: '#FEF9C3',
    accent: '#22C55E',
    darkTop: '#14532D',
    darkMid: '#052E16',
    darkBottom: '#111827',
    darkAccent: '#4ADE80',
  },
  'bg.summit_dusk': {
    top: '#E9D5FF',
    mid: '#FCE7F3',
    bottom: '#FFEDD5',
    accent: '#A78BFA',
    darkTop: '#2E1065',
    darkMid: '#4C1D95',
    darkBottom: '#111827',
    darkAccent: '#C4B5FD',
  },
};

/** Map cosmetic catalog key → visualKey (mirrors server catalog). */
export const COSMETIC_VISUAL_BY_KEY: Record<string, string> = {
  COSMETIC_DEFAULT_ACCENT: 'accent.teal_core',
  COSMETIC_DEFAULT_BACKGROUND: 'bg.calm_navy',
  COSMETIC_MILESTONE_01: 'pose.wave',
  COSMETIC_MILESTONE_02: 'decor.plant',
  COSMETIC_MILESTONE_03: 'accessory.pin',
  COSMETIC_MILESTONE_04: 'accent.gold',
  COSMETIC_MILESTONE_05: 'bg.dawn',
  COSMETIC_MILESTONE_06: 'pose.focused',
  COSMETIC_MILESTONE_07: 'decor.lamp',
  COSMETIC_MILESTONE_08: 'accessory.visor',
  COSMETIC_MILESTONE_09: 'accent.soft_blue',
  COSMETIC_MILESTONE_10: 'bg.teal_room',
  COSMETIC_MILESTONE_11: 'pose.proud',
  COSMETIC_MILESTONE_12: 'decor.shelf',
  COSMETIC_MILESTONE_13: 'accessory.scarf',
  COSMETIC_MILESTONE_14: 'accent.coral',
  COSMETIC_MILESTONE_15: 'bg.city_night',
  COSMETIC_MILESTONE_16: 'pose.resting',
  COSMETIC_MILESTONE_17: 'decor.frame',
  COSMETIC_MILESTONE_18: 'accessory.orbit',
  COSMETIC_MILESTONE_19: 'accent.violet',
  COSMETIC_MILESTONE_20: 'bg.garden_light',
  COSMETIC_MILESTONE_21: 'accessory.badge',
  COSMETIC_MILESTONE_22: 'decor.window',
  COSMETIC_MILESTONE_23: 'pose.curious',
  COSMETIC_MILESTONE_24: 'accent.mint',
  COSMETIC_MILESTONE_25: 'bg.summit_dusk',
};

export function visualKeyForCosmetic(key: string | null | undefined): string | null {
  if (!key) return null;
  return COSMETIC_VISUAL_BY_KEY[key] || null;
}

export function isVisualKeyRendered(visualKey: string | null | undefined): boolean {
  if (!visualKey) return false;
  return (RENDERED_VISUAL_KEYS as readonly string[]).includes(visualKey);
}

export function accentColorForEquipment(accentKey: string | null | undefined, fallback = '#14B8A6'): string {
  const vk = visualKeyForCosmetic(accentKey) || 'accent.teal_core';
  return ACCENT_COLORS[vk] || fallback;
}

export function resolveLoadoutVisuals(equipment: {
  accent?: string | null;
  accessory?: string | null;
  background?: string | null;
  decoration?: string | null;
}) {
  const accentVk = visualKeyForCosmetic(equipment.accent) || 'accent.teal_core';
  const accessoryVk = visualKeyForCosmetic(equipment.accessory);
  const backgroundVk = visualKeyForCosmetic(equipment.background) || 'bg.calm_navy';
  const decorationVk = visualKeyForCosmetic(equipment.decoration);
  const poseVk = accessoryVk?.startsWith('pose.') ? accessoryVk : null;
  const physicalAccessory = accessoryVk?.startsWith('accessory.') ? accessoryVk : null;
  return {
    accentVk,
    accentColor: ACCENT_COLORS[accentVk] || '#14B8A6',
    poseVk,
    physicalAccessory,
    backgroundVk,
    decorationVk,
  };
}
