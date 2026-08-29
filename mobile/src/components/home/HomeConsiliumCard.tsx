import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeConsiliumArt } from '@/components/home/HomeConsiliumArt';
import { QuotaSheet } from '@/components/QuotaSheet';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { ka } from '@/i18n/ka';
import { usePlanUsage } from '@/lib/planUsage';

type Props = {
  onPress: () => void;
};

/** Figma 11416:93609 — consilium promo card. Title lives in the card, like Explore Doctors. */
export function HomeConsiliumCard({ onPress }: Props) {
  const FIGMA = useFigmaChat();
  const router = useRouter();
  const plan = usePlanUsage();
  const [quotaOpen, setQuotaOpen] = useState(false);

  const handlePress = () => {
    if (plan.exhausted) {
      setQuotaOpen(true);
      return;
    }
    onPress();
  };

  return (
    <View style={{ marginTop: S.sectionTop }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ka.modules.consilium.title}
        onPress={handlePress}
        className="active:opacity-88"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: FIGMA.cardBg,
            borderWidth: 1,
            borderColor: FIGMA.border,
            borderRadius: 24,
            overflow: 'hidden',
            ...FIGMA.shadowXs,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, padding: 16, gap: 8 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: FIGMA.textPrimary,
              }}
            >
              {ka.modules.consilium.title}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 14,
                lineHeight: 20,
                color: FIGMA.textSecondary,
              }}
            >
              {ka.modules.consilium.subtitle}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                lineHeight: 20,
                color: FIGMA.brand,
              }}
            >
              {ka.home.consiliumCta}
            </Text>
          </View>
          <HomeConsiliumArt />
        </View>
      </Pressable>
      <QuotaSheet
        visible={quotaOpen}
        resetsInMs={plan.usage?.resetsInMs}
        onClose={() => setQuotaOpen(false)}
        onUpgrade={() => {
          setQuotaOpen(false);
          router.push('/package');
        }}
      />
    </View>
  );
}
