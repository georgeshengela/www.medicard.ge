import React from 'react';
import { Pressable, Text } from 'react-native';
import { suggestEmailFix } from '@/lib/emailTypo';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

/** „ხომ არ გულისხმობდი …@icloud.com?“ under an email field; one tap applies the fix. */
export function EmailTypoHint({ email, onApply }: { email: string; onApply: (fixed: string) => void }) {
  const colors = useThemeColors();
  const fixed = suggestEmailFix(email);
  if (!fixed) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx(`ხომ არ გულისხმობდი ${fixed}? შეცვლა`, `Did you mean ${fixed}? Change`)}
      onPress={() => onApply(fixed)}
      hitSlop={8}
      style={{ marginTop: -6, marginBottom: 10, paddingVertical: 4 }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text200 }}>
        {tx('ხომ არ გულისხმობდი', 'Did you mean')}{' '}
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', color: colors.primary200 }}>{fixed}</Text>?
      </Text>
    </Pressable>
  );
}
