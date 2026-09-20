import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function usePrefersReducedMotion() {
  // Avoid a full-screen slide before the asynchronous OS preference arrives.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      if (alive) setReduced(value);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive && !changed) setReduced(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
