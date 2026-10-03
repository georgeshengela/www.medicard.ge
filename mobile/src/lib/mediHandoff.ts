/**
 * In-memory hand-off from another screen to Medi (W2-8, brief §7 pillar 2 [კ-10]; W2-8b).
 *
 * No health text in URLs (AGENTS). A screen that opens the consultation with a drafted question (a
 * cycle alert or tip, the doctor summary, lab values, symptoms) stages that text here and navigates to
 * `/assistant?mode=doctor&handoff=1` — the marker carries nothing. The cycle context (day, phase
 * estimate, today's pain and moods) waits beside it, bound to that exact question.
 *
 * Both slots live in this JS runtime only (never storage), bound to the account that staged them, for
 * one minute, and are consume-once: the consultation takes them when it opens a new conversation; a
 * second read, another account or a late open finds nothing. A new stage replaces the old one.
 *
 * Older routes keep working: `/assistant?mode=doctor&prefill=…` from push notifications and fixed
 * copy (Home chips' neutral questions) still fills the composer.
 *
 * Pure (no React Native): node tests load it.
 */
import type { CycleMediContext } from './cycleMediContext.ts';
import { mediRoute, type MediMode } from './mediModes.ts';

export const MEDI_HANDOFF_TTL_MS = 60_000;
/** Query marker for „a drafted question waits in memory“ (`handoff=1`). Carries no text. */
export const MEDI_HANDOFF_PARAM = 'handoff';
/** Same bound as the consultation's message limit; longer drafts are cut, never sent as they are. */
export const MEDI_PREFILL_MAX = 4000;

type Staged = { owner: string; question: string; context: CycleMediContext; expires: number };
type StagedPrefill = { owner: string; text: string; expires: number };

let staged: Staged | null = null;
let stagedPrefill: StagedPrefill | null = null;

/** Put the context aside for the next Medi consultation `owner` opens with `question`. */
export function stageMediCycleContext(owner: string, question: string, context: CycleMediContext | null, now = Date.now()): boolean {
  if (!owner || !question || !context) {
    staged = null;
    return false;
  }
  staged = { owner, question: question.trim(), context, expires: now + MEDI_HANDOFF_TTL_MS };
  return true;
}

/** Consume-once: the staged context when owner, question and time all match, else null. Always clears. */
export function takeMediCycleContext(owner: string | null | undefined, question: string | null | undefined, now = Date.now()): CycleMediContext | null {
  const current = staged;
  if (!current) return null;
  staged = null;
  if (!owner || current.owner !== owner) return null;
  if (String(question ?? '').trim() !== current.question) return null;
  if (current.expires < now) return null;
  return current.context;
}

/** Put a drafted question aside for the next consultation `owner` opens with the handoff marker. */
export function stageMediPrefill(owner: string | null | undefined, text: string | null | undefined, now = Date.now()): boolean {
  const value = String(text ?? '').trim().slice(0, MEDI_PREFILL_MAX);
  if (!owner || !value) {
    stagedPrefill = null;
    return false;
  }
  stagedPrefill = { owner, text: value, expires: now + MEDI_HANDOFF_TTL_MS };
  return true;
}

/** Consume-once: the drafted question when the account and time match, else null. Always clears. */
export function takeMediPrefill(owner: string | null | undefined, now = Date.now()): string | null {
  const current = stagedPrefill;
  if (!current) return null;
  stagedPrefill = null;
  if (!owner || current.owner !== owner) return null;
  if (current.expires < now) return null;
  return current.text;
}

/**
 * Stage `text` for `owner` and return the route to push: `/assistant?mode=<mode>&handoff=1` when it was
 * staged, the plain mode route (empty composer) when there is no account or no text. Never the text.
 */
export function mediPrefillRoute(owner: string | null | undefined, text: string | null | undefined, mode: MediMode = 'doctor', now = Date.now()): string {
  return stageMediPrefill(owner, text, now) ? mediRoute({ mode, handoff: true }) : mediRoute({ mode });
}

/** Drop anything staged (an entry point that has no context to give, sign-out). */
export function clearMediHandoff(): void {
  staged = null;
  stagedPrefill = null;
}
