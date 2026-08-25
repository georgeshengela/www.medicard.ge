import React from 'react';
import { Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import type { PasswordStrengthLevel } from '@/lib/passwordStrength';

const COLORS: Record<Exclude<PasswordStrengthLevel, 'empty'>, string> = {
  weak: '#D97706',
  fair: '#0D9488',
  strong: '#059669',
};

type Props = {
  level: PasswordStrengthLevel;
};

/** Figma sign-up password strength hint (weak / amazing). */
export function PasswordStrengthHint({ level }: Props) {
  if (level === 'empty') return null;

  const color = level === 'weak' ? COLORS.weak : level === 'fair' ? COLORS.fair : COLORS.strong;
  const label =
    level === 'weak'
      ? ka.auth.passwordStrengthWeak
      : level === 'fair'
        ? ka.auth.passwordStrengthFair
        : ka.auth.passwordStrengthStrong;

  return (
    <View style={{ marginTop: 6 }}>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 13,
          lineHeight: 18,
          color,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
