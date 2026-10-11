import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import { velvetLift, type VelvetPalette } from '@/theme/velvet';

type Props = {
  title: string;
  subtitle?: string;
  /** Velvet screens: the back chevron rests on a small raised disc. */
  palette?: VelvetPalette;
  /** Replaces `router.back()` (multi-step screens go back a step first). */
  onBack?: () => void;
  /** Rendered beside the back button (step progress). */
  aside?: React.ReactNode;
};

/** Forgot-password stack header with back chevron. */
export function AuthBackHeader({ title, subtitle, palette: p, onBack, aside }: Props) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: p ? 20 : 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('უკან', 'Back')}
          onPress={onBack ?? (() => router.back())}
          hitSlop={12}
          style={
            p
              ? { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, boxShadow: velvetLift(p) }
              : { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: -4 }
          }
        >
          <ChevronLeft size={p ? 22 : 24} color={p ? p.ink : colors.text100} strokeWidth={2.2} />
        </Pressable>
        {aside ? <View style={{ flex: 1 }}>{aside}</View> : null}
      </View>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 24,
          lineHeight: 32,
          color: p ? p.text : colors.text100,
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
            color: p ? p.ink2 : colors.text200,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
