import { useSyncExternalStore } from 'react';
import * as SplashScreen from 'expo-splash-screen';

/**
 * Who plays the move from the native launch screen into the app (owner 2026-10-17, train 1.0.0.26).
 *
 * - `waiting`: the native splash is still up (the curtain under it shows the same picture).
 * - `playing`: the splash is gone; `LaunchCurtain` beats the heartbeat once and opens into the app.
 * - `claimed`: the welcome intro took over (it starts from the same frame and plays its own movement).
 */
export type LaunchHandoff = 'waiting' | 'playing' | 'claimed';

let state: LaunchHandoff = 'waiting';
let hidden = false;
let requested = false;
let artReady = false;
let artWait: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

/** Longest wait for the curtain's picture before the native splash fades anyway. */
const ART_WAIT_MS = 400;

function set(next: LaunchHandoff) {
  if (state === next) return;
  state = next;
  listeners.forEach((l) => l());
}

SplashScreen.preventAutoHideAsync().catch(() => undefined);
// The native splash fades over the curtain's identical first frame, so any sub-pixel difference never shows.
try {
  SplashScreen.setOptions({ fade: true, duration: 220 });
} catch {
  /* older binaries without setOptions hide at once — the frames still match */
}

function reallyHide() {
  if (hidden) return;
  hidden = true;
  if (artWait) clearTimeout(artWait);
  SplashScreen.hideAsync().catch(() => undefined);
  if (state === 'waiting') set('playing');
}

/**
 * Hides the native launch screen (once) and starts the curtain, unless the welcome intro claimed it. The
 * splash waits until the curtain's copy of its picture has loaded (at most ART_WAIT_MS), so it fades onto
 * the same frame; `now` skips the wait (render errors, where the curtain may never mount).
 */
export function hideLaunchScreen({ now = false }: { now?: boolean } = {}): void {
  if (hidden) return;
  if (now || artReady || state === 'claimed') {
    reallyHide();
    return;
  }
  if (requested) return;
  requested = true;
  artWait = setTimeout(reallyHide, ART_WAIT_MS);
}

/** The curtain's first frame (the splash PNG) is on screen. */
export function markLaunchArtReady(): void {
  artReady = true;
  if (requested) reallyHide();
}

/** The welcome intro plays the launch itself from the splash's frame: the curtain steps aside, the splash goes now. */
export function claimLaunchHandoff(): void {
  set('claimed');
  if (requested) reallyHide();
}

export function useLaunchHandoff(): LaunchHandoff {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
