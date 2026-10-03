/**
 * In-memory hand-off of a drafted note into `/cycle/log` (W2-9, brief §9 wave 2 item 13).
 *
 * No health text in URLs (AGENTS). A cycle tip that opens the day log with a ready note stages the
 * text here and navigates with the marker `note=1` only. Same rules as `mediHandoff.ts`: this JS
 * runtime only (never storage), bound to the account that staged it, one minute, consume-once — the
 * log screen takes it when it fills an empty day; a second read, another account or a late open
 * finds nothing. A new stage replaces the old one.
 *
 * Push notifications never carried a note (they open `/cycle/log` plain), so no old param is kept.
 *
 * Pure (no React Native): node tests load it.
 */

export const CYCLE_LOG_HANDOFF_TTL_MS = 60_000;
/** Query marker for „a drafted note waits in memory“. Carries no text. */
export const CYCLE_LOG_NOTE_PARAM = 'note';
/** Same bound as the server's log notes (`notes` max 2000). */
export const CYCLE_LOG_NOTE_MAX = 2000;

type Staged = { owner: string; text: string; expires: number };

let staged: Staged | null = null;

/** Put a drafted note aside for the next `/cycle/log` that `owner` opens with the marker. */
export function stageCycleLogNote(owner: string | null | undefined, text: string | null | undefined, now = Date.now()): boolean {
  const value = String(text ?? '').trim().slice(0, CYCLE_LOG_NOTE_MAX);
  if (!owner || !value) {
    staged = null;
    return false;
  }
  staged = { owner, text: value, expires: now + CYCLE_LOG_HANDOFF_TTL_MS };
  return true;
}

/** Consume-once: the staged note when the account and time match, else null. Always clears. */
export function takeCycleLogNote(owner: string | null | undefined, now = Date.now()): string | null {
  const current = staged;
  if (!current) return null;
  staged = null;
  if (!owner || current.owner !== owner) return null;
  if (current.expires < now) return null;
  return current.text;
}

/**
 * Stage `text` for `owner` and return the route params to add: `{ note: '1' }` when it was staged,
 * nothing when there is no account or no text. Never the text itself.
 */
export function cycleLogNoteParams(
  owner: string | null | undefined,
  text: string | null | undefined,
  now = Date.now(),
): Record<string, string> {
  return stageCycleLogNote(owner, text, now) ? { [CYCLE_LOG_NOTE_PARAM]: '1' } : {};
}

/** True when the route says a note waits in memory. */
export function hasCycleLogNoteMarker(value: unknown): boolean {
  return value === '1' || (Array.isArray(value) && value[0] === '1');
}

/** Drop anything staged (sign-out, tests). */
export function clearCycleLogHandoff(): void {
  staged = null;
}
