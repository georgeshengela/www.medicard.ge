import { AppState, type AppStateStatus } from 'react-native';

const MIN_GAP_MS = 4_000;
const HEARTBEAT_MS = 15_000;
const SCREEN_DEBOUNCE_MS = 700;

let started = false;
let appStateSub: { remove: () => void } | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let screenTimer: ReturnType<typeof setTimeout> | null = null;
let lastPingAt = 0;
let currentScreen = 'open';
let inflight = false;

function clipScreen(screen: string): string {
  const clean = String(screen || 'open')
    .replace(/^\//, '')
    .replace(/\/+/g, '/')
    .slice(0, 24);
  return clean || 'open';
}

async function pingNow(reason: 'foreground' | 'screen' | 'heartbeat'): Promise<void> {
  if (inflight) return;
  const now = Date.now();
  if (reason !== 'foreground' && now - lastPingAt < MIN_GAP_MS) return;
  inflight = true;
  lastPingAt = now;
  try {
    const { pingAppActivity } = await import('@/lib/productObservability');
    await pingAppActivity(reason === 'heartbeat' ? 'heartbeat' : currentScreen);
    if (reason === 'heartbeat' || reason === 'foreground') {
      void import('@/lib/userLocation').then(({ pingLiveLocation }) => pingLiveLocation('heartbeat'));
    }
  } catch {
    lastPingAt = 0;
  } finally {
    inflight = false;
  }
}

function onAppState(next: AppStateStatus): void {
  if (next !== 'active') return;
  void pingNow('foreground');
  void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh());
}

export function setLivePresenceScreen(screen: string): void {
  currentScreen = clipScreen(screen);
  if (!started) return;
  if (screenTimer) clearTimeout(screenTimer);
  screenTimer = setTimeout(() => {
    screenTimer = null;
    void pingNow('screen');
  }, SCREEN_DEBOUNCE_MS);
}

export function startLivePresence(): void {
  if (started) return;
  started = true;
  appStateSub = AppState.addEventListener('change', onAppState);
  heartbeat = setInterval(() => {
    if (AppState.currentState === 'active') void pingNow('heartbeat');
  }, HEARTBEAT_MS);
  void pingNow('foreground');
}

export function stopLivePresence(): void {
  started = false;
  currentScreen = 'open';
  appStateSub?.remove();
  appStateSub = null;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  if (screenTimer) clearTimeout(screenTimer);
  screenTimer = null;
  void import('@/lib/userLocation').then(({ stopLiveLocationWatch }) => stopLiveLocationWatch());
}
