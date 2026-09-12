import { CARE_ENERGY_TYPES } from '../contract.js';
import { GARDEN_CATALOG_VERSION, GARDEN_RULESET_ID } from './rules.js';

/** Server-owned. Equal gameplay value. No rarity, loot, or paid currency. */
export const GARDEN_PLANTS = Object.freeze([
  {
    key: 'pulse_fern',
    category: 'movement',
    price: 20,
    active: true,
    catalogVersion: GARDEN_CATALOG_VERSION,
    presentationKey: 'pulse_fern',
    nameKey: 'pulse_fern_name',
    descriptionKey: 'pulse_fern_desc',
    a11yKey: 'pulse_fern_a11y',
    growthPresentation: Object.freeze({
      seed: 'pulse_fern_seed',
      sprout: 'pulse_fern_sprout',
      bloom: 'pulse_fern_bloom',
      radiant: 'pulse_fern_radiant',
    }),
  },
  {
    key: 'dew_lily',
    category: 'hydration',
    price: 20,
    active: true,
    catalogVersion: GARDEN_CATALOG_VERSION,
    presentationKey: 'dew_lily',
    nameKey: 'dew_lily_name',
    descriptionKey: 'dew_lily_desc',
    a11yKey: 'dew_lily_a11y',
    growthPresentation: Object.freeze({
      seed: 'dew_lily_seed',
      sprout: 'dew_lily_sprout',
      bloom: 'dew_lily_bloom',
      radiant: 'dew_lily_radiant',
    }),
  },
  {
    key: 'moon_moss',
    category: 'calm',
    price: 20,
    active: true,
    catalogVersion: GARDEN_CATALOG_VERSION,
    presentationKey: 'moon_moss',
    nameKey: 'moon_moss_name',
    descriptionKey: 'moon_moss_desc',
    a11yKey: 'moon_moss_a11y',
    growthPresentation: Object.freeze({
      seed: 'moon_moss_seed',
      sprout: 'moon_moss_sprout',
      bloom: 'moon_moss_bloom',
      radiant: 'moon_moss_radiant',
    }),
  },
  {
    key: 'heart_bloom',
    category: 'care',
    price: 20,
    active: true,
    catalogVersion: GARDEN_CATALOG_VERSION,
    presentationKey: 'heart_bloom',
    nameKey: 'heart_bloom_name',
    descriptionKey: 'heart_bloom_desc',
    a11yKey: 'heart_bloom_a11y',
    growthPresentation: Object.freeze({
      seed: 'heart_bloom_seed',
      sprout: 'heart_bloom_sprout',
      bloom: 'heart_bloom_bloom',
      radiant: 'heart_bloom_radiant',
    }),
  },
  {
    key: 'orbit_vine',
    category: 'connection',
    price: 20,
    active: true,
    catalogVersion: GARDEN_CATALOG_VERSION,
    presentationKey: 'orbit_vine',
    nameKey: 'orbit_vine_name',
    descriptionKey: 'orbit_vine_desc',
    a11yKey: 'orbit_vine_a11y',
    growthPresentation: Object.freeze({
      seed: 'orbit_vine_seed',
      sprout: 'orbit_vine_sprout',
      bloom: 'orbit_vine_bloom',
      radiant: 'orbit_vine_radiant',
    }),
  },
]);

const BY_KEY = Object.freeze(Object.fromEntries(GARDEN_PLANTS.map((item) => [item.key, item])));

export function gardenPlantByKey(key, options = {}) {
  const override = options.catalogByKey?.[key];
  if (override) return override;
  return BY_KEY[key] || null;
}

export function publicGardenCatalogItem(item) {
  if (!item) return null;
  return {
    key: item.key,
    category: item.category,
    price: item.price,
    active: Boolean(item.active),
    catalogVersion: item.catalogVersion || GARDEN_CATALOG_VERSION,
    presentationKey: item.presentationKey,
    nameKey: item.nameKey,
    descriptionKey: item.descriptionKey,
    a11yKey: item.a11yKey,
    growthPresentation: { ...item.growthPresentation },
    rulesetId: GARDEN_RULESET_ID,
  };
}

export function publicGardenCatalog(options = {}) {
  const items = GARDEN_PLANTS.map((item) => gardenPlantByKey(item.key, options)).filter(Boolean);
  return {
    rulesetId: GARDEN_RULESET_ID,
    catalogVersion: GARDEN_CATALOG_VERSION,
    items: items.filter((item) => item.active !== false || options.includeInactive).map(publicGardenCatalogItem),
  };
}

export function isGardenCategory(value) {
  return CARE_ENERGY_TYPES.includes(value);
}
