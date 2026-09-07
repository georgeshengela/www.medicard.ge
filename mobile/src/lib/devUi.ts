/**
 * Flip to `true` when you need QA launchers / run simulation again.
 * Keep `false` for a clean product UI in Expo Go / development builds.
 */
export const SHOW_DEV_UI = false;

export function showDevUi(): boolean {
  return SHOW_DEV_UI && typeof __DEV__ !== 'undefined' && __DEV__;
}
