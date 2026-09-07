import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { Bone } from '@/components/ui/Skeleton';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { rewardsApi, type RedemptionItem } from '@/lib/quest/rewardsApi';
import { groupMineRedemptions } from '@/lib/quest/rewardsLogic.js';
import { buildRewardsDevMine } from '@/lib/quest/rewardsDevFixture.js';
import { getQuestDevScenario, isQuestDevEnabled } from '@/lib/quest/devFixture';
import { rewardTitle, rewardsCopy } from '@/i18n/quest/rewards.js';
import { trackQuestEvent } from '@/lib/productObservability';
import { QUEST } from '@/theme/questTokens';

export default function MyRewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const copy = rewardsCopy('ka');
  const [groups, setGroups] = useState<{ active: RedemptionItem[]; used: RedemptionItem[]; expired: RedemptionItem[] }>({
    active: [],
    used: [],
    expired: [],
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
      setGroups(groupMineRedemptions(buildRewardsDevMine(getQuestDevScenario() as never)));
      setLoading(false);
      return;
    }
    try {
      setGroups(groupMineRedemptions(await rewardsApi.mine()));
    } catch {
      setGroups({ active: [], used: [], expired: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void trackQuestEvent('my_rewards_opened');
    void load();
  }, [load]);

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
          {copy.myRewards}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}>
        {loading ? (
          [0, 1, 2].map((i) => <Bone key={i} height={72} radius={QUEST.rowRadius} />)
        ) : !groups.active.length && !groups.used.length && !groups.expired.length ? (
          <QuestMediLine text={copy.emptyMine} />
        ) : (
          <>
            <Group title={copy.active} items={groups.active} copy={copy} colors={colors} dark={dark} statusLabel={copy.statusIssued} />
            <Group title={copy.used} items={groups.used} copy={copy} colors={colors} dark={dark} statusLabel={copy.statusUsed} />
            <Group title={copy.expired} items={groups.expired} copy={copy} colors={colors} dark={dark} statusLabel={copy.statusExpired} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Group({
  title,
  items,
  copy,
  colors,
  dark,
  statusLabel,
}: {
  title: string;
  items: RedemptionItem[];
  copy: ReturnType<typeof rewardsCopy>;
  colors: ReturnType<typeof useThemeColors>;
  dark: boolean;
  statusLabel: string;
}) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100 }}>{title}</Text>
      {items.map((item) => {
        const name = item.reward ? rewardTitle(item.reward.titleKey, 'ka') : copy.title;
        return (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: dark ? colors.surface : '#FFFFFF',
              borderWidth: 1,
              borderColor: colors.bg300,
              borderRadius: QUEST.rowRadius,
              padding: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100 }}>
                {name}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300, marginTop: 4 }}>
                {statusLabel}
                {' · '}
                {new Date(item.redeemedAt).toLocaleDateString('ka-GE')}
                {item.expiresAt ? ` · ${copy.expires} ${new Date(item.expiresAt).toLocaleDateString('ka-GE')}` : ''}
              </Text>
              {item.code ? (
                <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.primary100 }}>
                  {item.codeMasked || '••••'}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={16} color={colors.text300} />
          </View>
        );
      })}
    </View>
  );
}
