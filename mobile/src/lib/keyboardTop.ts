import { Dimensions, Platform, type KeyboardEvent } from 'react-native';

/**
 * Keyboard top edge in window coordinates, or null when hidden.
 *
 * Android: React Native reports `height = ime - systemBars` (the navigation bar is subtracted —
 * ReactRootView.checkForKeyboardEvents) and `screenY` comes from the visible display frame, which
 * edge-to-edge builds do not shrink reliably. The keyboard really starts `height + navigation bar`
 * above the screen bottom, so we compute it from the screen size and the bottom inset. Without this the
 * primary button ended up a navigation-bar height under the keyboard (owner report 2026-09-28).
 */
export function keyboardTopFromEvent(event: KeyboardEvent, bottomInset: number): number | null {
  const { screenY, height } = event.endCoordinates;
  if (!(height > 0)) return null;
  if (Platform.OS === 'android') return Dimensions.get('screen').height - height - Math.max(0, bottomInset);
  return screenY > 0 ? screenY : Dimensions.get('window').height - height;
}

/** How much of a bottom-anchored full-height page the keyboard covers (Android: incl. the nav bar). */
export function keyboardOverlapFromEvent(event: KeyboardEvent, bottomInset: number): number {
  const top = keyboardTopFromEvent(event, bottomInset);
  if (top === null) return 0;
  const bottom = Platform.OS === 'android' ? Dimensions.get('screen').height : Dimensions.get('window').height;
  return Math.max(0, Math.round(bottom - top));
}
