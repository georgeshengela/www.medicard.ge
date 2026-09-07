import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffline } from '@/hooks/useOffline';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/** Floating chip — same language as the Quest XP toast. Does not push layout. */
export function OfflineBanner() {
  const offline = useOffline();
  const colors = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const reduce = usePrefersReducedMotion();

  if (!offline) return null;

  return (
    <Animated.View
      pointerEvents="none"
      entering={reduce ? undefined : FadeInUp.duration(QUEST.motion.base).springify().damping(16)}
      exiting={reduce ? undefined : FadeOutUp.duration(QUEST.motion.fast)}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: insets.top + 10,
        zIndex: 60,
        alignItems: 'center',
      }}
    >
      <View
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 10,
          paddingRight: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: dark ? '#0D9488' : colors.primary200,
          shadowColor: '#000',
          shadowOpacity: dark ? 0.35 : 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <WifiOff size={14} color="#FFFFFF" strokeWidth={2.4} />
        </View>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: '#FFFFFF' }}>
          {ka.common.offlineMode}
        </Text>
      </View>
    </Animated.View>
  );
}
