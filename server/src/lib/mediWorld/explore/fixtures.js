import { coarseAreaKey } from './geo.js';
import { canLoadExploreFixtures } from '../flags.js';

export const SPARK_DEFINITIONS = Object.freeze([
  { id: 'spark.movement', category: 'movement', locKey: 'spark.movement' },
  { id: 'spark.hydration', category: 'hydration', locKey: 'spark.hydration' },
  { id: 'spark.calm', category: 'calm', locKey: 'spark.calm' },
  { id: 'spark.care', category: 'care', locKey: 'spark.care' },
  { id: 'spark.connection', category: 'connection', locKey: 'spark.connection' },
]);

/** Android emulator default (Googleplex). Public-style QA parks only. Not real verified POIs. */
export const DEVELOPMENT_PLACES = Object.freeze([
  {
    id: 'place.qa.garden.alpha',
    nameKa: 'QA საჯარო ბაღი (ფიქსტურა)',
    nameEn: 'QA public garden (fixture)',
    placeType: 'public_garden',
    latitude: 37.422,
    longitude: -122.084,
    sourceIdentifier: 'dev:emulator-default-garden',
    accessibility: 'unknown',
  },
  {
    id: 'place.qa.park.beta',
    nameKa: 'QA პარკი (ფიქსტურა)',
    nameEn: 'QA park (fixture)',
    placeType: 'park',
    latitude: 37.4238,
    longitude: -122.0822,
    sourceIdentifier: 'dev:emulator-far-park',
    accessibility: 'unknown',
  },
  {
    id: 'place.qa.square.gamma',
    nameKa: 'QA მოედანი (ფიქსტურა)',
    nameEn: 'QA public square (fixture)',
    placeType: 'public_square',
    latitude: 37.4215,
    longitude: -122.0845,
    sourceIdentifier: 'dev:emulator-square',
    accessibility: 'partial',
    accessibilityNote: 'QA only. Accessibility is not field-verified.',
  },
]);

export function developmentPlaceRows(now = new Date()) {
  return DEVELOPMENT_PLACES.map((place) => ({
    ...place,
    coarseAreaKey: coarseAreaKey(place.latitude, place.longitude),
    status: 'approved',
    active: true,
    source: 'development_fixture',
    lastReviewedAt: now,
    updatedAt: now,
  }));
}

export function assertFixturesAllowed(options = {}) {
  if (canLoadExploreFixtures(options.flags || options)) return true;
  const error = new Error('Development fixtures cannot load in production.');
  error.status = 404;
  error.code = 'EXPLORE_FIXTURES_FORBIDDEN';
  throw error;
}
