import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

/** Read an RN Animated.Value as React state — safe for SVG props on Expo 57. */
export function useAnimatedProgress(value: Animated.Value, initial = 0) {
  const [progress, setProgress] = useState(initial);
  useEffect(() => {
    const id = value.addListener(({ value: next }) => setProgress(next));
    return () => value.removeListener(id);
  }, [value]);
  return progress;
}
