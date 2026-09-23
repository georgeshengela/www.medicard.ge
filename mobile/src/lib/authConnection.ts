/** Login, session GET, and other idempotent calls can recover from one dropped socket.
 * Never replay registration, password resets, OTPs, 401/403 or rate limits.
 * Both attempts share the caller's deadline, including the short reconnect pause.
 */
export function isTransientConnectionError(error: unknown): boolean {
  const failure = error as { name?: string; status?: number; message?: string };
  if (failure?.name === 'AbortError') return false;
  if ([502, 503, 504].includes(failure?.status ?? 0)) return true;
  if (failure?.name === 'TypeError') return true;
  const message = String(failure?.message ?? '').toLowerCase();
  return /connection reset|econnreset|econnrefused|econnaborted|socketexception|broken pipe|failed to connect|network request failed|software caused connection abort|connection abort|connection closed/.test(message);
}

export async function withAuthConnectionRetry<T>(
  work: () => Promise<T>,
  signal: AbortSignal,
  pause: (signal: AbortSignal) => Promise<void> = reconnectPause,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (signal.aborted || !isTransientConnectionError(error)) throw error;
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
