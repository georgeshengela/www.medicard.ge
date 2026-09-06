import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestSectionTitle } from '@/components/quest/QuestSectionTitle';
import { useThemeColors } from '@/theme/colors';
import { questApi } from '@/lib/quest/api';
import { formatQuestNumber, walletActivityLabel } from '@/lib/quest/logic.js';
import { q } from '@/lib/quest/copy';
import { buildQuestDevWallet, getQuestDevScenario, isQuestDevEnabled } from '@/lib/quest/devFixture';

export default function QuestWalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const copy = q('ka');
  const [data, setData] = useState<Awaited<ReturnType<typeof questApi.rewards>> | null>(null);

  useEffect(() => {
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
      setData(buildQuestDevWallet());
      return;
    }
    void questApi.rewards().then(setData).catch(() => setData(null));
  }, []);

  const sourceLabel = (sourceType: string) => walletActivityLabel(sourceType, copy.mission);

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          hitSlop={12}
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] justify-center"
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text className="font-sans-bold text-lg text-text-100">{copy.coinsName}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 16 }}>
        <View>
          <Text className="font-sans text-sm text-text-300">{copy.wallet}</Text>
          <View className="mt-2 flex-row items-center" style={{ gap: 10 }}>
            <QuestCoinMark size={22} />
            <Text
              className="min-w-0 shrink font-sans-bold text-[32px] leading-10 text-text-100"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatQuestNumber(data?.balance.coins || 0, 'ka')}
            </Text>
          </View>
          <Text className="mt-2 font-sans text-sm text-text-200">
            {copy.earned}: {formatQuestNumber(data?.totalEarned.coins || 0, 'ka')}
          </Text>
        </View>

        <QuestSectionTitle title={copy.recent} />

        {!data?.transactions.length ? (
          <QuestMediLine text={copy.walletEmpty} />
        ) : (
          data.transactions.map((row) => (
            <View
              key={row.id}
              className="flex-row items-center justify-between rounded-2xl bg-surface px-4 py-3"
              style={{ borderWidth: 1, borderColor: colors.bg300 }}
            >
              <View className="min-w-0 flex-1 pr-3">
                <Text className="font-sans-semibold text-[15px] text-text-100">{sourceLabel(row.sourceType)}</Text>
                <Text className="mt-0.5 font-sans text-xs text-text-300">
                  {new Date(row.createdAt).toLocaleDateString('ka-GE')}
                </Text>
              </View>
              <Text className="font-sans-semibold text-[15px] text-text-100">
                {row.amount > 0 ? '+' : ''}
                {formatQuestNumber(row.amount, 'ka')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
