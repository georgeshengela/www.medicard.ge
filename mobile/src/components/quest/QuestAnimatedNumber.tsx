import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { formatQuestNumber } from '@/lib/quest/logic.js';

export function QuestAnimatedNumber({
  value,
  locale = 'ka',
  duration = 700,
  ...rest
}: TextProps & { value: number; locale?: string; duration?: number }) {
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduce || fromRef.current === value) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const start = fromRef.current;
    const delta = value - start;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(Math.round(start + delta * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduce]);

  return <Text {...rest}>{formatQuestNumber(shown, locale)}</Text>;
}
