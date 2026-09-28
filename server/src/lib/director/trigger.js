/**
 * Wakes the Director's brain (a Claude Code cloud routine) through its API trigger:
 * POST https://api.anthropic.com/v1/claude_code/routines/{id}/fire — research-preview API
 * (beta header below), so failures are logged, never thrown. Owner messages arriving in a burst
 * collapse into one run (DEBOUNCE_MS); without DIRECTOR_ROUTINE_URL the scheduled runs still work.
 */
import { getState, touchState } from './store.js';

const BETA = 'experimental-cc-routine-2026-04-01';
const DEBOUNCE_MS = 45_000;
let timer = null;
let reasons = [];

export const routineConfigured = () => Boolean(process.env.DIRECTOR_ROUTINE_URL && process.env.DIRECTOR_ROUTINE_TOKEN);

async function fire(text, { fetchImpl = fetch } = {}) {
  const url = process.env.DIRECTOR_ROUTINE_URL;
  if (!/^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[\w-]+\/fire$/.test(url || '')) {
    console.warn('[director] DIRECTOR_ROUTINE_URL is not a routine /fire URL — trigger skipped');
    return { ok: false, skipped: 'url' };
  }
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.DIRECTOR_ROUTINE_TOKEN}`,
      'anthropic-beta': BETA,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text: String(text).slice(0, 2000) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    console.warn('[director] routine trigger failed', res.status);
    return { ok: false, status: res.status };
  }
  const json = await res.json().catch(() => ({}));
  await touchState('lastTriggerAt').catch(() => {});
  return { ok: true, sessionUrl: json.claude_code_session_url || null };
}

/**
 * Asks the brain to run soon. `immediate` skips the debounce (shift start from admin).
 * Only fires while the Director is on shift.
 */
export async function wakeBrain(reason, { immediate = false } = {}) {
  if (!routineConfigured()) return { ok: false, skipped: 'not-configured' };
  const state = await getState().catch(() => null);
  if (!state?.active) return { ok: false, skipped: 'off-shift' };
  reasons.push(String(reason).slice(0, 300));
  if (immediate) {
    clearTimeout(timer);
    timer = null;
    const text = reasons.splice(0).join('\n');
    return fire(text).catch((e) => ({ ok: false, error: e.message }));
  }
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      fire(reasons.splice(0).join('\n')).catch((e) => console.warn('[director] trigger error', e.message));
    }, DEBOUNCE_MS);
    timer.unref?.();
  }
  return { ok: true, queued: true };
}
