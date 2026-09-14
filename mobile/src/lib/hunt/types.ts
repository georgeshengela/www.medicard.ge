export type HuntMode = 'default' | 'gentle';

export type HuntSnapshot = {
  id: string;
  status: string;
  seq: number;
  simulation: boolean;
  mode: HuntMode;
  attribution?: string;
  modelKey?: string;
  bounds: { south: number; west: number; north: number; east: number; sizeM?: number };
  streets: [number, number][][];
  player: { lat: number; lng: number } | null;
  enemies: { id: string; kind: string; state: string; lat?: number; lng?: number }[];
  capsules: { id: string; state: string; lat?: number; lng?: number }[];
  hunting: boolean;
  huntingMs: number;
  remainingMs: number;
  shields: number;
  combo: number;
  distanceM: number;
  activeMs: number;
  captures: number;
  mission: { key: string; kind: string; target: number; progress: number } | null;
  gpsHint: string | null;
  encounter: { enemyId?: string; expiresAt?: string; preview?: boolean; token?: string } | null;
  coins: {
    rewardsEnabled: boolean;
    confirmed: number;
    dailyLeft: number;
    sessionLeft: number;
    capture: number;
    sessionComplete: number;
    dailyMission: number;
    sessionCap: number;
    dailyCap: number;
    dailyUsed: number;
  };
  qualify: { meters: number; activeMs: number; qualified: boolean };
  serverNow?: string;
  lastAward?: { coins: number; reason?: string | null };
  previewLocal?: boolean;
};

export function gpsHintCopy(
  hint: string | null,
  copy: { gpsWait: string; waitingStop: string; offGraph: string; outOfArea: string },
) {
  if (!hint) return null;
  if (hint === 'WAITING_ACCURACY' || hint === 'ACCURACY') return copy.gpsWait;
  if (hint === 'WAITING_STOP' || hint === 'MOVING') return copy.waitingStop;
  if (hint === 'OFF_GRAPH') return copy.offGraph;
  if (hint === 'OUT_OF_AREA') return copy.outOfArea;
  return copy.gpsWait;
}
