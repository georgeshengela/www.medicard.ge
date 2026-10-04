import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Undo2 } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useThemeColors } from '@/theme/colors';

/** „წაიშალა · დაბრუნება“ — the delete is held back while this is on screen, so one tap brings it back. */
export function UndoToast({ title, bottom, onUndo }: { title: string; bottom: number; onUndo: () => void }) {
  const c = useThemeColors();
  const reduceMotion = usePrefersReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(220)}
      exiting={reduceMotion ? undefined : FadeOutDown.duration(180)}
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 16, right: 16, bottom }}
    >
      <View
        style={{
          minHeight: 52,
          borderRadius: 18,
          backgroundColor: c.text100,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 6,
          gap: 10,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: c.bg100, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 }}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('დაბრუნება', 'Undo')}
          onPress={onUndo}
          hitSlop={6}
          style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Undo2 size={16} color={c.bg100} strokeWidth={2.3} />
          <Text style={{ color: c.bg100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20 }}>{tx('დაბრუნება', 'Undo')}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
