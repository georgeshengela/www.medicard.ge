import React, { createContext, forwardRef, useContext, useMemo, useState } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

type ScrollLock = (locked: boolean) => void;

const ScrollLockContext = createContext<ScrollLock>(() => undefined);

/**
 * A ScrollView that a child can pause while the finger is busy with it (the /cycle dial, the Home
 * cycle wave). On iOS the native scroll keeps moving under a JS pan responder, so scrubbing a day
 * also scrolled the page (owner 2026-10-05). The lock lives here, so toggling it re-renders only this
 * wrapper — the screen's children are props and keep their elements.
 */
export const LockableScrollView = forwardRef<ScrollView, ScrollViewProps>(function LockableScrollView(props, ref) {
  const [locks, setLocks] = useState(0);
  const lock = useMemo<ScrollLock>(() => (on) => setLocks((n) => Math.max(0, n + (on ? 1 : -1))), []);
  return (
    <ScrollLockContext.Provider value={lock}>
      <ScrollView ref={ref} {...props} scrollEnabled={props.scrollEnabled !== false && locks === 0} />
    </ScrollLockContext.Provider>
  );
});

/** Pause / resume the nearest LockableScrollView; a no-op outside one. Calls must be balanced. */
export function useScrollLock(): ScrollLock {
  return useContext(ScrollLockContext);
}
