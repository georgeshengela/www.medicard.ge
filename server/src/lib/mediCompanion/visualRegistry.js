/**
 * Canonical list of visualKeys the mobile renderer must implement.
 * Kept in sync with COMPANION_COSMETICS visualKeys — tests assert parity.
 */
export const RENDERED_VISUAL_KEYS = Object.freeze([
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
]);

export const ACCENT_COLORS = Object.freeze({
  'accent.teal_core': '#14B8A6',
  'accent.gold': '#D4A017',
  'accent.soft_blue': '#38BDF8',
  'accent.coral': '#F472B6',
  'accent.violet': '#A78BFA',
  'accent.mint': '#5EEAD4',
});

export function isVisualKeyRendered(visualKey) {
  return RENDERED_VISUAL_KEYS.includes(visualKey);
}
