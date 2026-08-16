import React from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

type Props = ViewProps & {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  /** Kept for call-site compatibility — cards are always flat. */
  elevated?: boolean;
  className?: string;
};

/** Explicit zero-elevation so Android / web cannot reintroduce a soft shadow. */
const FLAT = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

/**
 * Solid surface card. Depth is a hairline border against the page canvas —
 * no soft shadow, in either theme.
 */
export function Card({ children, onPress, padded = true, className = '', ...rest }: Props) {
  const classes = ['rounded-2xl border border-bg-300 bg-surface', padded ? 'p-4' : '', className].join(' ');

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={FLAT}
        className={`${classes} active:opacity-80`}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={FLAT} className={classes} {...rest}>
      {children}
    </View>
  );
}
