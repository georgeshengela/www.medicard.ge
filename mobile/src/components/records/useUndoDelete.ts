import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** How long a deleted row can still be brought back before the delete really happens. */
export const UNDO_MS = 5000;

type Held<T> = { item: T; timer: ReturnType<typeof setTimeout> };

/**
 * Delete with „დაბრუნება“: the row disappears at once, the real delete (`commit`) runs after five
 * seconds — or at once when another row is deleted, the screen loses focus or unmounts. Undo just
 * drops the held item. Nothing is lost if the app dies in between: the delete simply never ran.
 */
export function useUndoDelete<T>(commit: (item: T) => void) {
  const [held, setHeld] = useState<T | null>(null);
  const ref = useRef<Held<T> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const flush = useCallback(() => {
    const current = ref.current;
    ref.current = null;
    setHeld(null);
    if (current) {
      clearTimeout(current.timer);
      commitRef.current(current.item);
    }
  }, []);

  const remove = useCallback((item: T) => {
    flush(); // one undo at a time: an earlier delete goes through now
    const entry: Held<T> = {
      item,
      timer: setTimeout(() => {
        if (ref.current === entry) flush();
      }, UNDO_MS),
    };
    ref.current = entry;
    setHeld(item);
  }, [flush]);

  const undo = useCallback(() => {
    if (ref.current) clearTimeout(ref.current.timer);
    ref.current = null;
    setHeld(null);
  }, []);

  // Leaving the screen sends a waiting delete at once.
  useFocusEffect(useCallback(() => flush, [flush]));
  useEffect(() => flush, [flush]);

  return { held, remove, undo };
}
