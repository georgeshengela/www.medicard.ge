import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, type PressableProps, type View } from 'react-native';
import { useCycleColors } from '@/theme/cycle';

/** Static style arrays are intentional: NativeWind drops Pressable style callbacks. */
export const CyclePressable = forwardRef<View, PressableProps>(function CyclePressable(
  { style, onFocus, onBlur, onPressIn, onPressOut, onHoverIn, onHoverOut, disabled, accessibilityState, ...props }, ref,
) {
  const c = useCycleColors();
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const actionRole = props.accessibilityRole ?? (props.onPress ? 'button' : undefined);
  // RN Web uses explicit ARIA state props; native keeps accessibilityState.
  const webState = Platform.OS === 'web' ? {
    'aria-checked': props['aria-checked'] ?? accessibilityState?.checked,
    'aria-selected': actionRole === 'button' ? undefined : props['aria-selected'] ?? accessibilityState?.selected,
    'aria-pressed': actionRole === 'button' ? accessibilityState?.selected : undefined,
    'aria-expanded': props['aria-expanded'] ?? accessibilityState?.expanded,
    'aria-busy': props['aria-busy'] ?? accessibilityState?.busy,
    'aria-disabled': props['aria-disabled'] ?? disabled ?? accessibilityState?.disabled,
  } : {};
  return <Pressable {...props} {...webState} ref={ref} disabled={disabled} accessibilityRole={actionRole} accessibilityState={accessibilityState}
    onFocus={e => {
      const target = e.target as unknown as { matches?: (selector: string) => boolean };
      setFocused(Platform.OS !== 'web' || !target.matches || target.matches(':focus-visible'));
      onFocus?.(e);
    }}
    onBlur={e => { setFocused(false); setPressed(false); onBlur?.(e); }}
    onPressIn={e => { setPressed(true); onPressIn?.(e); }}
    onPressOut={e => { setPressed(false); onPressOut?.(e); }}
    onHoverIn={e => { setHovered(true); onHoverIn?.(e); }}
    onHoverOut={e => { setHovered(false); onHoverOut?.(e); }}
    style={[
      typeof style === 'function' ? style({ pressed }) : style,
      !disabled && (pressed || hovered) ? { opacity: pressed ? 0.94 : 0.98 } : null,
      Platform.OS === 'web' && focused ? { outlineColor: c.focus, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 3 } : null,
    ]}
  />;
});
