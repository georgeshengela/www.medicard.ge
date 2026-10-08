/**
 * Gemini 3 always thinks, and its thinking tokens are counted inside `max_tokens`. A request that asks
 * for a 2 000-token answer therefore often got ~100 visible tokens: the model spent the rest thinking,
 * stopped with finish_reason "length" and the person saw a fragment (2026-10-06: a real lab sheet came
 * back as „89 მმოლ/ლ …“, 4 of 5 consiliums and every lab read were cut). Callers keep meaning
 * `max_tokens` = the visible answer they need; every OpenRouter request gets this thinking room added
 * on top in `consentedAiFetch`. Only used tokens are billed, so the headroom costs nothing when unused.
 */

const HEADROOM = Object.freeze({
  none: 0,
  minimal: 2048,
  low: 6000,
  medium: 12000,
  high: 24000,
  /** No effort given: Gemini decides dynamically and can think as much as at medium/high. */
  default: 16000,
});

/** Gemini 3 Flash output ceiling (with a margin). */
export const MAX_COMPLETION_TOKENS = 64000;

export function thinksByDefault(model) {
  return String(model || '').includes('gemini-3');
}

export function reasoningHeadroom(payload) {
  if (!payload || !thinksByDefault(payload.model)) return 0;
  const reasoning = payload.reasoning;
  if (reasoning && typeof reasoning === 'object') {
    // An explicit thinking budget or thinking switched off: the caller already accounted for it.
    if (reasoning.enabled === false || reasoning.max_tokens != null) return 0;
    if (reasoning.effort && HEADROOM[reasoning.effort] != null) return HEADROOM[reasoning.effort];
  }
  return HEADROOM.default;
}

/** Returns a copy of an OpenRouter chat payload whose max_tokens leaves room for thinking. */
export function withReasoningHeadroom(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const visible = Number(payload.max_tokens ?? payload.max_completion_tokens);
  if (!Number.isFinite(visible) || visible <= 0) return payload;
  const extra = reasoningHeadroom(payload);
  if (!extra) return payload;
  const total = Math.min(MAX_COMPLETION_TOKENS, Math.round(visible) + extra);
  const next = { ...payload, max_tokens: total };
  delete next.max_completion_tokens;
  return next;
}
