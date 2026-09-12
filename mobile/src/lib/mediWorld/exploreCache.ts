import { getPreference, setPreference } from '@/lib/storage';
import type { ExploreAreaResponse } from '@/lib/mediWorld/types';

const INTRO_KEY = 'medicard.explore.introSeen';
const PERM_KEY = 'medicard.explore.permExplained';
const VIEW_KEY = 'medicard.explore.viewPref';
const CACHE_KEY = 'medicard.explore.areaCache';

export type ExploreViewPref = 'map' | 'list';

export async function getExploreIntroSeen() {
  return (await getPreference(INTRO_KEY)) === '1';
}

export async function setExploreIntroSeen() {
  await setPreference(INTRO_KEY, '1');
}

export async function clearExploreIntroSeen() {
  await setPreference(INTRO_KEY, '0');
}

export async function getExplorePermExplained() {
  return (await getPreference(PERM_KEY)) === '1';
}

export async function setExplorePermExplained() {
  await setPreference(PERM_KEY, '1');
}

export async function getExploreViewPref(): Promise<ExploreViewPref> {
  return (await getPreference(VIEW_KEY)) === 'list' ? 'list' : 'map';
}

export async function setExploreViewPref(view: ExploreViewPref) {
  await setPreference(VIEW_KEY, view);
}

export async function readExploreAreaCache(): Promise<ExploreAreaResponse | null> {
  const raw = await getPreference(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ExploreAreaResponse;
    if (!parsed || !Array.isArray(parsed.places)) return null;
    return { ...parsed, stale: true };
  } catch {
    return null;
  }
}

export async function writeExploreAreaCache(area: ExploreAreaResponse) {
  const safe = {
    enabled: area.enabled,
    rulesetId: area.rulesetId,
    coarseAreaKey: area.coarseAreaKey,
    stale: true,
    places: area.places.map((place) => ({
      id: place.id,
      name: place.name,
      nameKa: place.nameKa,
      nameEn: place.nameEn,
      placeType: place.placeType,
      publicLat: place.publicLat,
      publicLng: place.publicLng,
      coarseAreaKey: place.coarseAreaKey,
      accessibility: place.accessibility,
      accessibilityNote: place.accessibilityNote,
      safeHoursPolicy: place.safeHoursPolicy,
      developmentFixture: place.developmentFixture,
      spark: place.spark
        ? {
            spawnId: place.spark.spawnId,
            category: place.spark.category,
            locKey: place.spark.locKey,
            expiresAt: place.spark.expiresAt,
            collected: place.spark.collected,
          }
        : null,
    })),
  };
  await setPreference(CACHE_KEY, JSON.stringify(safe));
}

export async function clearExploreAreaCache() {
  await setPreference(CACHE_KEY, '');
}
