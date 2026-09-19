/** Shared vertical inset for auth screens — same above the IME as below the status bar. */
export const AUTH_SCREEN_GUTTER = 16;

/** Ignore IME jitter below this (px). */
export const AUTH_KEYBOARD_OPEN_PX = 24;

/**
 * Footer pad under the CTA.
 * Keyboard open → IME overlap + gutter (no home-indicator, it sits behind the IME).
 * Keyboard closed → safe-area bottom + gutter.
 */
export function authFooterBottomPad(keyboardHeight, insetBottom, gutter = AUTH_SCREEN_GUTTER) {
  const kb = Math.max(0, Number(keyboardHeight) || 0);
  const inset = Math.max(0, Number(insetBottom) || 0);
  if (kb > AUTH_KEYBOARD_OPEN_PX) return kb + gutter;
  return inset + gutter;
}

/** Scroll pad below the status bar — same gutter as `authFooterBottomPad` uses above the IME. */
export function authScrollTopPad(insetTop, gutter = AUTH_SCREEN_GUTTER) {
  return Math.max(0, Number(insetTop) || 0) + gutter;
}
