import { getPreference, setPreference } from '@/lib/storage';
import type { ExploreAreaResponse } from '@/lib/mediWorld/types';
import {
  fromPersistedExploreArea,
  toPersistedExploreArea,
} from '@/lib/mediWorld/exploreAreaCache.js';

const INTRO_KEY = 'medicard.explore.introSeen';
const PERM_KEY = 'medicard.explore.permExplained';
const VIEW_KEY = 'medicard.explore.viewPref';
const CACHE_KEY = 'medicard.explore.areaCache';

export type ExploreViewPref = 'map' | 'list';

export type ExploreAreaCacheRecord = {
  ownerId: string;
  fetchedAt: number;
  enabled: boolean;
  rulesetId: string;
  coarseAreaKey: string;
  places: ExploreAreaResponse['places'];
};

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

export async function readExploreAreaCacheRecord(): Promise<ExploreAreaCacheRecord | null> {
  const raw = await getPreference(CACHE_KEY);
  if (!raw) return null;
  try {
    return fromPersistedExploreArea(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** @deprecated Use readExploreAreaCacheRecord + resolveExploreAreaCacheUse. Legacy unscoped payloads are ignored. */
export async function readExploreAreaCache(): Promise<ExploreAreaResponse | null> {
  const record = await readExploreAreaCacheRecord();
  if (!record) return null;
  return {
    enabled: record.enabled,
    rulesetId: record.rulesetId,
    coarseAreaKey: record.coarseAreaKey,
    stale: true,
    snapshotOnly: true,
    places: record.places,
  };
}

export async function writeExploreAreaCache(
  area: ExploreAreaResponse,
  meta: { ownerId: string; fetchedAt?: number },
) {
  const record = toPersistedExploreArea({
    ownerId: meta.ownerId,
    fetchedAt: meta.fetchedAt ?? Date.now(),
    area,
  });
  if (!record) return;
  await setPreference(CACHE_KEY, JSON.stringify(record));
}

export async function clearExploreAreaCache() {
  await setPreference(CACHE_KEY, '');
}
