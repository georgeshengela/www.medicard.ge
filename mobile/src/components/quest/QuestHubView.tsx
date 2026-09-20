import React, { useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CircleHelp, Coins, Droplets, Flame, Footprints, Gift, History, Sparkles, Trophy, Wallet } from 'lucide-react-native';
import type { QuestDashboard, QuestItem } from '@/lib/quest/api';
import type { CompanionCosmetic, CompanionOverview } from '@/lib/companion/api';
import { levelRingProgress, rankLabel } from '@/lib/quest/logic.js';
import { orderedMissions, type QuestHubTab } from '@/lib/quest/hubPresentation';
import { QuestCard } from './QuestCard';
import { QuestLevelRing } from './QuestLevelRing';
import { QuestProgressBar } from './QuestProgressBar';
import { QuestJourneyPanel, QuestCollectionPanel } from './QuestJourneyPanel';
import { QuestGuideSheet } from './QuestGuideSheet';
import { Bone } from '@/components/ui/Skeleton';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { QButton, QCard, QF, QHeading, QLink, QNotice, QText } from './QuestHubPrimitives';

export type QuestHubViewProps = {
  dashboard: QuestDashboard | null; loading: boolean; error: boolean; stale: boolean; offline: boolean;
  tab: QuestHubTab; onTab: (tab: QuestHubTab) => void; onBack: () => void; onNavigate: (path: string) => void;
  refreshing: boolean; onRefresh: () => void;
  claimingId: string | null; claimError: { id: string; message: string } | null; onClaim: (id: string) => void;
  companion: CompanionOverview | null; companionLoading: boolean; companionError: boolean; companionStale: boolean;
  onCompanionRetry: () => void; onEquip: (item: CompanionCosmetic, clear?: boolean) => void; equipBusy: string | null; equipError: string | null;
  questStyle?: boolean; contextFor?: (q: QuestItem) => string | null; whyLabel?: (q: QuestItem) => string | null; onWhy?: (q: QuestItem) => void;
};
const TABS: Array<{ key: QuestHubTab; label: string }> = [{ key: 'missions', label: 'მისიები' }, { key: 'progress', label: 'პროგრესი' }, { key: 'rewards', label: 'ჯილდოები' }];
export function QuestHubView(p: QuestHubViewProps) {
  const c = useThemeColors(), dark = useIsDark(), insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [guide, setGuide] = useState(false);
  const ink = dark ? '#5EEAD4' : '#0F766E';
  const profile = p.dashboard?.profile;
  const daily = orderedMissions(p.dashboard?.daily.quests ?? []), weekly = orderedMissions(p.dashboard?.weekly.quests ?? []);
  const unavailable = Boolean(p.dashboard?.unavailable || (p.dashboard && !profile));
  const setupSteps = ![...daily, ...weekly].some(q => q.progressType === 'STEPS');
  const setupWater = !daily.some(q => q.progressType === 'HYDRATION_GOAL_PERCENT');
  const open = p.onNavigate;
  const card = (quest: QuestItem, weeklyCard = false) => <View key={quest.id} style={{ gap: 8 }}>
    <QuestCard quest={quest} weekly={weeklyCard} offline={p.offline || p.stale} claiming={p.claimingId === quest.id} claimDisabled={Boolean(p.claimingId)} onClaim={() => p.onClaim(quest.id)} onOpenMedi={() => open('/chat/doctor')}
      contextHint={p.contextFor?.(quest)} whyTargetLabel={p.whyLabel?.(quest)} onWhyTarget={() => p.onWhy?.(quest)}
      action={quest.status === 'ACTIVE' && quest.progressType === 'STEPS' ? { label: 'ნაბიჯების ნახვა', onPress: () => open('/health-metrics/steps') } : quest.status === 'ACTIVE' && quest.progressType === 'HYDRATION_GOAL_PERCENT' ? { label: 'წყლის ჩაწერა', onPress: () => open('/health-metrics/hydration') } : undefined} />
    {p.claimError?.id === quest.id ? <QNotice text={p.claimError.message} danger /> : null}
  </View>;
  const companionBody = (content: React.ReactNode) => p.companion ? <View style={{ gap: 12 }}>
    {p.companionStale || p.companionError ? <QNotice text="პროგრესის ბოლო შენახულ ვერსიას ხედავ." action="განახლება" onPress={p.onCompanionRetry} /> : null}{content}
  </View> : p.companionLoading ? <View style={{ gap: 12 }}><Bone height={210} radius={24} /><Bone height={110} radius={24} /></View> : <QCard><QText bold>პროგრესი ვერ ჩაიტვირთა</QText><QText muted>მისიების შესრულება შეგიძლია გააგრძელო. შენი პროგრესი ანგარიშზე ინახება.</QText><QButton secondary label="ხელახლა ცდა" onPress={p.onCompanionRetry} /></QCard>;

  return <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="უკან" onPress={p.onBack} style={{ width: 44, height: 44, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bg300, alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={20} color={c.text100} /></Pressable>
      <Text accessibilityRole="header" style={{ flex: 1, fontFamily: QF.bold, fontSize: 19, letterSpacing: -.4, color: c.text100 }}>MEDI <Text style={{ color: ink }}>QUEST</Text></Text>
      <Pressable accessibilityRole="button" accessibilityLabel="როგორ მუშაობს MEDI QUEST" onPress={() => setGuide(true)} style={{ width: 44, height: 44, borderRadius: 17, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}><CircleHelp size={21} color={ink} /></Pressable>
    </View>
    <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 2, marginBottom: 8, padding: 4, borderRadius: 19, backgroundColor: c.surfaceRaised }}>
      {TABS.map(tab => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: p.tab === tab.key }} onPress={() => { p.onTab(tab.key); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={{ flex: 1, minHeight: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: p.tab === tab.key ? c.surface : 'transparent', borderWidth: p.tab === tab.key ? 1 : 0, borderColor: c.bg300 }}><QText bold size={13} color={p.tab === tab.key ? ink : c.text200}>{tab.label}</QText></Pressable>)}
    </View>
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 28, gap: 20 }} refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={c.primary200} />}>
      {p.offline || p.stale ? <QNotice text={p.offline ? 'ოფლაინი · ბოლო შენახული მონაცემები' : 'მონაცემები ვერ განახლდა · შენახული ვერსია'} action={p.offline ? undefined : 'განახლება'} onPress={p.onRefresh} /> : null}
      {p.loading && !p.dashboard ? <><Bone height={230} radius={24} /><Bone height={140} radius={24} /><Bone height={140} radius={24} /></> : p.error && !p.dashboard || unavailable ? <QCard>
        <Sparkles size={30} color={ink} /><QText size={20} bold>{unavailable ? 'მისიები დროებით მიუწვდომელია' : 'MEDI QUEST ვერ ჩაიტვირთა'}</QText><QText muted>სცადე გვერდის განახლება. შენი დაგროვილი მონაცემები ანგარიშზე რჩება.</QText><QButton label="ხელახლა ცდა" onPress={p.onRefresh} /><QButton secondary label="როგორ მუშაობს?" onPress={() => setGuide(true)} />
      </QCard> : p.dashboard ? <>
        {p.tab === 'missions' ? <>
          <View style={{ gap: 4 }}><QText size={25} bold>პატარა ნაბიჯები.{"\n"}შენი დიდი პროგრესი.</QText><QText size={13} muted>შეასრულე მისია, მიიღე ჯილდო და გახსენი ახალი ეტაპი.</QText></View>
          {profile ? <QCard style={{ borderColor: p.questStyle ? '#B87400' : c.bg300 }}>
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
              <QuestLevelRing percent={levelRingProgress(profile).percent} label={String(profile.level)} caption="დონე" size={96} accessibilityLabel={`დონე ${profile.level}`} />
              <View style={{ flex: 1, gap: 3 }}><QText size={19} bold>{rankLabel(profile.rankKey, 'ka')}</QText><QText size={12} muted>{profile.totalXp.toLocaleString()} XP დაგროვილია</QText><QText size={12} color={ink}>{levelRingProgress(profile).remaining != null ? `შემდეგ დონემდე ${levelRingProgress(profile).remaining} XP` : 'უმაღლესი დონე მიღწეულია'}</QText></View>
            </View>
            <View style={{ height: 1, backgroundColor: c.bg300, marginVertical: 2 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="მონეტები და ჯილდოები" onPress={() => { p.onTab('rewards'); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={{ flex: 1, gap: 3, minHeight: 62, justifyContent: 'center' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Coins size={17} color={c.warning} /><QText size={20} bold>{profile.coinBalance.toLocaleString()}</QText></View><QText size={11} muted>Medi Coins · ჯილდოებისთვის</QText></Pressable>
              <View style={{ width: 1, backgroundColor: c.bg300 }} />
              <Pressable accessibilityRole="button" accessibilityLabel="როგორ მუშაობს სერია" onPress={() => setGuide(true)} style={{ flex: 1, gap: 3, minHeight: 62, paddingLeft: 12, justifyContent: 'center' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Flame size={17} color={c.warning} /><QText size={20} bold>{profile.currentStreak} დღე</QText></View><QText size={11} muted>სერია · თითო დღიური მისია</QText></Pressable>
            </View>
          </QCard> : null}
          {p.dashboard.summary.unclaimedRewards > 0 ? <QNotice text={`${p.dashboard.summary.unclaimedRewards} მისიის ჯილდო მზადაა — მიიღე ბარათიდან ქვემოთ.`} /> : null}
          <View style={{ gap: 12 }}>
            <QHeading title="დღის მისიები" meta={`${p.dashboard.summary.dailyCompleted} / ${p.dashboard.summary.dailyTotal} შესრულდა`} />
            {daily.length ? <QuestProgressBar percent={p.dashboard.summary.dailyTotal ? p.dashboard.summary.dailyCompleted / p.dashboard.summary.dailyTotal * 100 : 0} height={5} /> : <QNotice text="დღიური მისიები ჯერ არ არის. შეამოწმე აქტივობისა და ჰიდრატაციის პარამეტრები ქვემოთ." />}
            {daily.map(q => card(q))}
          </View>
          {weekly.length ? <View style={{ gap: 12 }}><QHeading title="კვირის გამოწვევა" meta="ორშაბათი — კვირა" />{weekly.map(q => card(q, true))}</View> : null}
          {setupSteps ? <QLink title="ნაბიჯები დაუკავშირე" body="შეამოწმე ჯანმრთელობის აპის წვდომა მოძრაობის მისიებისთვის." icon={<Footprints size={21} color={ink} />} onPress={() => open('/profile/permissions')} /> : null}
          {setupWater ? <QLink title="წყლის მიზანი დააყენე" body="შენი დღიური მიზანი ჰიდრატაციის მისიას გახსნის." icon={<Droplets size={21} color={ink} />} onPress={() => open('/health-metrics/hydration')} /> : null}
          <QLink title="ნახე, როგორ ვითარდები" body="ეტაპები და კოლექცია — შენი შესრულებული მისიებიდან." icon={<Trophy size={21} color={ink} />} onPress={() => { p.onTab('progress'); scroll.current?.scrollTo({ y: 0, animated: false }); }} />
        </> : p.tab === 'progress' ? <>
          <View><QText size={25} bold>ყოველი მისია წინ გწევს.</QText><QText size={13} muted>შენი ეტაპები, სერია და მიღწევები ერთ გზაზე.</QText></View>
          {companionBody(p.companion ? <QuestJourneyPanel overview={p.companion} onGuide={() => setGuide(true)} /> : null)}
          {profile ? <QCard><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Flame size={21} color={c.warning} /><QText bold>შენი სერია</QText></View><QText muted>ახლა {profile.currentStreak} დღე · საუკეთესო {profile.longestStreak} დღე</QText><QText size={12} muted>ყოველ დღე ერთი დღიური მისიის შესრულება მაინც აგრძელებს სერიას.</QText></QCard> : null}
          <QLink title="ჩემი მიღწევები" body="ნახე გახსნილი ნიშნები და მისაღები ჯილდოები." icon={<Trophy size={21} color={ink} />} onPress={() => open('/medi-quest/achievements')} />
          <QLink title="მისიების ისტორია" body="შესრულებული, მიღებული და დასრულებული მისიები." icon={<History size={21} color={ink} />} onPress={() => open('/medi-quest/history')} />
        </> : <>
          <View><QText size={25} bold>შენი შრომის შედეგი.</QText><QText size={13} muted>მონეტები გამოიყენე ჯილდოებისთვის, კოლექციით კი შენი ნიშანი გააფორმე.</QText></View>
          <QCard><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Coins size={24} color={c.warning} /><QText size={13} muted>ხელმისაწვდომი ბალანსი</QText></View><QText size={38} bold>{profile?.coinBalance.toLocaleString() ?? '—'} <QText muted>Medi Coins</QText></QText><QButton label="ჯილდოების მაღაზია" icon={<Gift size={18} color="#FFFFFF" />} onPress={() => open('/medi-quest/rewards')} /><QText size={12} muted>ხელმისაწვდომ შეთავაზებებსა და მათ პირობებს მაღაზიაში ნახავ.</QText></QCard>
          <QLink title="ბალანსის ისტორია" body="საიდან მიიღე და რაში გამოიყენე მონეტები." icon={<Wallet size={21} color={ink} />} onPress={() => open('/medi-quest/wallet')} />
          {companionBody(p.companion ? <QuestCollectionPanel overview={p.companion} onEquip={p.onEquip} busyKey={p.equipBusy} error={p.equipError} offline={p.offline || p.companionStale} /> : null)}
        </>}
        <Pressable accessibilityRole="button" onPress={() => setGuide(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48 }}><CircleHelp size={17} color={ink} /><QText bold size={13} color={ink}>როგორ მუშაობს MEDI QUEST?</QText></Pressable>
      </> : null}
    </ScrollView>
    <QuestGuideSheet visible={guide} onClose={() => setGuide(false)} timezone={p.dashboard?.daily.timezone ?? profile?.timezone} />
  </View>;
}
