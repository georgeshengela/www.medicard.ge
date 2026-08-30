import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

type Props = {
  title: string;
  subtitle?: string;
};

/** Forgot-password stack header with back chevron. */
export function AuthBackHeader({ title, subtitle }: Props) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View style={{ marginBottom: 24 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        hitSlop={12}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          marginLeft: -4,
        }}
      >
        <ChevronLeft size={24} color={colors.text100} strokeWidth={2.2} />
      </Pressable>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 24,
          lineHeight: 32,
          color: colors.text100,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: 8,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 15,
            lineHeight: 22,
            color: colors.text200,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
