import { useCallback, useEffect, useState } from 'react';
import { onReturnToForeground } from '@/lib/appForeground';

/**
 * Seconds until an SMS code may be sent again, read from a stored deadline. A ticking counter froze
 * while the app sat in the background (JS timers pause there) — a person who went to Messages for the
 * code came back to the same number. Returns `[secondsLeft, start(seconds)]`.
 */
export function useResendCountdown(): [number, (seconds: number) => void] {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const start = useCallback((seconds: number) => {
    const at = Date.now();
    setNow(at);
    setDeadline(at + Math.max(0, seconds) * 1000);
  }, []);

  useEffect(() => {
    if (deadline <= now) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), (deadline - now) % 1000 || 1000);
    return () => clearTimeout(timer);
  }, [deadline, now]);

  // Back from Messages: read the clock at once instead of waiting for the paused timer.
  useEffect(() => {
    if (!deadline) return undefined;
    return onReturnToForeground(() => setNow(Date.now()));
  }, [deadline]);

  return [Math.max(0, Math.ceil((deadline - now) / 1000)), start];
}
