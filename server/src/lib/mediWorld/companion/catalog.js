export const COSMETIC_CATALOG_VERSION = 1;
export const DEFAULT_AURA_KEY = 'aura_teal_origin';

export const COSMETIC_SLOTS = Object.freeze(['aura', 'trail', 'charm', 'care_space_accent']);

export const COSMETIC_CATALOG = Object.freeze([
  {
    key: 'aura_teal_origin',
    slot: 'aura',
    energyType: null,
    price: 0,
    worldLevel: 1,
    stageKey: null,
    active: true,
    defaultOwned: true,
    presentationKey: 'cosmetic.aura_teal_origin',
    nameKey: 'aura_teal_origin_name',
    descriptionKey: 'aura_teal_origin_desc',
    fallbackLabel: 'Origin teal',
  },
  {
    key: 'aura_hydration_wave',
    slot: 'aura',
    energyType: 'hydration',
    price: 30,
    worldLevel: 3,
    stageKey: null,
    active: true,
    defaultOwned: false,
    presentationKey: 'cosmetic.aura_hydration_wave',
    nameKey: 'aura_hydration_wave_name',
    descriptionKey: 'aura_hydration_wave_desc',
    fallbackLabel: 'Hydration wave',
  },
  {
    key: 'aura_calm_glow',
    slot: 'aura',
    energyType: 'calm',
    price: 30,
    worldLevel: 5,
    stageKey: null,
    active: true,
    defaultOwned: false,
    presentationKey: 'cosmetic.aura_calm_glow',
    nameKey: 'aura_calm_glow_name',
    descriptionKey: 'aura_calm_glow_desc',
    fallbackLabel: 'Calm glow',
  },
  {
    key: 'trail_movement_pulse',
    slot: 'trail',
    energyType: 'movement',
    price: 40,
    worldLevel: 8,
    stageKey: null,
    active: true,
    defaultOwned: false,
    presentationKey: 'cosmetic.trail_movement_pulse',
    nameKey: 'trail_movement_pulse_name',
    descriptionKey: 'trail_movement_pulse_desc',
    fallbackLabel: 'Movement pulse',
  },
  {
    key: 'charm_care_heart',
    slot: 'charm',
    energyType: 'care',
    price: 40,
    worldLevel: 10,
    stageKey: null,
    active: true,
    defaultOwned: false,
    presentationKey: 'cosmetic.charm_care_heart',
    nameKey: 'charm_care_heart_name',
    descriptionKey: 'charm_care_heart_desc',
    fallbackLabel: 'Care heart',
  },
  {
    key: 'accent_connection_orbit',
    slot: 'care_space_accent',
    energyType: 'connection',
    price: 50,
    worldLevel: 12,
    stageKey: null,
    active: true,
    defaultOwned: false,
    presentationKey: 'cosmetic.accent_connection_orbit',
    nameKey: 'accent_connection_orbit_name',
    descriptionKey: 'accent_connection_orbit_desc',
    fallbackLabel: 'Connection orbit',
  },
  {
    key: 'aura_disabled_archive',
    slot: 'aura',
    energyType: 'calm',
    price: 10,
    worldLevel: 1,
    stageKey: null,
    active: false,
    defaultOwned: false,
    presentationKey: 'cosmetic.aura_disabled_archive',
    nameKey: 'aura_disabled_archive_name',
    descriptionKey: 'aura_disabled_archive_desc',
    fallbackLabel: 'Archived glow',
  },
]);

const BY_KEY = Object.fromEntries(COSMETIC_CATALOG.map((item) => [item.key, item]));

export function cosmeticByKey(key) {
  return BY_KEY[key] || null;
}

export function isCosmeticSlot(slot) {
  return COSMETIC_SLOTS.includes(slot);
}

export function equippedFieldForSlot(slot) {
  if (slot === 'aura') return 'equippedAuraKey';
  if (slot === 'trail') return 'equippedTrailKey';
  if (slot === 'charm') return 'equippedCharmKey';
  if (slot === 'care_space_accent') return 'equippedAccentKey';
  return null;
}
