import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Gift } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Bone } from '@/components/ui/Skeleton';
import { QuestAnimatedNumber } from '@/components/quest/QuestAnimatedNumber';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useOffline } from '@/hooks/useOffline';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { formatQuestNumber } from '@/lib/quest/logic.js';
import { rewardsApi, type RedeemResult, type StoreReward } from '@/lib/quest/rewardsApi';
import { canShowRedeem, coinsShortfall, newIdempotencyKey } from '@/lib/quest/rewardsLogic.js';
import { buildRewardsDevCatalog } from '@/lib/quest/rewardsDevFixture.js';
import { getQuestDevScenario, isQuestDevEnabled } from '@/lib/quest/devFixture';
import {
  coinCostBucket,
  rewardDescription,
  rewardErrorMessage,
  rewardTerms,
  rewardTitle,
  rewardsCopy,
} from '@/i18n/quest/rewards.js';
import {
  getMediCoinBalanceHint,
  invalidateMediCoinBalance,
  requestEntitlementRefresh,
  subscribeMediCoinBalance,
} from '@/lib/quest/cache';

export default function RewardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const offline = useOffline();
  const copy = rewardsCopy('ka');
  const [reward, setReward] = useState<StoreReward | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RedeemResult | null>(null);
  const [displayBalance, setDisplayBalance] = useState<number | null>(null);
  const [codeRevealed, setCodeRevealed] = useState(false);
  const idemRef = useRef(newIdempotencyKey());

  const load = useCallback(async () => {
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
      const catalog = buildRewardsDevCatalog(getQuestDevScenario() as never);
      const found = [...catalog.featured, ...catalog.available].find((r) => r.id === id) || catalog.featured[0];
      setReward(found);
      setDisplayBalance(catalog.balance.coins);
      setLoading(false);
      return;
    }
    try {
      const row = await rewardsApi.get(String(id));
      setReward(row);
      setDisplayBalance(row.userBalance);
      void trackQuestEvent('reward_viewed', row.key);
    } catch {
      setReward(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const balance = displayBalance ?? reward?.userBalance ?? 0;
  const shortfall = reward ? coinsShortfall(reward.coinCost, balance) : 0;
  const redeemable = canShowRedeem(reward, { offline });

  const onRedeem = async () => {
    if (!reward || busy || offline) return;
    setBusy(true);
    setError(null);
    void trackQuestEvent('reward_redeem_started', reward.key);
    try {
      if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
        const fake: RedeemResult = {
          ok: true,
          redemption: {
            id: 'dev-redemption',
            status: 'ISSUED',
            coinCost: reward.coinCost,
            redeemedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            usedAt: null,
            reward: {
              id: reward.id,
              key: reward.key,
              type: reward.type,
              titleKey: reward.titleKey,
              descriptionKey: reward.descriptionKey,
              termsKey: reward.termsKey,
              imageKey: reward.imageKey,
              partnerDisplay: reward.partnerDisplay,
            },
            code: reward.type.includes('PARTNER') || reward.type === 'COUPON_CODE' ? 'MEDI-DEV-QA-01' : null,
            codeMasked: '********QA-01',
            entitlement: reward.entitlementKey
              ? {
                  entitlementKey: reward.entitlementKey,
                  startsAt: new Date().toISOString(),
                  endsAt: new Date(Date.now() + (reward.entitlementDurationDays || 7) * 86_400_000).toISOString(),
                  status: 'ACTIVE',
                }
              : null,
          },
          wallet: {
            previousBalance: balance,
            currentBalance: Math.max(0, balance - reward.coinCost),
            spent: reward.coinCost,
          },
          entitlement: null,
        };
        fake.entitlement = fake.redemption.entitlement;
        setSuccess(fake);
        setDisplayBalance(fake.wallet.currentBalance);
        invalidateMediCoinBalance({ coins: fake.wallet.currentBalance });
        requestEntitlementRefresh();
        setConfirm(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void trackQuestEvent('reward_redeemed', `${reward.key}:${coinCostBucket(reward.coinCost)}`);
        return;
      }
      const result = await rewardsApi.redeem(reward.id, idemRef.current);
      setSuccess(result);
      setDisplayBalance(result.wallet.currentBalance);
      invalidateMediCoinBalance({ coins: result.wallet.currentBalance });
      requestEntitlementRefresh();
      setConfirm(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void trackQuestEvent('reward_redeemed', `${reward.key}:${coinCostBucket(reward.coinCost)}`);
    } catch (err: unknown) {
      const code = err instanceof ApiError && err.code ? err.code : 'REWARD_REDEMPTION_CONFLICT';
      setError(rewardErrorMessage(code, 'ka'));
      void trackQuestEvent('reward_redeem_failed', `${reward.key}:${code}`);
      idemRef.current = newIdempotencyKey();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top, paddingHorizontal: 16, gap: 12 }}>
        <Bone height={44} radius={12} />
        <Bone height={220} radius={QUEST.radius} />
      </View>
    );
  }

  if (!reward) {
    return (
      <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} />
        </Pressable>
        <QuestMediLine text={rewardErrorMessage('REWARD_NOT_FOUND', 'ka')} />
      </View>
    );
  }

  const title = rewardTitle(reward.titleKey, 'ka');
  const after = Math.max(0, balance - reward.coinCost);

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
        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 16 }}>
        <View
          style={{
            backgroundColor: dark ? colors.surface : '#FFFFFF',
            borderWidth: 1,
            borderColor: colors.bg300,
            borderRadius: QUEST.radius,
            padding: 20,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
            }}
          >
            <Gift size={22} color={colors.primary200} strokeWidth={2.2} />
          </View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 28, color: colors.text100 }}>
            {title}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, lineHeight: 22, color: colors.text200 }}>
            {rewardDescription(reward.descriptionKey, 'ka')}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.primary100 }}>
            {copy.costLabel}: {formatQuestNumber(reward.coinCost, 'ka')} Medi Coins
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300 }}>
            {copy.youHave}: {formatQuestNumber(balance, 'ka')}
          </Text>
          {shortfall > 0 ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300 }}>
              {copy.needMore(formatQuestNumber(shortfall, 'ka'))}
            </Text>
          ) : null}
        </View>

        <Block title={copy.whatYouGet} body={rewardDescription(reward.descriptionKey, 'ka')} colors={colors} dark={dark} />
        {reward.entitlementDurationDays ? (
          <Block title={copy.validity} body={copy.days(reward.entitlementDurationDays)} colors={colors} dark={dark} />
        ) : null}
        {reward.partnerDisplay ? (
          <Block title={copy.partner} body={reward.partnerDisplay.displayName} colors={colors} dark={dark} />
        ) : null}
        {reward.termsKey ? (
          <Block title={copy.terms} body={rewardTerms(reward.termsKey, 'ka')} colors={colors} dark={dark} />
        ) : null}

        {error ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#DC2626' }}>{error}</Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          paddingBottom: insets.bottom + 16,
          backgroundColor: dark ? colors.bg100 : '#F8FAFC',
          borderTopWidth: 1,
          borderTopColor: colors.bg300,
        }}
      >
        <Button
          label={copy.redeem}
          onPress={() => setConfirm(true)}
          disabled={!redeemable || busy}
          accessibilityLabel={`${copy.redeem} ${title} ${formatQuestNumber(reward.coinCost, 'ka')} Medi Coins`}
        />
        {offline ? (
          <Text style={{ marginTop: 8, textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
            {copy.offlineRedeem}
          </Text>
        ) : null}
      </View>

      <Modal visible={confirm} {...APP_MODAL_PROPS} onRequestClose={() => setConfirm(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }} onPress={() => setConfirm(false)} />
          <View
            style={{
              backgroundColor: dark ? colors.surfaceRaised : '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
              paddingBottom: insets.bottom + 20,
              gap: 12,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>{copy.confirmTitle}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, color: colors.text200 }}>
              {copy.confirmBody(formatQuestNumber(reward.coinCost, 'ka'))}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300 }}>
              {copy.balanceNow}: {formatQuestNumber(balance, 'ka')}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300 }}>
              {copy.balanceAfter}: {formatQuestNumber(after, 'ka')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label={copy.cancel} variant="secondary" onPress={() => setConfirm(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={copy.redeem} onPress={() => void onRedeem()} disabled={busy} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(success)} {...APP_MODAL_PROPS} onRequestClose={() => setSuccess(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }} onPress={() => setSuccess(null)} />
          <View
            style={{
              backgroundColor: dark ? colors.surfaceRaised : '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 20,
              paddingBottom: insets.bottom + 20,
              gap: 12,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: colors.text100 }}>{copy.successTitle}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300 }}>{copy.coinsLabel}</Text>
              <QuestAnimatedNumber
                value={success?.wallet.currentBalance ?? balance}
                locale="ka"
                style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, color: colors.text100 }}
              />
            </View>
            {success?.redemption.code ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.text300 }}>CODE</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={codeRevealed ? copy.copyCode : copy.codeHidden}
                  onPress={async () => {
                    if (!codeRevealed) {
                      setCodeRevealed(true);
                      return;
                    }
                    await Share.share({ message: success.redemption.code || '' });
                  }}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: dark ? colors.bg200 : '#F1F5F9',
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, letterSpacing: 1, color: colors.text100 }}>
                    {codeRevealed ? success.redemption.code : success.redemption.codeMasked || '••••'}
                  </Text>
                </Pressable>
                {success.redemption.expiresAt ? (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text300 }}>
                    {copy.expires}: {new Date(success.redemption.expiresAt).toLocaleDateString('ka-GE')}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {success?.entitlement ? (
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text200 }}>
                {success.entitlement.entitlementKey} · {copy.expires}{' '}
                {new Date(success.entitlement.endsAt).toLocaleDateString('ka-GE')}
              </Text>
            ) : null}
            <Button
              label={copy.viewMine}
              onPress={() => {
                setSuccess(null);
                router.push('/medi-quest/rewards/mine' as never);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Block({
  title,
  body,
  colors,
  dark,
}: {
  title: string;
  body: string;
  colors: ReturnType<typeof useThemeColors>;
  dark: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: dark ? colors.surface : '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.bg300,
        borderRadius: QUEST.rowRadius,
        padding: 14,
        gap: 6,
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, color: colors.text300 }}>{title}</Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, color: colors.text200 }}>{body}</Text>
    </View>
  );
}
