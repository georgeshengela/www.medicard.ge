import { useCallback } from 'react';
import { api, ApiError, type Pet } from '@/lib/api';
import { cachePetsList, loadCachedPetsList } from '@/lib/petsDraft';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { useStaleWhenFallback } from '@/hooks/queryFallback';
import { FRESH } from '@/lib/queryClient';
import { ka } from '@/i18n/ka';

type PetListSnapshot = { pets: Pet[]; error: string | null; offline: boolean; fallback: boolean };

/** Every pet write goes to /api/pets, which invalidates 'pets'. */
const PETS_KEY = ['pets', 'list'] as const;
const EMPTY: Pet[] = [];

async function fetchPets(): Promise<PetListSnapshot> {
  const owner = localAccountId();
  try {
    const { pets } = await api.pets.list();
    if (owner && owner === localAccountId()) void cachePetsList(pets, owner).catch(() => undefined);
    return { pets, error: null, offline: false, fallback: false };
  } catch (error) {
    const pets = owner ? ((await loadCachedPetsList(owner).catch(() => [])) as Pet[]) : [];
    return {
      pets,
      fallback: true,
      offline: pets.length > 0,
      error: error instanceof ApiError && error.status === 503 ? ka.pets.schemaUnavailable : pets.length ? ka.common.offlineCached : ka.pets.loadError,
    };
  }
}

export function usePetList() {
  const { user } = useAuth(), owner = user?.id ?? null;
  // Pets change only through the person's own writes (invalidated), so 30 s fresh is safe.
  const query = useAccountQuery<PetListSnapshot>({ key: [...PETS_KEY], fetch: fetchPets, staleTime: FRESH.SHORT, enabled: Boolean(owner) });
  // A failed read (device copy / error) is retried on the next visit, not kept fresh for 30 s.
  useStaleWhenFallback([...PETS_KEY], query.data);
  const { refetch } = query;
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const data = owner && owner === localAccountId() ? query.data : undefined;
  if (!owner) return { owner, pets: EMPTY, ready: true, error: null, offline: false, reload };
  return {
    owner,
    pets: data?.pets ?? EMPTY,
    ready: Boolean(data),
    error: data?.error ?? null,
    offline: data?.offline ?? false,
    reload,
  };
}
