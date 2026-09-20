/** All positions are window coordinates, including native-stack headers. */
export function petKeyboardOverlap(top: number, height: number, keyboardTop: number | null) {
  if (keyboardTop === null || height <= 0) return 0;
  return Math.min(height, Math.max(0, top + height - keyboardTop));
}

/** Keep the input and its label inside the scroll area above the fixed actions. */
export function petFocusScrollOffset(offset: number, viewportTop: number, viewportHeight: number, fieldTop: number, fieldHeight: number) {
  if (viewportHeight <= 0) return offset;
  const top = viewportTop + 36;
  const bottom = viewportTop + viewportHeight - 16;
  if (fieldHeight > bottom - top || fieldTop < top) return Math.max(0, offset + fieldTop - top);
  if (fieldTop + fieldHeight > bottom) return Math.max(0, offset + fieldTop + fieldHeight - bottom);
  return offset;
}
