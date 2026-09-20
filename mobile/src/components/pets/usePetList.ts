import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError, type Pet } from '@/lib/api';
import { cachePetsList, loadCachedPetsList } from '@/lib/petsDraft';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';
import { ka } from '@/i18n/ka';

export function usePetList() {
  const { user } = useAuth(), owner = user?.id ?? null;
  const generation = useRef(0);
  const [state, setState] = useState<{ owner: string | null; pets: Pet[]; ready: boolean; error: string | null; offline: boolean }>({ owner, pets: [], ready: false, error: null, offline: false });
  const reload = useCallback(async () => {
    const request = ++generation.current;
    const current = () => generation.current === request && localAccountId() === owner;
    if (!owner) { setState({ owner, pets: [], ready: true, error: null, offline: false }); return; }
    try {
      const { pets } = await api.pets.list();
      if (!current()) return;
      setState({ owner, pets, ready: true, error: null, offline: false });
      void cachePetsList(pets, owner).catch(() => undefined);
    } catch (error) {
      const pets = await loadCachedPetsList(owner).catch(() => []) as Pet[];
      if (!current()) return;
      setState({ owner, pets, ready: true, offline: pets.length > 0, error: error instanceof ApiError && error.status === 503 ? ka.pets.schemaUnavailable : pets.length ? ka.common.offlineCached : ka.pets.loadError });
    }
  }, [owner]);
  useFocusEffect(useCallback(() => { void reload(); return () => { generation.current++; }; }, [reload]));
  return { ...(state.owner === owner ? state : { owner, pets: [], ready: false, error: null, offline: false }), reload };
}
