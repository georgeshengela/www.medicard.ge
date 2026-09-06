import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Target, TrendingUp } from 'lucide-react-native';
import { Bone } from '@/components/ui/Skeleton';
import { QuestAnimatedNumber } from '@/components/quest/QuestAnimatedNumber';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { questApi } from '@/lib/quest/api';
import { formatQuestNumber, walletActivityLabel } from '@/lib/quest/logic.js';
import { q } from '@/lib/quest/copy';
import { buildQuestDevWallet, getQuestDevScenario, isQuestDevEnabled } from '@/lib/quest/devFixture';
import { QUEST } from '@/theme/questTokens';

type WalletData = Awaited<ReturnType<typeof questApi.rewards>>;

export default function QuestWalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const copy = q('ka');
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
      setData(buildQuestDevWallet() as unknown as WalletData);
      setLoading(false);
      return;
    }
    void questApi
      .rewards()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const sourceLabel = (sourceType: string) => walletActivityLabel(sourceType, copy.mission);
  const coinInk = dark ? QUEST.pill.coinInkDark : QUEST.pill.coinInkLight;
  const coinBg = dark ? QUEST.pill.coinDark : QUEST.pill.coinLight;

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          hitSlop={8}
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.text100 }}>
          {copy.coinsName}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance hero */}
        <Animated.View
          entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base)}
          style={{
            backgroundColor: dark ? colors.surface : '#FFFFFF',
            borderWidth: 1,
            borderColor: colors.bg300,
            borderRadius: QUEST.radius,
            padding: 20,
            overflow: 'hidden',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: -50,
              top: -60,
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: coinBg,
              opacity: dark ? 0.8 : 0.7,
            }}
          />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase', color: colors.text300 }}>
            {copy.balanceLabel}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: coinBg,
              }}
            >
              <QuestCoinMark size={26} color={coinInk} />
            </View>
            {loading && !data ? (
              <Bone width={140} height={40} radius={10} />
            ) : (
              <QuestAnimatedNumber
                value={data?.balance.coins || 0}
                locale="ka"
                duration={900}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  flex: 1,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 40,
                  lineHeight: 48,
                  letterSpacing: -1,
                  color: colors.text100,
                }}
              />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
              }}
            >
              <TrendingUp size={13} color={colors.primary100} strokeWidth={2.4} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, lineHeight: 16, color: colors.primary100 }}>
                {copy.earned}: {formatQuestNumber(data?.totalEarned.coins || 0, 'ka')}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Activity */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.text100, paddingHorizontal: 2 }}>
            {copy.recent}
          </Text>

          {loading && !data ? (
            [0, 1, 2].map((i) => <Bone key={i} height={64} radius={QUEST.rowRadius} />)
          ) : !data?.transactions.length ? (
            <View
              style={{
                backgroundColor: dark ? colors.surface : '#FFFFFF',
                borderWidth: 1,
                borderColor: colors.bg300,
                borderRadius: QUEST.radius,
                padding: QUEST.pad,
              }}
            >
              <QuestMediLine text={copy.walletEmpty} />
            </View>
          ) : (
            data.transactions.map((row, index) => {
              const positive = row.amount > 0;
              return (
                <Animated.View
                  key={row.id}
                  entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(80 + Math.min(index, 8) * 45)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: QUEST.rowRadius,
                    backgroundColor: dark ? colors.surface : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: colors.bg300,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
                    }}
                  >
                    <Target size={18} color={dark ? colors.primary100 : QUEST.accent.movement} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, color: colors.text100 }}>
                      {sourceLabel(row.sourceType)}
                    </Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: colors.text300, marginTop: 2 }}>
                      {new Date(row.createdAt).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: positive ? coinBg : colors.bg200,
                    }}
                  >
                    <QuestCoinMark size={12} color={positive ? coinInk : colors.text300} />
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: positive ? coinInk : colors.text200 }}>
                      {positive ? '+' : ''}
                      {formatQuestNumber(row.amount, 'ka')}
                    </Text>
                  </View>
                </Animated.View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
