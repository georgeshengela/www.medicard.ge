/**
 * Medi World Phase 41 — curated narrative keys. Store keys, never rendered copy.
 */

export const ADVENTURE_NARRATIVE_KEYS = Object.freeze([
  'open.ready',
  'open.small',
  'open.rest',
  'open.recovery',
  'path.choice',
  'complete.enough',
  'complete.rest',
  'return.later',
]);

export function narrativeKeyForPlan({ restDay, empty, intensity, hasChoice }) {
  if (restDay && empty) return 'open.recovery';
  if (restDay) return 'open.rest';
  if (intensity === 'gentle') return 'open.small';
  if (hasChoice) return 'path.choice';
  return 'open.ready';
}

export function narrativeKeyForState({ restDay, completed, expired, empty }) {
  if (expired) return 'return.later';
  if (restDay && completed) return 'complete.rest';
  if (restDay && empty) return 'open.recovery';
  if (restDay) return 'open.rest';
  if (completed) return 'complete.enough';
  if (empty) return 'open.recovery';
  return 'open.ready';
}

export function companionReactionKey({ restDay, completed, empty }) {
  if (restDay && empty) return 'adventure_recovery';
  if (restDay) return 'adventure_rest';
  if (completed) return 'adventure_complete';
  return 'adventure_path';
}
