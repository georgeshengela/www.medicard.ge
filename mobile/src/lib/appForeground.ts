import { AppState, type AppStateStatus } from 'react-native';
import { isReturnFromBackground } from './appForegroundCore';

/**
 * Calls `fn` only when the app comes back from the background — not on iOS inactive → active
 * (Face ID, permission sheets, Control Center, pulling down notifications), which used to fire
 * every refresh handler without the person ever leaving the app. Returns the unsubscribe function.
 */
export function onReturnToForeground(fn: () => void): () => void {
  let previous: AppStateStatus = AppState.currentState;
  const sub = AppState.addEventListener('change', (next) => {
    const back = isReturnFromBackground(previous, next);
    previous = next;
    if (back) fn();
  });
  return () => sub.remove();
}
