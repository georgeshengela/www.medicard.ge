import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';

/**
 * The signed-in person's photo avatar URL (private, served by /api/identity/avatars/:id), shared by
 * Home, Profile and the trainer screens. Account-scoped; refreshed after upload/remove.
 */
type State = { owner: string | null; url: string | null; loaded: boolean };
let state: State = { owner: null, url: null, loaded: false };
const listeners = new Set<(s: State) => void>();
let inflight: Promise<void> | null = null;

function emit(next: State) {
  state = next;
  for (const l of listeners) l(state);
}

export async function refreshMyAvatar(): Promise<void> {
  const owner = localAccountId();
  if (!owner) return;
  if (inflight) return inflight;
  inflight = api.identity
    .avatar()
    .then((r) => {
      if (localAccountId() === owner) emit({ owner, url: r.avatarUrl, loaded: true });
    })
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function setMyAvatarUrl(url: string | null) {
  emit({ owner: localAccountId(), url, loaded: true });
}

export function useMyAvatarUrl(): string | null {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    if (!state.loaded || state.owner !== localAccountId()) void refreshMyAvatar();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s.owner === localAccountId() ? s.url : null;
}
