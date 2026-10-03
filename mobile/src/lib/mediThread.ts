/**
 * One Medi chat (owner 2026-10-03): Medi, the doctor and the consilium are one conversation.
 *   - Every message goes to the planner (actions, reminders, opening a page, short replies).
 *   - A health question comes back as a `consult` action; the thread then streams the clinical answer
 *     (/api/ai/query DOCTOR) in place, no extra tap.
 *   - The consilium switch sends straight to /api/ai/query CONSILIUM.
 * Storage stays as it was: the thread is an ASSISTANT ChatSession; each clinical answer also lives in its
 * own DOCTOR / CONSILIUM session (AI context reads those) and the thread's copy links to it.
 * Pure: no I/O, no React.
 */
import type { AssistantReview } from './assistant';
import { isEn } from '../i18n/locale.js';
import type { ChatMessage } from './api';

export type ClinicalMode = 'DOCTOR' | 'CONSILIUM';
export type ActionState = 'pending' | 'saved' | 'opened' | 'cancelled';

export type MediTurn =
  | { id: string; kind: 'user'; text: string; at: string }
  | { id: string; kind: 'medi'; text: string; at: string }
  | { id: string; kind: 'answer'; deep: boolean; text: string; at: string; streaming?: boolean; interactionId?: string; feedbackRating?: 1 | -1; sessionId?: string }
  | { id: string; kind: 'action'; review: AssistantReview; state: ActionState; at: string };

export type StoredTurn = { role: 'user' | 'assistant'; content: string; kind?: 'answer' | 'deep'; linkedSessionId?: string };

let counter = 0;
export function turnId(): string {
  counter = (counter + 1) % 1_000_000;
  return `t${Date.now().toString(36)}${counter.toString(36)}`;
}

const ANSWER_IN_HISTORY = 1500;

/** What the planner sees: words only, newest last, clinical answers shortened, action cards left out. */
export function plannerHistory(turns: readonly MediTurn[], limit = 10): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const turn of turns) {
    if (turn.kind === 'user') out.push({ role: 'user', content: turn.text.slice(0, 4000) });
    else if (turn.kind === 'medi') out.push({ role: 'assistant', content: turn.text.slice(0, 4000) });
    else if (turn.kind === 'answer' && turn.text && !turn.streaming) {
      out.push({ role: 'assistant', content: turn.text.length > ANSWER_IN_HISTORY ? turn.text.slice(0, ANSWER_IN_HISTORY) + '…' : turn.text });
    }
  }
  return out.filter(t => t.content.trim()).slice(-limit);
}

/** A saved conversation back into turns. ASSISTANT threads keep their kinds; old consultations become answers. */
export function turnsFromSession(session: { id: string; mode: 'DOCTOR' | 'CONSILIUM' | 'ASSISTANT'; messages?: ChatMessage[] | null }): MediTurn[] {
  const deepSession = session.mode === 'CONSILIUM';
  return (session.messages ?? []).filter(m => typeof m?.content === 'string' && m.content.trim()).map((m): MediTurn => {
    const at = m.timestamp || new Date(0).toISOString();
    if (m.role === 'user') return { id: turnId(), kind: 'user', text: m.content, at };
    if (session.mode === 'ASSISTANT' && !m.kind) return { id: turnId(), kind: 'medi', text: m.content, at };
    return {
      id: turnId(), kind: 'answer', deep: session.mode === 'ASSISTANT' ? m.kind === 'deep' : deepSession, text: m.content, at,
      interactionId: m.interactionId, feedbackRating: m.feedbackRating,
      sessionId: session.mode === 'ASSISTANT' ? m.linkedSessionId : session.id,
    };
  });
}

/** The consultation sessions a reopened thread continues (the latest answer of each kind). */
export function clinicalSessions(turns: readonly MediTurn[]): Partial<Record<ClinicalMode, string>> {
  const out: Partial<Record<ClinicalMode, string>> = {};
  for (const turn of turns) if (turn.kind === 'answer' && turn.sessionId) out[turn.deep ? 'CONSILIUM' : 'DOCTOR'] = turn.sessionId;
  return out;
}

/** Turns as stored in the ASSISTANT thread. Unfinished answers and action cards are not stored. */
export function storedTurns(turns: readonly MediTurn[]): StoredTurn[] {
  const out: StoredTurn[] = [];
  for (const turn of turns) {
    if (turn.kind === 'user') out.push({ role: 'user', content: turn.text });
    else if (turn.kind === 'medi') out.push({ role: 'assistant', content: turn.text });
    else if (turn.kind === 'answer' && !turn.streaming && turn.text.trim()) {
      out.push({ role: 'assistant', content: turn.text, kind: turn.deep ? 'deep' : 'answer', ...(turn.sessionId ? { linkedSessionId: turn.sessionId } : {}) });
    }
  }
  return out.filter(t => t.content.trim());
}

/** The planner asked for the clinical model: the question to send and the mode it asked for. */
export function consultFromReview(review: AssistantReview | null | undefined, fallback: string): { message: string; mode: ClinicalMode } | null {
  if (!review || review.tool !== 'consult') return null;
  const message = typeof review.args.message === 'string' && review.args.message.trim().length >= 2 ? review.args.message.trim() : fallback.trim();
  return { message: message.slice(0, 4000), mode: review.args.mode === 'CONSILIUM' ? 'CONSILIUM' : 'DOCTOR' };
}

const MONTHS_KA = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Card values in words: an ISO date never reaches the screen („4 ოქტომბერი“, the year only when it is not this year). */
export function humanCardValue(value: string, today: Date = new Date(), en: boolean = isEn()): string {
  return value.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (all, y, m, d) => {
    const month = (en ? MONTHS_EN : MONTHS_KA)[Number(m) - 1];
    if (!month) return all;
    const day = `${Number(d)} ${month}`;
    return Number(y) === today.getFullYear() ? day : `${day} ${y}`;
  });
}

/** Rows shown on an action card: what is being saved, without the plumbing fields. */
export const HIDDEN_ACTION_FIELDS: readonly string[] = ['recurrenceBasis', 'source', 'timeMode', 'timezone'];
