import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { appLang, tx } from '@/i18n/locale';
import { API_BASE_URL, ApiError, ensureAiSharingConsentForRequest } from '@/lib/api';
import { markReachable } from '@/lib/reachability';
import { consumeSseBuffer } from '@/lib/sseParse';
import { getToken } from '@/lib/storage';
import type { Triage } from './familyApi';

type Done = { sessionId: string; messageId: string; content: string; triage: Triage };
type Handlers = { onStart?: (e: { sessionId: string; triage: Triage }) => void; onDelta?: (text: string) => void; signal?: AbortSignal };

function headers(token: string | null) {
  let tz: string | undefined;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = undefined; }
  return {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'X-Medicard-Platform': Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    'X-Medicard-App-Version': String(Constants.expoConfig?.version || ''),
    'X-Medicard-Lang': appLang(),
    ...(tz ? { 'X-Client-Timezone': tz } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function apply(events: any[], h: Handlers): Done | null {
  let done: Done | null = null;
  for (const event of events) {
    if (event?.type === 'start') h.onStart?.({ sessionId: event.sessionId, triage: event.triage ?? null });
    else if (event?.type === 'delta' && event.text) h.onDelta?.(event.text);
    else if (event?.type === 'done') done = event as Done;
    else if (event?.type === 'error') throw new ApiError(event.error || tx('Medi-მ ვერ უპასუხა.', 'Medi could not answer.'), Number(event.status) || 502, { code: 'AI_ENGINE_ERROR' });
  }
  return done;
}

/**
 * Streams POST /api/family/members/:id/chat/query. The first event carries the rule triage, so an
 * emergency card shows before Medi writes a word. AI consent is checked first (the app's one gate).
 */
export async function streamFamilyChat(memberId: string, body: { message: string; sessionId?: string; clientRequestId: string }, h: Handlers = {}): Promise<Done> {
  const path = `/api/family/members/${memberId}/chat/query`;
  try {
    const token = await getToken();
    await ensureAiSharingConsentForRequest(path, 'POST', token);
    if (h.signal?.aborted) throw new ApiError(tx('მოთხოვნა გაუქმდა.', 'Request canceled.'), 499);
    // expo/fetch streams on native; if it cannot load, the platform fetch still answers (in one piece).
    let streamFetch: typeof fetch = fetch;
    try { streamFetch = (await import('expo/fetch')).fetch as unknown as typeof fetch; } catch { streamFetch = fetch; }
    const response = await streamFetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: headers(token), body: JSON.stringify({ ...body, stream: true }), signal: h.signal });
    markReachable();
    const type = String(response.headers.get('content-type') || '');
    if (!response.ok || !type.includes('text/event-stream')) {
      const text = await response.text();
      let payload: any = {};
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
      if (response.ok && payload?.answer) {
        h.onDelta?.(payload.answer.content || '');
        return { sessionId: payload.sessionId, messageId: payload.answer.id, content: payload.answer.content || '', triage: payload.answer.triage ?? null };
      }
      throw new ApiError(typeof payload?.error === 'string' ? payload.error : tx('Medi-მ ვერ უპასუხა.', 'Medi could not answer.'), response.status, payload, response.headers.get('Retry-After') as any);
    }
    const reader = (response.body as any)?.getReader?.();
    let done: Done | null = null;
    if (!reader) {
      const parsed = consumeSseBuffer(`${await response.text()}\n\n`);
      done = apply(parsed.events, h);
    } else {
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = consumeSseBuffer(buffer);
        buffer = parsed.rest;
        done = apply(parsed.events, h) || done;
      }
      if (buffer.trim()) done = apply(consumeSseBuffer(`${buffer}\n\n`).events, h) || done;
    }
    if (!done) throw new ApiError(tx('პასუხი ბოლომდე ვერ მოვიდა — სცადე თავიდან.', 'The answer did not arrive in full — try again.'), 502, { code: 'PARTIAL' });
    return done;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    if (__DEV__) console.warn('[family-chat] stream failed', error?.name, error?.message);
    if (error?.name === 'AbortError') throw new ApiError(tx('მოთხოვნა გაუქმდა.', 'Request canceled.'), 499, { code: 'CANCELLED' });
    throw new ApiError(tx('ინტერნეტთან კავშირი ვერ დამყარდა.', 'Could not connect to the internet.'), 0);
  }
}
