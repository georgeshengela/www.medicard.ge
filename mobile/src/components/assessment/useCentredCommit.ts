import { useCallback, useEffect, useRef } from 'react';

/** How often a moving wheel or ruler hands the value under its line to the page. */
const COMMIT_EVERY_MS = 60;

function valueAt<T>(list: readonly T[], index: number): T | undefined {
  return list.length ? list[Math.max(0, Math.min(list.length - 1, index))] : undefined;
}

/**
 * Commits the value under the selection line while a wheel or ruler is still moving (at most every
 * 60 ms, the last index always), so „გაგრძელება“ pressed mid-fling saves what is shown and the big
 * number above follows the line — not only at momentum end. `flush` commits at once (the settle).
 */
export function useCentredCommit<T>(values: readonly T[], selected: T, onSelect: (value: T) => void) {
  const latest = useRef({ values, selected, onSelect });
  latest.current = { values, selected, onSelect };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(0);
  const lastAt = useRef(0);

  const flush = useCallback((index: number) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    lastAt.current = Date.now();
    const value = valueAt(latest.current.values, index);
    if (value !== undefined && value !== latest.current.selected) latest.current.onSelect(value);
  }, []);

  const commitMoving = useCallback(
    (index: number) => {
      pending.current = index;
      if (timer.current || valueAt(latest.current.values, index) === latest.current.selected) return;
      const wait = COMMIT_EVERY_MS - (Date.now() - lastAt.current);
      if (wait <= 0) {
        flush(index);
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        flush(pending.current);
      }, wait);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { commitMoving, flush };
}
