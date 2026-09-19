import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

export type KeyboardMetrics = {
  height: number;
  durationMs: number;
};

function overlapOf(event: KeyboardEvent) {
  const winH = Dimensions.get('window').height;
  const top = event.endCoordinates.screenY;
  const overlap = Number.isFinite(top) ? winH - top : event.endCoordinates.height;
  return Math.max(0, Math.round(overlap || event.endCoordinates.height || 0));
}

function durationOf(event: KeyboardEvent) {
  const d = event.duration;
  if (typeof d === 'number' && d > 0) return d;
  return Platform.OS === 'ios' ? 280 : 120;
}

/** IME overlay height + keyboard animation length. Android API 35 often ignores adjustResize. */
export function useKeyboardMetrics(): KeyboardMetrics {
  const [metrics, setMetrics] = useState<KeyboardMetrics>({ height: 0, durationMs: 280 });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      setMetrics({ height: overlapOf(event), durationMs: durationOf(event) });
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      setMetrics({ height: 0, durationMs: durationOf(event) });
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return metrics;
}

/** IME overlay height. Android API 35 edge-to-edge often ignores adjustResize. */
export function useKeyboardHeight() {
  return useKeyboardMetrics().height;
}
