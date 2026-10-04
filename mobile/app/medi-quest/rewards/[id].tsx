import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarClock, Check, ChevronDown, ChevronUp, Gift, MapPin, RefreshCw, Sparkles, Store } from 'lucide-react-native';
import { appLang, tx } from '@/i18n/locale';
import { isPhoneRequiredError, offerPhoneVerification } from '@/lib/phoneGate';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { Bone } from '@/components/ui/Skeleton';
import {
  AffordLine,
  QuestButton,
  QuestSheet,
  RewardStage,
  StockPill,
  coins,
  isSoldOut,
  questDate,
  useQuestInk,
} from '@/components/quest/store/QuestStoreKit';
import { useOffline } from '@/hooks/useOffline';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { ApiError } from '@/lib/api';
import { rewardsApi, type RedeemResult, type StoreReward } from '@/lib/quest/rewardsApi';
import { trackQuestEvent } from '@/lib/productObservability';
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
import { invalidateMediCoinBalance, requestEntitlementRefresh } from '@/lib/quest/cache';

const fmtDate = questDate;

/**
 * Reward detail (owner 2026-10-04 redesign): the prize big on its stage, the price with how far away it
 * is, what you get and how you receive it, terms folded, and one sticky button that always says what
 * will happen — or why it can't yet. Confirm and success are bottom sheets; a redeem error shows in
 * the confirm sheet, where the person is looking.
 */
