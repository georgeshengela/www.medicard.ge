import { Dimensions, Platform, type KeyboardEvent } from 'react-native';

/** Extra room on Android so rounding/IME suggestion strips never clip the button. */
const ANDROID_SAFETY = 6;

/**
 * Keyboard top edge in window coordinates, or null when hidden.
 *
 * Android is unreliable in three different ways, depending on the phone:
 *  - React Native reports `height = ime - systemBars` (the navigation bar is subtracted —
 *    ReactRootView.checkForKeyboardEvents);
 *  - `screenY` comes from the visible display frame, which some edge-to-edge builds don't shrink;
 *  - with 3-button navigation the window may stop above the navigation bar, and then the safe-area
 *    bottom inset is 0 although RN still subtracted the bar.
 * So we compute three candidates and take the HIGHEST keyboard top (smallest y): each is exact in the
 * case it is built for and too low otherwise — never too high — so the button can't end up under it.
 * (Owner reports 2026-09-28: the button stayed partly hidden with a single formula.)
 */
export function keyboardTopFromEvent(event: KeyboardEvent, bottomInset: number): number | null {
  const { screenY, height } = event.endCoordinates;
  if (!(height > 0)) return null;
  if (Platform.OS !== 'android') return screenY > 0 ? screenY : Dimensions.get('window').height - height;
  const screenH = Dimensions.get('screen').height;
  const windowH = Dimensions.get('window').height;
  const candidates = [
    screenH - height - Math.max(0, bottomInset), // window drawn under the nav bar (edge-to-edge)
    windowH - height, // window ends above the nav bar (inset 0, bar already outside the window)
    screenH - height - Math.max(0, screenH - windowH), // nav bar = screen/window difference
  ];
  if (screenY > 0 && screenY < screenH) candidates.push(screenY);
  return Math.min(...candidates) - ANDROID_SAFETY;
}

/** How much of a bottom-anchored full-height page the keyboard covers. */
export function keyboardOverlapFromEvent(event: KeyboardEvent, bottomInset: number): number {
  const top = keyboardTopFromEvent(event, bottomInset);
  if (top === null) return 0;
  return Math.max(0, Math.round(Dimensions.get('window').height - top));
}
