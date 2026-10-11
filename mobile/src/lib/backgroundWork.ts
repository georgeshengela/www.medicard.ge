/**
 * Work a notification button starts without awaiting it (a dose's event into the outbox and its send).
 * A button answered while the app is not on screen runs in a runtime that may end right after the
 * handler returns — Android's headless task is torn down, iOS suspends a background launch — so the
 * runner waits for this work before it reports the tap done.
 */
const running = new Set<Promise<void>>();

export function keepBackgroundWork(work: Promise<unknown>): void {
  const settled = work.then(
    () => undefined,
    () => undefined,
  );
  running.add(settled);
  void settled.then(() => running.delete(settled));
}

/** Resolves once the kept work (and work it kept in turn) is done, or after `timeoutMs`. Never rejects. */
export async function settleBackgroundWork(timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (running.size) {
    const left = deadline - Date.now();
    if (left <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all([...running]),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, left);
      }),
    ]);
    if (timer) clearTimeout(timer);
  }
}