export default function RewardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const ink = useQuestInk();
  const { width } = useWindowDimensions();
  const offline = useOffline();
  const copy = rewardsCopy(appLang());
  const [reward, setReward] = useState<StoreReward | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState<'missing' | 'error' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RedeemResult | null>(null);
  const [displayBalance, setDisplayBalance] = useState<number | null>(null);
  const [codeRevealed, setCodeRevealed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const idemRef = useRef(newIdempotencyKey());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(null);
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
    } catch (err) {
      setReward(null);
      setLoadFailed(err instanceof ApiError && err.status === 404 ? 'missing' : 'error');
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

  const finishSuccess = (result: RedeemResult) => {
    if (!reward) return;
    setSuccess(result);
    setDisplayBalance(result.wallet.currentBalance);
    invalidateMediCoinBalance({ coins: result.wallet.currentBalance });
    requestEntitlementRefresh();
    setConfirm(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void trackQuestEvent('reward_redeemed', `${reward.key}:${coinCostBucket(reward.coinCost)}`);
  };

  const onRedeem = async () => {
    if (!reward || busy || offline) return;
    setBusy(true);
    setError(null);
    void trackQuestEvent('reward_redeem_started', reward.key);
    try {
      if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
        const endsAt = new Date(Date.now() + (reward.entitlementDurationDays || 7) * 86_400_000).toISOString();
        const fake: RedeemResult = {
          ok: true,
          redemption: {
            id: 'dev-redemption',
            status: reward.type === 'PHYSICAL_PRIZE' ? 'PENDING' : 'ISSUED',
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
              imageUrl: reward.imageUrl,
              partnerDisplay: reward.partnerDisplay,
            },
            code: reward.type.includes('PARTNER') || reward.type === 'COUPON_CODE' ? 'MEDI-DEV-QA-01' : null,
            codeMasked: '********QA-01',
            entitlement: reward.entitlementKey ? { entitlementKey: reward.entitlementKey, startsAt: new Date().toISOString(), endsAt, status: 'ACTIVE' } : null,
          },
          wallet: { previousBalance: balance, currentBalance: Math.max(0, balance - reward.coinCost), spent: reward.coinCost },
          entitlement: null,
        };
        fake.entitlement = fake.redemption.entitlement;
        finishSuccess(fake);
        return;
      }
      finishSuccess(await rewardsApi.redeem(reward.id, idemRef.current));
    } catch (err: unknown) {
      if (isPhoneRequiredError(err)) {
        setConfirm(false);
        idemRef.current = newIdempotencyKey();
        offerPhoneVerification(router);
        return;
      }
      const code = err instanceof ApiError && err.code ? err.code : 'REWARD_REDEMPTION_CONFLICT';
      setError(rewardErrorMessage(code, appLang()));
      void trackQuestEvent('reward_redeem_failed', `${reward.key}:${code}`);
      idemRef.current = newIdempotencyKey();
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <ModuleHeader module="quest" subtitle={tx('ჯილდო', 'Reward')} fallbackHref="/medi-quest/rewards" style={s.gutter} />
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top + 12, gap: 16 }}>
        {header}
        <View style={[s.gutter, { gap: 14 }]}>
          <Bone height={Math.round(width * 0.72)} radius={28} />
          <Bone width={220} height={28} radius={8} />
          <Bone height={90} radius={20} />
        </View>
      </View>
    );
  }

  if (!reward) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top + 12, gap: 20 }}>
        {header}
        <View style={[s.gutter]}>
          <View style={[s.card, { backgroundColor: c.surface }]}>
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>
              {loadFailed === 'missing' ? tx('ეს ჯილდო აღარ არის მაღაზიაში', 'This reward is no longer in the store') : tx('ჯილდო ვერ ჩაიტვირთა', 'The reward didn’t load')}
            </Text>
            <Text style={[hubText.caption, { color: c.text200 }]}>
              {loadFailed === 'missing' ? tx('სხვა საჩუქრებს მაღაზიაში ნახავ.', 'You’ll find other prizes in the store.') : tx('შეამოწმე ინტერნეტი და სცადე ხელახლა.', 'Check your connection and try again.')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              {loadFailed === 'error' ? <QuestButton label={tx('ხელახლა ცდა', 'Try again')} onPress={() => void load()} /> : null}
              <QuestButton kind="secondary" label={tx('მაღაზია', 'Store')} onPress={() => router.replace('/medi-quest/rewards' as never)} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  const title = rewardTitle(reward.titleKey, appLang());
  const description = rewardDescription(reward.descriptionKey, appLang());
  const terms = reward.termsKey ? rewardTerms(reward.termsKey, appLang()) : '';
  const physical = reward.type === 'PHYSICAL_PRIZE';
  const soldOut = isSoldOut(reward);
  const after = Math.max(0, balance - reward.coinCost);
  const blocker = soldOut
    ? tx('ამოიწურა', 'Sold out')
    : offline
      ? copy.offlineRedeem
      : shortfall > 0
        ? tx(`კიდევ ${coins(shortfall)} მონეტა გჭირდება`, `You need ${coins(shortfall)} more coins`)
        : !redeemable && reward.userEligibility?.reasonCode
          ? rewardErrorMessage(reward.userEligibility.reasonCode, appLang())
          : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120, width: '100%', maxWidth: 760, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
        {header}

        <View style={[s.gutter, { marginTop: 18 }]}>
          <RewardStage reward={reward} height={Math.round(Math.min(width, 760) * 0.72)} radius={28}>
            <View style={{ position: 'absolute', top: 14, left: 14 }}><StockPill reward={reward} /></View>
          </RewardStage>
        </View>

        <View style={[s.gutter, { marginTop: 18, gap: 6 }]}>
          {reward.partnerDisplay?.displayName ? (
            <Text style={[hubText.caption, { color: ink.violet }]}>{reward.partnerDisplay.displayName}</Text>
          ) : null}
          <Text accessibilityRole="header" style={[s.title, { color: c.text100 }]}>{title}</Text>
          <Text style={[hubText.body, { color: c.text200 }]}>{description}</Text>
        </View>

        <View style={[s.gutter, { marginTop: 18 }]}>
          <View style={[s.card, { backgroundColor: c.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AffordLine cost={reward.coinCost} balance={balance} soldOut={soldOut} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[hubText.small, { color: c.text300 }]}>{tx('შენ გაქვს', 'You have')}</Text>
                <Text style={[s.have, { color: c.text100 }]}>{coins(balance)}</Text>
              </View>
            </View>
            {shortfall > 0 && !soldOut ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/medi-quest?tab=missions' as never)} style={[s.earn, { backgroundColor: ink.dark ? 'rgba(196,181,253,0.10)' : '#F5F1FF' }]}>
                <Sparkles size={16} color={ink.violet} />
                <Text style={[hubText.caption, { color: c.text100, flex: 1 }]}>
                  {tx('მონეტები მისიებით, MEDIRUN-ის ყუთებით და მეგობრების მოწვევით გროვდება.', 'Coins come from missions, MEDIRUN boxes and inviting friends.')}
                </Text>
                <Text style={[hubText.link, { color: ink.violet }]}>{tx('მისიები', 'Missions')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[s.gutter, { marginTop: 12 }]}>
          <View style={[s.list, { backgroundColor: c.surface }]}>
            {physical ? (
              <InfoRow icon={MapPin} title={tx('როგორ მიიღებ', 'How you get it')} body={tx('თბილისში 14 დღეში გადმოგცემთ — დაგიკავშირდებით ანგარიშის ტელეფონზე. თუ ვერ მოხერხდა, მონეტები სრულად დაგიბრუნდება.', 'We hand it over in Tbilisi within 14 days and call your account phone first. If that fails, every coin comes back.')} />
            ) : null}
            {reward.entitlementDurationDays ? (
              <InfoRow icon={CalendarClock} title={copy.validity} body={copy.days(reward.entitlementDurationDays)} />
            ) : null}
            {reward.partnerDisplay?.displayName ? (
              <InfoRow icon={Store} title={copy.partner} body={reward.partnerDisplay.displayName} />
            ) : null}
            {terms ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: termsOpen }}
                onPress={() => setTermsOpen((v) => !v)}
                style={s.termsRow}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100, flex: 1, fontSize: 14 }]}>{copy.terms}</Text>
                  {termsOpen ? <ChevronUp size={18} color={c.text300} /> : <ChevronDown size={18} color={c.text300} />}
                </View>
                {termsOpen ? <Text style={[hubText.caption, { color: c.text200, marginTop: 8 }]}>{terms}</Text> : null}
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12, backgroundColor: c.bg100, borderTopColor: c.bg300 }]}>
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row' }}>
          <QuestButton
            label={blocker ?? tx(`აიღე · ${coins(reward.coinCost)} მონეტა`, `Get it · ${coins(reward.coinCost)} coins`)}
            a11y={blocker ?? tx(`${title}-ის აღება ${coins(reward.coinCost)} მონეტად`, `Get ${title} for ${coins(reward.coinCost)} coins`)}
            disabled={Boolean(blocker) || !redeemable}
            onPress={() => {
              setError(null);
              setConfirm(true);
            }}
          />
        </View>
      </View>

      <QuestSheet visible={confirm} onClose={() => (busy ? undefined : setConfirm(false))} dismissable={!busy}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 72 }}>
            <RewardStage reward={reward} height={72} radius={18} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[hubText.small, { color: c.text300 }]}>{tx('ადასტურებ?', 'Confirm?')}</Text>
            <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100 }]}>{title}</Text>
          </View>
        </View>
        <View style={[s.ledger, { borderColor: c.bg300 }]}>
          <LedgerRow label={copy.balanceNow} value={coins(balance)} />
          <LedgerRow label={tx('ღირებულება', 'Price')} value={`− ${coins(reward.coinCost)}`} />
          <View style={[s.hair, { backgroundColor: c.bg300 }]} />
          <LedgerRow label={tx('დაგრჩება', 'Left after')} value={coins(after)} strong />
        </View>
        {physical ? (
          <Text style={[hubText.caption, { color: c.text200 }]}>
            {tx('ანგარიშის ტელეფონზე დაგირეკავთ და საჩუქარს თბილისში 14 დღეში გადმოგცემთ.', 'We’ll call your account phone and hand the prize over in Tbilisi within 14 days.')}
          </Text>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={[hubText.caption, { color: c.danger }]}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <QuestButton kind="secondary" label={copy.cancel} disabled={busy} onPress={() => setConfirm(false)} />
          <QuestButton label={tx('დადასტურება', 'Confirm')} busy={busy} onPress={() => void onRedeem()} />
        </View>
      </QuestSheet>

      <QuestSheet visible={Boolean(success)} onClose={() => setSuccess(null)}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View style={{ width: 150 }}>
            <RewardStage reward={reward} height={150} radius={30} />
            <View style={[s.check, { backgroundColor: ink.violet, borderColor: c.surface }]}>
              <Check size={18} color="#FFFFFF" strokeWidth={3} />
            </View>
          </View>
          <Text accessibilityRole="header" style={[s.successTitle, { color: c.text100 }]}>{tx('ჯილდო შენია!', 'It’s yours!')}</Text>
          <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>
            {success?.redemption.status === 'PENDING'
              ? tx('ანგარიშის ტელეფონზე დაგირეკავთ და საჩუქარს თბილისში 14 დღეში გადმოგცემთ. სტატუსს „ჩემ ჯილდოებში“ ნახავ.', 'We’ll call your account phone and hand it over in Tbilisi within 14 days. Track it in My rewards.')
              : success?.entitlement
                ? tx(`აქტიურია ${fmtDate(success.entitlement.endsAt)}-მდე.`, `Active until ${fmtDate(success.entitlement.endsAt)}.`)
                : title}
          </Text>
        </View>
        {success?.redemption.code || success?.redemption.codeMasked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={codeRevealed ? tx('კოდის გაზიარება', 'Share the code') : copy.codeHidden}
            onPress={async () => {
              if (!codeRevealed) {
                setCodeRevealed(true);
                return;
              }
              await Share.share({ message: success.redemption.code || '' });
            }}
            style={[s.code, { borderColor: ink.violet }]}
          >
            <Text style={[hubText.small, { color: c.text300 }]}>{tx('კოდი', 'Code')}</Text>
            <Text style={[s.codeText, { color: c.text100 }]}>{codeRevealed ? success.redemption.code : success.redemption.codeMasked || '••••'}</Text>
            <Text style={[hubText.small, { color: ink.violet }]}>{codeRevealed ? tx('შეეხე გასაზიარებლად', 'Tap to share') : tx('შეეხე სანახავად', 'Tap to reveal')}</Text>
          </Pressable>
        ) : null}
        <Text style={[hubText.caption, { color: c.text300, textAlign: 'center' }]}>
          {tx(`დაგრჩა ${coins(success?.wallet.currentBalance ?? balance)} მონეტა`, `${coins(success?.wallet.currentBalance ?? balance)} coins left`)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <QuestButton kind="secondary" label={tx('მაღაზია', 'Store')} onPress={() => { setSuccess(null); router.back(); }} />
          <QuestButton label={copy.viewMine} onPress={() => { setSuccess(null); router.replace('/medi-quest/rewards/mine' as never); }} />
        </View>
      </QuestSheet>
    </View>
  );
}

