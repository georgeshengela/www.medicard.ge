import type { HuntSnapshot } from './types';

const toRad = (d: number) => (d * Math.PI) / 180;
const EARTH = 6371008.8;

function dest(origin: { lat: number; lng: number }, bearing: number, dist: number) {
  const br = toRad(bearing);
  const la1 = toRad(origin.lat);
  const lo1 = toRad(origin.lng);
  const ad = dist / EARTH;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(ad) + Math.cos(la1) * Math.sin(ad) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(ad) * Math.cos(la1), Math.cos(ad) - Math.sin(la1) * Math.sin(la2));
  return { lat: (la2 * 180) / Math.PI, lng: ((((lo2 * 180) / Math.PI + 540) % 360) - 180) };
}

/** Client-only preview. Never awards coins. Used when Hunt API is missing. */
export function createLocalPreview(origin: { lat: number; lng: number }, mode: 'default' | 'gentle' = 'default'): HuntSnapshot {
  const half = 500;
  const step = 125;
  const streets: [number, number][][] = [];
  const nodes: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const row: [number, number][] = [];
    for (let j = 0; j <= 8; j += 1) {
      const north = dest(origin, 0, half - i * step);
      const p = dest(north, 90, j * step - half);
      nodes.push(p);
      row.push([p.lng, p.lat]);
    }
    streets.push(row);
  }
  for (let j = 0; j <= 8; j += 1) {
    const col: [number, number][] = [];
    for (let i = 0; i <= 8; i += 1) {
      const north = dest(origin, 0, half - i * step);
      const p = dest(north, 90, j * step - half);
      col.push([p.lng, p.lat]);
    }
    streets.push(col);
  }
  const pick = (n: number) => nodes[Math.min(nodes.length - 1, n)];
  return {
    id: `preview-${Date.now()}`,
    status: 'active',
    seq: 1,
    simulation: true,
    previewLocal: true,
    mode,
    attribution: '© OpenStreetMap contributors',
    modelKey: 'virus_1',
    bounds: {
      south: dest(origin, 180, half).lat,
      north: dest(origin, 0, half).lat,
      west: dest(origin, 270, half).lng,
      east: dest(origin, 90, half).lng,
      sizeM: 1000,
    },
    streets,
    player: origin,
    enemies: [
      { id: 'e-1', kind: 'chaser', state: 'active', ...pick(12) },
      { id: 'e-2', kind: 'interceptor', state: 'active', ...pick(20) },
      { id: 'e-3', kind: 'patroller', state: 'active', ...pick(40) },
      { id: 'e-4', kind: 'patroller', state: 'active', ...pick(60) },
    ],
    capsules: [
      { id: 'c-1', state: 'idle', ...pick(15) },
      { id: 'c-2', state: 'idle', ...pick(30) },
      { id: 'c-3', state: 'idle', ...pick(45) },
    ],
    hunting: false,
    huntingMs: 0,
    remainingMs: (mode === 'gentle' ? 20 : 15) * 60_000,
    shields: 3,
    combo: 0,
    distanceM: 0,
    activeMs: 0,
    captures: 0,
    mission: { key: 'capture_2', kind: 'captures', target: 2, progress: 0 },
    gpsHint: null,
    encounter: null,
    coins: {
      rewardsEnabled: false,
      confirmed: 0,
      dailyLeft: 0,
      sessionLeft: 0,
      capture: 1,
      sessionComplete: 5,
      dailyMission: 3,
      sessionCap: 10,
      dailyCap: 20,
      dailyUsed: 0,
    },
    qualify: { meters: mode === 'gentle' ? 150 : 250, activeMs: mode === 'gentle' ? 360000 : 300000, qualified: false },
  };
}

export function bumpPreviewMission(snap: HuntSnapshot, kind: string, amount = 1): HuntSnapshot['mission'] {
  const mission = snap.mission;
  if (!mission || mission.kind !== kind) return mission;
  return { ...mission, progress: Math.min(mission.target, (mission.progress || 0) + amount) };
}

export function takePreviewCapsule(snap: HuntSnapshot, id: string): HuntSnapshot {
  const add = 120_000;
  const stacked = Math.min(240_000, (snap.hunting ? snap.huntingMs : 0) + add);
  let mission = snap.mission;
  if (mission?.kind === 'capsules') mission = bumpPreviewMission(snap, 'capsules');
  else if (mission?.kind === 'hunts') mission = bumpPreviewMission(snap, 'hunts');
  return {
    ...snap,
    hunting: true,
    huntingMs: stacked,
    capsules: snap.capsules.map((c) => (c.id === id ? { ...c, state: 'taken' } : c)),
    mission,
  };
}

export function completePreviewCapture(snap: HuntSnapshot): HuntSnapshot {
  const enemyId = snap.encounter?.enemyId;
  return {
    ...snap,
    status: 'active',
    captures: snap.captures + 1,
    encounter: null,
    enemies: snap.enemies.map((e) => (e.id === enemyId ? { ...e, state: 'captured' } : e)),
    mission: bumpPreviewMission(snap, 'captures'),
  };
}

export function stepLocalPreview(snap: HuntSnapshot, player: { lat: number; lng: number }): HuntSnapshot {
  if (snap.status !== 'active') return { ...snap, player };
  const hunting = snap.hunting && snap.huntingMs > 0;
  const enemies = snap.enemies.map((e) => {
    if (e.state === 'captured' || e.lat == null) return e;
    const pull = hunting ? -0.00012 : 0.00008;
    return {
      ...e,
      lat: e.lat + (player.lat - e.lat) * pull,
      lng: (e.lng || 0) + (player.lng - (e.lng || 0)) * pull,
    };
  });
  const nextHunt = hunting ? Math.max(0, snap.huntingMs - 1000) : 0;
  return {
    ...snap,
    player,
    enemies,
    seq: snap.seq + 1,
    remainingMs: Math.max(0, snap.remainingMs - 1000),
    huntingMs: nextHunt,
    hunting: nextHunt > 0,
  };
}
