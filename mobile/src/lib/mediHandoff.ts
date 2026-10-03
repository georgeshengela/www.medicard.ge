/**
 * In-memory hand-off from a cycle entry point to Medi (W2-8, brief §7 pillar 2 [კ-10]).
 *
 * The route only carries the neutral question (`/assistant?mode=doctor&prefill=…`, no health values —
 * AGENTS: no health text in URLs). The cycle context waits here, in this JS runtime only (never
 * storage), bound to the account that staged it and to that exact question, for one minute. The
 * consultation takes it once when it opens a new conversation; a second read, another account, another
 * question or a late open finds nothing. A new stage replaces the old one.
 *
 * Pure (no React Native): node tests load it.
 */
import type { CycleMediContext } from './cycleMediContext.ts';

export const MEDI_HANDOFF_TTL_MS = 60_000;

type Staged = { owner: string; question: string; context: CycleMediContext; expires: number };

let staged: Staged | null = null;

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

/** Drop anything staged (an entry point that has no context to give, sign-out). */
export function clearMediHandoff(): void {
  staged = null;
}
