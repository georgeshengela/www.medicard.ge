export const ANALYSIS_CONTEXT_LIMIT = 1700; // Reserve space for the imaging region in the API's 2000 limit.
export const CHAT_MESSAGE_LIMIT = 4000;
export const SKINCARE_PRODUCTS_LIMIT = 1000;

export function createRequestGate() {
  let active: symbol | null = null;
  return {
    begin() { if (active) return null; active = Symbol(); return active; },
    isCurrent(ticket: symbol | null) { return ticket !== null && active === ticket; },
    finish(ticket: symbol | null) { if (active === ticket) active = null; },
    reset() { active = null; },
  };
}

export class IncompleteAnalysisError extends Error {}

export function requireAnalysisText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new IncompleteAnalysisError('პასუხი სრულად ვერ მივიღეთ. გთხოვ, სცადე ხელახლა.');
  return value.trim();
}

/** Positions are window coordinates, including any native-stack header. */
export function keyboardFrameOverlap(top: number, height: number, keyboardTop: number | null) {
  if (keyboardTop === null || height <= 0) return 0;
  return Math.min(height, Math.max(0, top + height - keyboardTop));
}

export function focusedFieldOffset(offset: number, top: number, height: number, inputTop: number, inputHeight: number) {
  if (height <= 0) return offset;
  const upper = top + 24;
  const lower = top + height - 12;
  if (inputHeight > lower - upper || inputTop < upper) return Math.max(0, offset + inputTop - upper);
  return inputTop + inputHeight > lower ? Math.max(0, offset + inputTop + inputHeight - lower) : offset;
}
