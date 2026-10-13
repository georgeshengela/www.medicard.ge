import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { appLang, tx } from '@/i18n/locale';
import { API_BASE_URL, ApiError, ensureAiSharingConsentForRequest } from '@/lib/api';
import { markReachable } from '@/lib/reachability';
import { consumeSseBuffer } from '@/lib/sseParse';
import { getToken } from '@/lib/storage';
import type { OracleCard } from './horoscopeApi';

type Done = { sessionId: string; content: string; cards: OracleCard[] | null };
type Handlers = { onStart?: (e: { sessionId: string; cards: OracleCard[] | null }) => void; onDelta?: (text: string) => void; signal?: AbortSignal };

const FAILED = () => tx('ორაკულმა ვერ გიპასუხა.', 'The Oracle could not answer.');

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
    if (event?.type === 'start') h.onStart?.({ sessionId: event.sessionId, cards: event.cards ?? null });
    else if (event?.type === 'delta' && event.text) h.onDelta?.(event.text);
    else if (event?.type === 'done') done = { sessionId: event.sessionId, content: event.answer?.content || '', cards: event.answer?.cards ?? null };
    else if (event?.type === 'error') throw new ApiError(event.error || FAILED(), Number(event.status) || 502, { code: 'AI_ENGINE_ERROR' });
  }
  return done;
}

/**
 * Streams POST /api/horoscope/oracle/query. The first event carries the drawn tarot cards (if the question asked
 * for them), so the cards turn over while the Oracle starts to speak. AI consent is checked first.
 */
export async function streamOracle(body: { message: string; sessionId?: string; clientRequestId: string }, h: Handlers = {}): Promise<Done> {
  const path = '/api/horoscope/oracle/query';
  try {
    const token = await getToken();
    await ensureAiSharingConsentForRequest(path, 'POST', token);
    if (h.signal?.aborted) throw new ApiError(tx('მოთხოვნა გაუქმდა.', 'Request canceled.'), 499);
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
        h.onStart?.({ sessionId: payload.sessionId, cards: payload.answer.cards ?? null });
        h.onDelta?.(payload.answer.content || '');
        return { sessionId: payload.sessionId, content: payload.answer.content || '', cards: payload.answer.cards ?? null };
      }
      throw new ApiError(typeof payload?.error === 'string' ? payload.error : FAILED(), response.status, payload, response.headers.get('Retry-After') as any);
    }
    const reader = (response.body as any)?.getReader?.();
    let done: Done | null = null;
    if (!reader) {
      done = apply(consumeSseBuffer(`${await response.text()}\n\n`).events, h);
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
    if (error?.name === 'AbortError') throw new ApiError(tx('მოთხოვნა გაუქმდა.', 'Request canceled.'), 499, { code: 'CANCELLED' });
    throw new ApiError(tx('ინტერნეტთან კავშირი ვერ დამყარდა.', 'Could not connect to the internet.'), 0);
  }
}
