import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';
import { companionCopy } from '@/lib/companion/copy';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

export type JourneyUnlockCelebration = {
  count: number;
  keys: string[];
};

type Props = {
  celebration: JourneyUnlockCelebration | null;
  onDismiss: () => void;
  locale?: string;
};

/** Aggregated Journey unlock toast — never stacks sequential modals. */
export function MediJourneyUnlockToast({ celebration, onDismiss, locale = 'ka' }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const copy = companionCopy(locale);

  if (!celebration || celebration.count < 1) return null;

  const title =
    celebration.count === 1
      ? copy.unlockOne
      : celebration.count <= 3
        ? copy.unlockFew(celebration.count)
        : copy.unlockMany(celebration.count);

  return (
    <Animated.View
      entering={reduce ? undefined : FadeInUp.duration(QUEST.motion.base).springify().damping(16)}
      exiting={reduce ? undefined : FadeOutUp.duration(QUEST.motion.fast)}
      style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 10, zIndex: 55, alignItems: 'center' }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${copy.viewJourney}`}
        onPress={() => {
          onDismiss();
          router.push('/medi-companion/journey' as never);
        }}
        className="active:opacity-90"
        style={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: dark ? colors.primary200 : QUEST.accent.medi,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
          }}
        >
          <MapPin size={18} color={dark ? colors.primary100 : QUEST.accent.medi} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>
            {title}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.primary200 }}>
            {copy.viewJourney}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
