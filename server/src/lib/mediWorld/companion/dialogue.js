export const CARE_MOMENT_KEYS = Object.freeze(['greet', 'breathe', 'quiet', 'stretch', 'celebrate']);

export function isCareMomentKey(key) {
  return CARE_MOMENT_KEYS.includes(String(key || ''));
}

export function resolveCareDialogue({
  firstVisitToday,
  alreadyVisited,
  newlyUnlockedStages,
  cosmeticUnlockedToday,
  returnedAfterInactivity,
  radiant,
} = {}) {
  if (radiant) return 'radiant';
  if (newlyUnlockedStages?.length) return 'new_evolution';
  if (cosmeticUnlockedToday) return 'cosmetic_unlocked';
  if (returnedAfterInactivity) return 'returned_after_inactivity';
  if (firstVisitToday) return 'first_visit_today';
  if (alreadyVisited) return 'already_visited';
  return 'first_visit_today';
}
