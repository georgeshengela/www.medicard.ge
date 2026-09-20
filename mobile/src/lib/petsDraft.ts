import { localAccountId } from '@/lib/localAccount';
import { getPreference, setPreference } from '@/lib/storage';

const getScopedPreference = (base: string, owner: string | null) => owner ? getPreference(`${base}.${owner}`) : Promise.resolve(null);
const setScopedPreference = (base: string, value: string, owner: string | null) => owner ? setPreference(`${base}.${owner}`, value) : Promise.resolve();

export const PETS_DRAFT_KEY = 'medicard.pets.draft.v1';
export const PETS_LIST_CACHE_KEY = 'medicard.pets.list.v1';

export async function loadPetsDraft(owner = localAccountId()) {
  const raw = await getScopedPreference(PETS_DRAFT_KEY, owner);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function savePetsDraft(value: unknown, owner = localAccountId()) {
  await setScopedPreference(PETS_DRAFT_KEY, JSON.stringify(value), owner);
}

export async function clearPetsDraft(owner = localAccountId()) {
  await setScopedPreference(PETS_DRAFT_KEY, '', owner);
}

export async function cachePetsList(pets: unknown[], owner = localAccountId()) {
  await setScopedPreference(PETS_LIST_CACHE_KEY, JSON.stringify(pets), owner);
}

export async function loadCachedPetsList(owner = localAccountId()) {
  const raw = await getScopedPreference(PETS_LIST_CACHE_KEY, owner);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
