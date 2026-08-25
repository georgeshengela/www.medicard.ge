import * as Haptics from 'expo-haptics';

/** iOS picker-style tick — light selection haptic. */
export function pickerSelectionTick() {
  Haptics.selectionAsync().catch(() => undefined);
}

/** Softer tick while dragging across wheel steps. */
export function pickerScrollTick() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
