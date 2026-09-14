import { DEFAULT_MEDICARD_VERSION } from '@/lib/medicardVersion';
import { api, ApiError } from '@/lib/api';
import type { HuntMode, HuntSnapshot } from './types';

export async function huntPublicStatus() {
  try {
    const s = await api.app.status(DEFAULT_MEDICARD_VERSION);
    return (s as { hunt?: { enabled?: boolean; rewardsEnabled?: boolean; schemaReady?: boolean } }).hunt || null;
  } catch {
    return null;
  }
}

export async function startHunt(body: {
  lat: number;
  lng: number;
  accuracy?: number;
  mode?: HuntMode;
  simulation?: boolean;
}) {
  return api.hunt.start(body);
}

export async function pingHunt(id: string, samples: HuntSnapshot extends never ? never : { lat: number; lng: number; accuracy: number; at: number }[]) {
  return api.hunt.ping(id, { samples });
}

export function isHuntUnavailable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return (
    error.status === 404 ||
    error.status === 503 ||
    error.code === 'HUNT_SCHEMA_UNAVAILABLE' ||
    error.code === 'HUNT_GRAPH_UNAVAILABLE'
  );
}
