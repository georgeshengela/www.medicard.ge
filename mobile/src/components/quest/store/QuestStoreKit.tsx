import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { QuestArt, QuestCoinMark } from '@/components/quest/QuestIcon';
import { rewardArt } from '@/components/quest/questArt';
import { QuestAnimatedNumber } from '@/components/quest/QuestAnimatedNumber';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { Bone } from '@/components/ui/Skeleton';
import { appLang, tx } from '@/i18n/locale';
import { rewardTitle } from '@/i18n/quest/rewards.js';
import { formatQuestNumber } from '@/lib/quest/logic.js';
import { formatYmd } from '@/lib/format';
import type { StoreReward } from '@/lib/quest/rewardsApi';
import { HUB } from '@/theme/hub';
import { MODULE_BRANDS, moduleInk } from '@/theme/moduleBrand';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * MEDIQUEST store kit (owner 2026-10-04: „ჯილდოები და მაღაზია საშინელებაა“ — make it clear, modern and
 * on-brand). One language for every rewards screen: the violet Medi Coins card (the page's one hero),
 * product tiles on a soft violet stage (prize renders are transparent 640 px PNGs), an affordability
 * bar instead of a bare price, status pills in words, and one bottom sheet shell.
 */

export const coins = (n: number) => formatQuestNumber(Math.max(0, Math.round(n)), appLang());

/** „2 ოქტომბერი“ in the app language (Hermes has no ka-GE dates, so never toLocaleDateString). */
export function questDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return formatYmd(ymd, d.getFullYear() !== new Date().getFullYear());
}

export function useQuestInk() {
  const dark = useIsDark();
  return {
    dark,
    violet: moduleInk('quest', dark),
    gold: dark ? QUEST.pill.coinInkDark : QUEST.pill.coinInkLight,
    stage: dark ? ['#211438', '#170E28'] as const : ['#F5F1FF', '#ECE6FD'] as const,
  };
}

/** Gift cards are prizes too, but people look for them separately. */
export function rewardKind(reward: Pick<StoreReward, 'type' | 'key'>): 'gadget' | 'giftcard' | 'digital' {
  if (reward.type !== 'PHYSICAL_PRIZE') return 'digital';
  return /GIFTCARD/i.test(reward.key) ? 'giftcard' : 'gadget';
}

export function isSoldOut(reward: Pick<StoreReward, 'inventoryState'>) {
  return reward.inventoryState === 'OUT_OF_STOCK' || reward.inventoryState === 'SOLD_OUT';
}

