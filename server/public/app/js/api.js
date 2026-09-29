// MEDICARD web — API client. Same /api the mobile app uses, same Bearer JWT.
import { lang, t } from './i18n.js';
const TOKEN_KEY = 'medicard.web.token';
const listeners = new Set();

let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch { token = null; }

export function getToken() { return token; }

export function setToken(next) {
  token = next || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode: session-only */ }
  listeners.forEach((fn) => fn(token));
}

export function onTokenChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body || {};
    this.code = this.body.code || null;
  }
}

function timezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; }
}

function headers(extra = {}, withJson = true) {
  const h = {
    Accept: 'application/json',
    'X-Medicard-Platform': 'web',
    'X-Medicard-App-Version': 'web',
    'X-Medicard-Lang': lang,
    ...extra,
  };
  const tz = timezone();
  if (tz) h['X-Client-Timezone'] = tz;
  if (withJson) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/* Short-lived GET cache: pages re-read on every visit but show the last value at once. */
const cache = new Map();
const CACHE_MS = 30_000;

export function cached(path) {
  const hit = cache.get(path);
  return hit ? hit.data : undefined;
}

export function invalidate(prefix = '') {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

/**
 * request('/api/x', { method, body, query, timeoutMs, raw })
 * Throws ApiError with the server's Georgian `error` text.
 */
export async function request(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  let url = path;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }

  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 30_000);
  // A caller's signal (page exit, stop button) and our timeout both abort the same request.
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: headers(opts.headers, !isForm && opts.body !== undefined),
      body: opts.body === undefined ? undefined : isForm ? opts.body : JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') throw new ApiError(t('სერვერი დიდხანს არ პასუხობს. სცადე ხელახლა.', 'The server is taking too long. Please try again.'), 0);
    throw new ApiError(t('ინტერნეტთან კავშირი ვერ დამყარდა.', 'Couldn’t connect to the internet.'), 0);
  }
  clearTimeout(timer);

  if (opts.raw) return res;

  let body = null;
  const text = await res.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = { error: text.slice(0, 200) }; }
  }

  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/phone')) {
      setToken(null);
    }
    const msg = body?.error || body?.message || (res.status === 429
      ? t('ძალიან ბევრი მოთხოვნაა. სცადე ცოტა ხანში.', 'Too many requests. Please try again in a moment.')
      : res.status >= 500 ? t('სერვერზე შეცდომაა. სცადე ხელახლა.', 'Something went wrong on our side. Please try again.') : t('მოთხოვნა ვერ შესრულდა.', 'The request didn’t go through.'));
    throw new ApiError(typeof msg === 'string' ? msg : t('მოთხოვნა ვერ შესრულდა.', 'The request didn’t go through.'), res.status, body);
  }

  if (method === 'GET') cache.set(url, { data: body, at: Date.now() });
  else invalidateAfterWrite(path);
  return body;
}

function invalidateAfterWrite(path) {
  // Drop cached reads of the same area (and Home, which summarises everything).
  const area = path.split('?')[0].split('/').slice(0, 3).join('/');
  invalidate(area);
  invalidate('/api/auth/me');
  invalidate('/api/quests');
}

export const get = (path, query, opts = {}) => request(path, { ...opts, query });
export const post = (path, body, opts = {}) => request(path, { ...opts, method: 'POST', body: body ?? {} });
export const put = (path, body, opts = {}) => request(path, { ...opts, method: 'PUT', body: body ?? {} });
export const patch = (path, body, opts = {}) => request(path, { ...opts, method: 'PATCH', body: body ?? {} });
export const del = (path, body, opts = {}) => request(path, { ...opts, method: 'DELETE', body });

/** Cached-then-fresh read: calls onData with the cached value (if any) and again with the fresh one. */
export async function swr(path, onData, query) {
  const key = query ? `${path}?${new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== ''))}` : path;
  const hit = cache.get(key);
  if (hit) onData(hit.data, true);
  if (hit && Date.now() - hit.at < CACHE_MS / 6) return hit.data;
  const fresh = await get(path, query);
  onData(fresh, false);
  return fresh;
}

/**
 * Server-sent events over POST (Medi answers). onEvent(type, data) per event.
 * Returns the final accumulated object when the stream ends.
 */
export async function stream(path, body, onEvent, opts = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: headers({ Accept: 'text/event-stream' }),
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch { /* not json */ }
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(data.error || t('პასუხი ვერ მივიღე. სცადე ხელახლა.', 'No answer came back. Please try again.'), res.status, data);
  }
  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('event-stream')) {
    const data = await res.json();
    onEvent('done', data);
    return data;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let type = 'message';
      const dataLines = [];
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) type = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (!dataLines.length) continue;
      const raw = dataLines.join('\n');
      let data = raw;
      try { data = JSON.parse(raw); } catch { /* plain text */ }
      onEvent(type, data);
    }
  }
  return null;
}

/** Private uploads need the Bearer header, so images go through a blob URL. */
const blobCache = new Map();
export async function authedBlobUrl(url) {
  if (!url) return null;
  if (/^(data:|blob:)/.test(url)) return url;
  if (blobCache.has(url)) return blobCache.get(url);
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return null;
  const obj = URL.createObjectURL(await res.blob());
  blobCache.set(url, obj);
  return obj;
}

export function clearSessionCaches() {
  cache.clear();
  for (const u of blobCache.values()) URL.revokeObjectURL(u);
  blobCache.clear();
}
