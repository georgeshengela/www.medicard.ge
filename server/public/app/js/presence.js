// „ახლა აპში“ for the web app: the same heartbeat as the phone (src/lib/livePresence.ts) — the page the
// person opened, then a ping every 15 s while the tab is visible. Admin home lists who is online from it.
import { request, getToken } from './api.js';

const HEARTBEAT_MS = 15_000;
const MIN_GAP_MS = 4_000;
let timer = null;
let lastAt = 0;
let screen = 'home';

function ping(activityType) {
  if (!getToken() || document.hidden) return;
  const now = Date.now();
  if (activityType === 'heartbeat' && now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  // raw: a heartbeat must not drop the page's cached reads like a real write does.
  request('/api/check-in/session', { method: 'POST', body: { activityType }, raw: true, timeoutMs: 10_000 }).catch(() => {});
}

/** Called by the router with the page path („/cycle“, „/scan“…). */
export function setPresenceScreen(path) {
  screen = String(path || '/').replace(/^\/+|\/+$/g, '').slice(0, 24) || 'home';
  ping(screen);
}

export function startPresence() {
  if (timer) return;
  timer = setInterval(() => ping('heartbeat'), HEARTBEAT_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ping(screen);
  });
}