/** The violet Medi Coins card: balance, and the one next prize it is closest to. */
export function QuestWalletCard({
  balance,
  loading,
  caption,
  next,
  action,
  style,
}: {
  balance: number;
  loading?: boolean;
  caption?: string;
  /** The cheapest prize not yet affordable: how far away it is. */
  next?: { title: string; need: number; progress: number } | null;
  action?: { label: string; onPress: () => void } | null;
  style?: StyleProp<ViewStyle>;
}) {
  const brand = MODULE_BRANDS.quest;
  return (
    <View style={[s.walletWrap, style]}>
      <LinearGradient colors={brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.wallet}>
        <View pointerEvents="none" style={s.walletRings}>
          <Svg width={180} height={180}>
            {[44, 80, 116].map((r, i) => (
              <Circle key={r} cx={180} cy={0} r={r} stroke="#FFFFFF" strokeOpacity={0.16 - i * 0.04} strokeWidth={1.2} fill="none" />
            ))}
          </Svg>
        </View>
        <View pointerEvents="none" style={[s.walletGlow, { backgroundColor: brand.glow }]} />
        <Text style={s.walletLabel}>{caption ?? tx('შენი Medi Coins', 'Your Medi Coins')}</Text>
        <View style={s.walletRow}>
          <View style={s.coinDisc}>
            <QuestCoinMark size={26} color="#FCD34D" />
          </View>
          {loading ? (
            <Bone width={140} height={40} radius={10} />
          ) : (
            <QuestAnimatedNumber value={balance} locale={appLang()} style={s.walletValue} />
          )}
        </View>
        {next ? (
          <View style={{ gap: 6, marginTop: 14 }}>
            <View style={s.walletTrack}>
              <View style={[s.walletFill, { width: `${Math.round(Math.min(1, Math.max(0.03, next.progress)) * 100)}%` }]} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text numberOfLines={1} style={[s.walletNext, { flex: 1 }]}>{next.title}</Text>
              <Text style={s.walletNeed}>{tx(`კიდევ ${coins(next.need)}`, `${coins(next.need)} to go`)}</Text>
            </View>
          </View>
        ) : null}
        {action ? (
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={s.walletAction} className="active:opacity-80">
            <Text style={s.walletActionText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </LinearGradient>
    </View>
  );
}

/** The soft violet stage a prize stands on. */
export function RewardStage({ reward, height, radius = 18, children }: {
  reward: StoreReward | { type?: string | null; key?: string | null; entitlementKey?: string | null; imageUrl?: string | null };
  height: number;
  radius?: number;
  children?: React.ReactNode;
}) {
  const ink = useQuestInk();
  const photo = Boolean(reward.imageUrl);
  return (
    <LinearGradient colors={ink.stage} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ height, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <QuestArt source={rewardArt(reward)} size={Math.round(height * (photo ? 0.82 : 0.56))} />
      {children}
    </LinearGradient>
  );
}

/** Words, not enums: how many are left, sold out, or nothing. */
export function StockPill({ reward }: { reward: StoreReward }) {
  const c = useThemeColors();
  const ink = useQuestInk();
  if (isSoldOut(reward)) {
    return <Pill text={tx('ამოიწურა', 'Sold out')} fg={c.text200} bg={ink.dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.07)'} />;
  }
  if (reward.type === 'PHYSICAL_PRIZE' && typeof reward.inventoryRemaining === 'number' && reward.inventoryRemaining > 0 && reward.inventoryRemaining <= 3) {
    return <Pill text={tx(`დარჩა ${reward.inventoryRemaining}`, `${reward.inventoryRemaining} left`)} fg={ink.gold} bg={ink.dark ? 'rgba(251,191,36,0.16)' : '#FDF3DD'} />;
  }
  return null;
}

export function Pill({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text numberOfLines={1} style={[s.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/** Price with the coin; under it either „შეგიძლია აიღო“ or how far away it is, as a bar. */
export function AffordLine({ cost, balance, soldOut, compact = false }: { cost: number; balance: number; soldOut?: boolean; compact?: boolean }) {
  const c = useThemeColors();
  const ink = useQuestInk();
  const need = Math.max(0, cost - balance);
  const progress = cost > 0 ? Math.min(1, balance / cost) : 1;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <QuestCoinMark size={compact ? 15 : 17} color={ink.gold} />
        <Text style={[compact ? s.priceSmall : s.price, { color: c.text100 }]}>{coins(cost)}</Text>
      </View>
      {soldOut ? null : need === 0 ? (
        <Text numberOfLines={1} style={[s.afford, { color: ink.violet }]}>{tx('საკმარისი გაქვს', 'You have enough')}</Text>
      ) : (
        <View style={{ gap: 4 }}>
          <View style={[s.track, { backgroundColor: ink.dark ? 'rgba(255,255,255,0.08)' : '#EEE9FB' }]}>
            <View style={[s.fill, { width: `${Math.round(Math.max(0.04, progress) * 100)}%`, backgroundColor: ink.violet }]} />
          </View>
          <Text numberOfLines={1} style={[s.need, { color: c.text300 }]}>{tx(`კიდევ ${coins(need)}`, `${coins(need)} to go`)}</Text>
        </View>
      )}
    </View>
  );
}

/** Grid tile: stage, title, price + affordability. `width` from the grid so two fit side by side. */
export function RewardTile({ reward, balance, width, onPress }: { reward: StoreReward; balance: number; width: number; onPress: () => void }) {
  const c = useThemeColors();
  const title = rewardTitle(reward.titleKey, appLang());
  const soldOut = isSoldOut(reward);
  const need = Math.max(0, reward.coinCost - balance);
  const a11y = [
    title,
    tx(`${coins(reward.coinCost)} მონეტა`, `${coins(reward.coinCost)} coins`),
    soldOut ? tx('ამოიწურა', 'sold out') : need === 0 ? tx('საკმარისი გაქვს', 'you have enough') : tx(`კიდევ ${coins(need)}`, `${coins(need)} to go`),
  ].join(', ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} className="active:opacity-80" style={[s.tile, { width, backgroundColor: c.surface, opacity: soldOut ? 0.6 : 1 }]}>
      <RewardStage reward={reward} height={width - 16} radius={16}>
        <View style={s.stagePill}><StockPill reward={reward} /></View>
      </RewardStage>
      <View style={{ paddingHorizontal: 4, gap: 8, flex: 1 }}>
        <Text numberOfLines={2} style={[s.tileTitle, { color: c.text100 }]}>{title}</Text>
        <View style={{ marginTop: 'auto' }}>
          <AffordLine cost={reward.coinCost} balance={balance} soldOut={soldOut} compact />
        </View>
      </View>
    </Pressable>
  );
}

/** Two-column grid width for the current window. */
export function useTileWidth() {
  const { width } = useWindowDimensions();
  return Math.floor((Math.min(width, 760) - HUB.gutter * 2 - 12) / 2);
}

/** One bottom-sheet shell for the store's confirm / success / code sheets (fade, scrim as a sibling). */
export function QuestSheet({ visible, onClose, children, dismissable = true }: { visible: boolean; onClose: () => void; children: React.ReactNode; dismissable?: boolean }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={dismissable ? onClose : () => undefined}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('დახურვა', 'Close')}
          disabled={!dismissable}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]}
        />
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 18 }]}>
          <View style={[s.handle, { backgroundColor: c.bg300 }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Primary / secondary sheet button with a busy spinner (never a dead-looking disabled button). */
export function QuestButton({ label, onPress, kind = 'primary', busy = false, disabled = false, a11y }: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  busy?: boolean;
  disabled?: boolean;
  a11y?: string;
}) {
  const c = useThemeColors();
  const ink = useQuestInk();
  const primary = kind === 'primary';
  const off = disabled || busy;
  const bg = primary ? (disabled ? (ink.dark ? '#2A2340' : '#E7E2F4') : MODULE_BRANDS.quest.gradient[1]) : ink.dark ? 'rgba(255,255,255,0.08)' : '#F1EDFB';
  const fg = primary ? (disabled ? c.text300 : '#FFFFFF') : ink.violet;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      className="active:opacity-85"
      style={[s.button, { backgroundColor: bg }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text numberOfLines={1} style={[s.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  walletWrap: { borderRadius: 26, overflow: 'hidden' },
  wallet: { padding: 20, borderRadius: 26, overflow: 'hidden' },
  walletRings: { position: 'absolute', right: 0, top: 0 },
  walletGlow: { position: 'absolute', right: -60, top: -60, width: 180, height: 180, borderRadius: 90, opacity: 0.55 },
  walletLabel: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, color: '#E9DDFF' },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  coinDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  walletValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 36, lineHeight: 44, letterSpacing: -1, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  walletTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  walletFill: { height: 6, borderRadius: 3, backgroundColor: '#FCD34D' },
  walletNext: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17, color: '#EDE4FF' },
  walletNeed: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, lineHeight: 17, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  walletAction: { alignSelf: 'flex-start', marginTop: 16, minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' },
  walletActionText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  stagePill: { position: 'absolute', top: 8, left: 8 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, lineHeight: 15 },
  price: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24, fontVariant: ['tabular-nums'] },
  priceSmall: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  afford: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  need: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 15, fontVariant: ['tabular-nums'] },
  tile: { borderRadius: 22, padding: 8, paddingBottom: 12, gap: 10 },
  tileTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, minHeight: 36 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: HUB.gutter, gap: 16 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  button: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flex: 1 },
  buttonText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20 },
});
