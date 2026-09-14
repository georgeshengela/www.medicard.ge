import { huntSourceId } from './config.js';
import { questYmd } from '../questTime.js';

export const HUNT_MISSIONS = Object.freeze([
  { key: 'capture_2', kind: 'captures', target: 2, titleKey: 'missionCapture' },
  { key: 'walk_250', kind: 'meters', target: 250, titleKey: 'missionWalk' },
  { key: 'hunt_once', kind: 'hunts', target: 1, titleKey: 'missionHunt' },
  { key: 'capsules_3', kind: 'capsules', target: 3, titleKey: 'missionCapsules' },
]);

export function missionForDay(periodKey) {
  const n = String(periodKey || '')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return HUNT_MISSIONS[n % HUNT_MISSIONS.length];
}

export function huntDayKey(now, timezone) {
  return questYmd(now, timezone);
}

export function ledgerHuntCoins(rows, { dayKey, sessionId } = {}) {
  let daily = 0;
  let session = 0;
  for (const row of rows || []) {
    if (row.currency !== 'COIN' || row.sourceType !== 'HUNT' || row.amount <= 0) continue;
    if (dayKey && row.dayKey && row.dayKey !== dayKey) continue;
    daily += row.amount;
    if (sessionId && String(row.sourceId || '').includes(`:${sessionId}`)) session += row.amount;
    if (sessionId && String(row.sourceId || '').includes(`session:${sessionId}`)) session += row.amount;
  }
  return { daily, session };
}

export function clampAward(want, { daily, session, config }) {
  const need = Math.max(0, Math.floor(Number(want) || 0));
  if (!need) return 0;
  const dailyLeft = Math.max(0, config.coins.dailyCap - daily);
  const sessionLeft = Math.max(0, config.coins.sessionCap - session);
  return Math.min(need, dailyLeft, sessionLeft);
}

export function qualifiedSession(session, config) {
  const meters = session.mode === 'gentle' ? config.qualify.gentleMeters : config.qualify.meters;
  const activeMs = session.mode === 'gentle' ? config.qualify.gentleActiveMs : config.qualify.activeMs;
  return session.distanceM >= meters && session.activeMs >= activeMs;
}

export function captureSourceId(captureId) {
  return huntSourceId('capture', captureId);
}

export function sessionCompleteSourceId(sessionId) {
  return huntSourceId('session', `${sessionId}:complete`);
}

export function missionSourceId(userId, periodKey, missionKey) {
  return huntSourceId('mission', `${userId}:${periodKey}:${missionKey}`);
}
