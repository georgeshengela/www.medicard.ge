/**
 * The person's side of a streamed AI reply (SSE).
 *
 * express.json() has already read the request body, so the request's own 'close' event fires before a
 * handler awaits anything (session lookup, patient context) — a listener added later never hears a
 * disconnect. The response's 'close' does fire when the connection goes away mid-stream, and a
 * connection that dropped during those awaits is already `destroyed` (its 'close' will not fire again).
 *
 * Rule (Medi chat, 2026-10-08): when the person stops, leaves or loses the connection before the answer
 * is delivered, the AI call is aborted and nothing is stored or charged — the unseen answer never shows
 * up later as a separate consultation.
 */
export function watchStreamClient(res) {
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  if (res.destroyed) controller.abort();
  else res.on('close', onClose);
  return {
    signal: controller.signal,
    /** The person is no longer there to receive the answer. */
    gone: () => controller.signal.aborted || res.destroyed === true,
    dispose: () => {
      res.removeListener('close', onClose);
    },
  };
}
