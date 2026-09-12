import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ka } from '@/i18n/ka';
import { API_BASE_URL, ApiError } from '@/lib/api';
import { consumeSseBuffer } from '@/lib/sseParse';
import { getToken } from '@/lib/storage';

function timezoneHeaders() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? { 'X-Client-Timezone': tz } : {};
  } catch {
    return {};
  }
}

function authHeaders(token) {
  return {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'X-Medicard-Platform': Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    'X-Medicard-App-Version': String(Constants.expoConfig?.version || ''),
    ...timezoneHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function throwHttpError(status, text, retryAfter) {
  const payload = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
  const message =
    (typeof payload?.error === 'string' && payload.error) || `${ka.common.error} (${status})`;
  throw new ApiError(message, status, payload, retryAfter);
}

function applyEvents(events, onDelta) {
  let done = null;
  for (const event of events) {
    if (event?.type === 'delta' && event.text) {
      onDelta?.(event.text);
    } else if (event?.type === 'done') {
      done = event;
    } else if (event?.type === 'error') {
      throw new ApiError(
        event.error || ka.common.error,
        Number(event.status) || 502,
        { code: 'AI_ENGINE_ERROR' },
      );
    }
  }
  return done;
}

/**
 * Streams POST /api/ai/query. Tokens arrive via onDelta as Medi writes.
 */
export async function streamAiQuery(body, { onDelta, signal } = {}) {
  try {
    const token = await getToken();
    const { fetch: expoFetch } = await import('expo/fetch');
    const response = await expoFetch(`${API_BASE_URL}/api/ai/query`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });

    const contentType = String(response.headers.get('content-type') || '');
    if (!response.ok || !contentType.includes('text/event-stream')) {
      const text = await response.text();
      if (response.ok && text) {
        const payload = JSON.parse(text);
        if (payload?.answer) {
          onDelta?.(payload.answer);
          return payload;
        }
      }
      throwHttpError(response.status, text, response.headers.get('Retry-After'));
    }

    const reader = response.body?.getReader?.();
    if (!reader) {
      const text = await response.text();
      const parsed = consumeSseBuffer(`${text}\n\n`);
      const done = applyEvents(parsed.events, onDelta);
      if (done) return done;
      throw new ApiError(ka.common.error, 502);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let done = null;
    while (true) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = consumeSseBuffer(buffer);
      buffer = parsed.rest;
      const hit = applyEvents(parsed.events, onDelta);
      if (hit) done = hit;
    }
    if (buffer.trim()) {
      const parsed = consumeSseBuffer(`${buffer}\n\n`);
      const hit = applyEvents(parsed.events, onDelta);
      if (hit) done = hit;
    }
    if (!done) {
      throw new ApiError(ka.common.error, 502);
    }
    return done;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError') throw new ApiError('მოთხოვნა გაუქმდა.', 499);
    throw new ApiError(ka.common.networkError, 0);
  }
}
