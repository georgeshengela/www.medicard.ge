/**
 * Upload pace for a MEDIRUN session backlog (2026-10-06).
 *
 * A long walk without network (or in the background) leaves dozens of 60-fix batches in the queue. Sending
 * them back to back tripped the request breaker (same route > 30× in 10 s → refused for 30 s, Director
 * notice „მარყუჟი“) and showed „connection lost“ while nothing was wrong. The queue now goes out at most
 * `limit` requests per `windowMs` — under the breaker (30 / 10 s) and the server limiter (180 / min).
 */
export const UPLOAD_PACE = { limit: 20, windowMs: 10_000 } as const;

/** Milliseconds to wait before the next upload, given the send times of recent uploads (oldest first). */
export function uploadWaitMs(sentAt: readonly number[], now: number, pace = UPLOAD_PACE): number {
  const recent = sentAt.filter((t) => t > now - pace.windowMs);
  if (recent.length < pace.limit) return 0;
  return Math.max(0, recent[recent.length - pace.limit] + pace.windowMs - now);
}

/** Keeps only the send times that still count for the window. */
export function pruneSent(sentAt: readonly number[], now: number, pace = UPLOAD_PACE): number[] {
  return sentAt.filter((t) => t > now - pace.windowMs);
}
