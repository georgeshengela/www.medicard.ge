/**
 * One Medi (Phase 2.1, 2026-09-27): /assistant is the only Medi screen with three modes.
 *   medi   — actions, handoffs and quick answers (the assistant planner)
 *   doctor — the clinical consultation (/api/ai/query, DOCTOR)
 *   deep   — "ღრმა ანალიზი", the former consilium (/api/ai/query, CONSILIUM)
 * Old /chat/* links, push routes and saved sessions all resolve here. Pure: no I/O.
 */
export type MediMode = 'medi' | 'doctor' | 'deep';
export type ChatSessionMode = 'DOCTOR' | 'CONSILIUM' | 'ASSISTANT';

export const MEDI_MODES: readonly MediMode[] = ['medi', 'doctor', 'deep'];

/** Accepts every historic spelling: doctor/DOCTOR, consilium/CONSILIUM, deep, assistant. */
export function mediModeFromParam(raw: string | string[] | undefined | null): MediMode {
  const value = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim().toLowerCase();
  if (value === 'doctor') return 'doctor';
  if (value === 'deep' || value === 'consilium') return 'deep';
  return 'medi';
}

export function apiModeFor(mode: MediMode): 'DOCTOR' | 'CONSILIUM' | null {
  return mode === 'doctor' ? 'DOCTOR' : mode === 'deep' ? 'CONSILIUM' : null;
}

export function mediModeForSession(mode: string | null | undefined): MediMode {
  return mode === 'CONSILIUM' ? 'deep' : mode === 'DOCTOR' ? 'doctor' : 'medi';
}

export function mediRoute({ mode = 'medi', sessionId, prefill }: { mode?: MediMode; sessionId?: string | null; prefill?: string | null } = {}): string {
  const q = new URLSearchParams();
  if (mode !== 'medi') q.set('mode', mode);
  if (sessionId) q.set('sessionId', sessionId);
  if (prefill) q.set('prefill', prefill);
  const qs = q.toString();
  return '/assistant' + (qs ? '?' + qs : '');
}

/** Legacy /chat/<mode>?sessionId=…&prefill=… → the one Medi screen. Other routes pass through. */
export function legacyChatRouteToMedi(route: string): string {
  const match = /^\/chat\/([^/?#]+)(\?[^#]*)?$/.exec(route);
  if (!match) return route;
  const params = new URLSearchParams(match[2]?.slice(1) ?? '');
  return mediRoute({ mode: mediModeFromParam(match[1]) === 'medi' ? 'doctor' : mediModeFromParam(match[1]), sessionId: params.get('sessionId'), prefill: params.get('prefill') });
}
