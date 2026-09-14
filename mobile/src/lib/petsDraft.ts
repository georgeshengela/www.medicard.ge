import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';

export const PETS_DRAFT_KEY = 'medicard.pets.draft.v1';
export const PETS_LIST_CACHE_KEY = 'medicard.pets.list.v1';

export async function loadPetsDraft() {
  const raw = await getScopedPreference(PETS_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function savePetsDraft(value) {
  await setScopedPreference(PETS_DRAFT_KEY, JSON.stringify(value));
}

export async function clearPetsDraft() {
  await setScopedPreference(PETS_DRAFT_KEY, '');
}

export async function cachePetsList(pets) {
  await setScopedPreference(PETS_LIST_CACHE_KEY, JSON.stringify(pets));
}

export async function loadCachedPetsList() {
  const raw = await getScopedPreference(PETS_LIST_CACHE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
