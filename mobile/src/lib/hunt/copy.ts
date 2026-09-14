import { huntCopy } from '@/i18n/hunt/catalog.js';

export function huntLocaleFromTag(tag = 'ka') {
  const t = String(tag || 'ka').slice(0, 2).toLowerCase();
  if (t === 'en' || t === 'fr' || t === 'ru') return t;
  return 'ka';
}

export function h(locale = 'ka') {
  return huntCopy(huntLocaleFromTag(locale));
}

export function missionLabel(key, locale = 'ka') {
  const copy = h(locale);
  if (key === 'capture_2') return copy.missionCapture;
  if (key === 'walk_250') return copy.missionWalk;
  if (key === 'hunt_once') return copy.missionHunt;
  if (key === 'capsules_3') return copy.missionCapsules;
  return copy.dailyMission;
}