function InfoRow({ icon: Icon, title, body }: { icon: typeof Gift; title: string; body: string }) {
  const c = useThemeColors();
  const ink = useQuestInk();
  return (
    <View style={s.infoRow}>
      <View style={[s.infoIcon, { backgroundColor: ink.dark ? 'rgba(196,181,253,0.12)' : '#F1EDFB' }]}>
        <Icon size={17} color={ink.violet} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 14 }]}>{title}</Text>
        <Text style={[hubText.caption, { color: c.text200 }]}>{body}</Text>
      </View>
    </View>
  );
}

function LedgerRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[hubText.caption, { color: strong ? c.text100 : c.text200, flex: 1 }]}>{label}</Text>
      <Text style={[strong ? s.ledgerStrong : s.ledgerValue, { color: c.text100 }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  gutter: { paddingHorizontal: HUB.gutter },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 32, letterSpacing: -0.4 },
  card: { borderRadius: 22, padding: 16, gap: 14 },
  have: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  earn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  list: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 6 },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  termsRow: { paddingVertical: 14, minHeight: 48, justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: HUB.gutter, borderTopWidth: StyleSheet.hairlineWidth },
  ledger: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  hair: { height: StyleSheet.hairlineWidth },
  ledgerValue: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  ledgerStrong: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  check: { position: 'absolute', right: -6, bottom: -6, width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 30 },
  code: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  codeText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 28, letterSpacing: 2 },
});
