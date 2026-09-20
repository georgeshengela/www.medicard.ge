/** Login and session verification can safely recover from one interrupted connection.
 * Never replay registration, password resets, OTPs, 401/403 or rate limits.
 * Both attempts share the caller's deadline, including the short reconnect pause.
 */
export async function withAuthConnectionRetry<T>(
  work: () => Promise<T>,
  signal: AbortSignal,
  pause: (signal: AbortSignal) => Promise<void> = reconnectPause,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const failure = error as { name?: string; status?: number };
    const transient = failure?.name === 'TypeError' || [502, 503, 504].includes(failure?.status ?? 0);
    if (signal.aborted || !transient) throw error;
    await pause(signal);
    if (signal.aborted) throw abortError();
    return work();
  }
}

function reconnectPause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const abort = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 450);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function abortError(): Error {
  // React Native's AbortController shim does not require reason/throwIfAborted.
  return Object.assign(new Error('Request aborted'), { name: 'AbortError' });
}
