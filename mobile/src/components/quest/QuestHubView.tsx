import React, { useRef, useState } from 'react';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleHelp, Sparkles } from 'lucide-react-native';
import { QuestWalletCard } from '@/components/quest/store/QuestStoreKit';
import { QUEST_ART } from '@/constants/appArt';
import type { QuestDashboard, QuestItem } from '@/lib/quest/api';
import type { CompanionCosmetic, CompanionOverview } from '@/lib/companion/api';
import { appLang, isEn, tx } from '@/i18n/locale';
import { levelRingProgress, rankLabel } from '@/lib/quest/logic.js';
import { orderedMissions, type QuestHubTab } from '@/lib/quest/hubPresentation';
import { QuestCard } from './QuestCard';
import { QuestLevelRing } from './QuestLevelRing';
import { QuestProgressBar } from './QuestProgressBar';
import { QuestJourneyPanel, QuestCollectionPanel } from './QuestJourneyPanel';
import { QuestGuideSheet } from './QuestGuideSheet';
import { QuestArt, QuestCoinMark } from './QuestIcon';
import { QUEST_GIFT_ART, QUEST_STEPS_ART, QUEST_STREAK_ART, QUEST_TROPHY_ART } from './questArt';
import { Bone } from '@/components/ui/Skeleton';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
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
const TABS: Array<{ key: QuestHubTab; label: string }> = [{ key: 'missions', label: tx('მისიები', 'Missions') }, { key: 'progress', label: tx('პროგრესი', 'Progress') }, { key: 'rewards', label: tx('ჯილდოები', 'Rewards') }];
export function QuestHubView(p: QuestHubViewProps) {
  const c = useThemeColors(), dark = useIsDark(), insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [guide, setGuide] = useState(false);
  const ink = c.primary100;
  const profile = p.dashboard?.profile;
  const daily = orderedMissions(p.dashboard?.daily.quests ?? []), weekly = orderedMissions(p.dashboard?.weekly.quests ?? []);
  const unavailable = Boolean(p.dashboard?.unavailable || (p.dashboard && !profile));
  const setupSteps = ![...daily, ...weekly].some(q => q.progressType === 'STEPS');
  const setupWater = !daily.some(q => q.progressType === 'HYDRATION_GOAL_PERCENT');
  const open = p.onNavigate;
  // Links into a module an admin paused (admin „მოდულები“) are left out; the missions themselves stay.
  const features = useFeatureState();
  const can = (href: string) => isHrefAvailable(href, features);
  const card = (quest: QuestItem, weeklyCard = false) => <View key={quest.id} style={{ gap: 8 }}>
    <QuestCard quest={quest} weekly={weeklyCard} offline={p.offline || p.stale} claiming={p.claimingId === quest.id} claimDisabled={Boolean(p.claimingId)} onClaim={() => p.onClaim(quest.id)} onOpenMedi={can('/assistant') ? () => open('/assistant?mode=doctor') : undefined}
      contextHint={p.contextFor?.(quest)} whyTargetLabel={p.whyLabel?.(quest)} onWhyTarget={() => p.onWhy?.(quest)}
      action={quest.status === 'ACTIVE' && quest.progressType === 'STEPS' && can('/health-metrics/steps') ? { label: tx('ნაბიჯების ნახვა', 'View steps'), onPress: () => open('/health-metrics/steps') } : quest.status === 'ACTIVE' && quest.progressType === 'HYDRATION_GOAL_PERCENT' && can('/health-metrics/hydration') ? { label: tx('წყლის ჩაწერა', 'Log water'), onPress: () => open('/health-metrics/hydration') } : undefined} />
    {p.claimError?.id === quest.id ? <QNotice text={p.claimError.message} danger /> : null}
  </View>;
  const companionBody = (content: React.ReactNode) => p.companion ? <View style={{ gap: 12 }}>
    {p.companionStale || p.companionError ? <QNotice text={tx('პროგრესის ბოლო შენახულ ვერსიას ხედავ.', 'You’re seeing the last saved progress.')} action={tx('განახლება', 'Refresh')} onPress={p.onCompanionRetry} /> : null}{content}
  </View> : p.companionLoading ? <View style={{ gap: 12 }}><Bone height={210} radius={24} /><Bone height={110} radius={24} /></View> : <QCard><QText bold>{tx('პროგრესი ვერ ჩაიტვირთა', 'Couldn’t load progress')}</QText><QText muted>{tx('მისიების შესრულება შეგიძლია გააგრძელო. შენი პროგრესი ანგარიშზე ინახება.', 'You can keep completing missions. Your progress is saved to your account.')}</QText><QButton secondary label={tx('ხელახლა ცდა', 'Try again')} onPress={p.onCompanionRetry} /></QCard>;

  return <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top }}>
    {/* The standard MEDI module header (owner 2026-10-04), pinned with the tabs under it. */}
    <ModuleHeader module="quest" subtitle={tx('მისიები, პროგრესი და ჯილდოები', 'Missions, progress and rewards')} onBack={p.onBack} style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 }}
      right={<ModuleHeaderButton label={tx('როგორ მუშაობს MEDIQUEST', 'How MEDIQUEST works')} icon={CircleHelp} onPress={() => setGuide(true)} />} />
    <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 2, marginBottom: 8, padding: 4, borderRadius: 19, backgroundColor: c.surfaceRaised }}>
      {TABS.map(tab => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: p.tab === tab.key }} onPress={() => { p.onTab(tab.key); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={{ flex: 1, minHeight: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: p.tab === tab.key ? c.surface : 'transparent', borderWidth: p.tab === tab.key ? 1 : 0, borderColor: c.bg300 }}><QText bold size={13} color={p.tab === tab.key ? ink : c.text200}>{tab.label}</QText></Pressable>)}
    </View>
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 28, gap: 20 }} refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={c.primary200} />}>
      {p.offline || p.stale ? <QNotice text={p.offline ? tx('ოფლაინი · ბოლო შენახული მონაცემები', 'Offline · last saved data') : tx('მონაცემები ვერ განახლდა · შენახული ვერსია', 'Couldn’t refresh · saved version')} action={p.offline ? undefined : tx('განახლება', 'Refresh')} onPress={p.onRefresh} /> : null}
      {p.loading && !p.dashboard ? <><Bone height={230} radius={24} /><Bone height={140} radius={24} /><Bone height={140} radius={24} /></> : p.error && !p.dashboard || unavailable ? <QCard>
        <Sparkles size={30} color={ink} /><QText size={20} bold>{unavailable ? tx('მისიები დროებით მიუწვდომელია', 'Missions are temporarily unavailable') : tx('MEDIQUEST ვერ ჩაიტვირთა', 'Couldn’t load MEDIQUEST')}</QText><QText muted>{tx('სცადე გვერდის განახლება. შენი დაგროვილი მონაცემები ანგარიშზე რჩება.', 'Try refreshing the page. Everything you’ve earned stays on your account.')}</QText><QButton label={tx('ხელახლა ცდა', 'Try again')} onPress={p.onRefresh} /><QButton secondary label={tx('როგორ მუშაობს?', 'How does it work?')} onPress={() => setGuide(true)} />
      </QCard> : p.dashboard ? <>
        {p.tab === 'missions' ? <>
          <View style={{ gap: 4 }}><QText size={25} bold>{tx('პატარა ნაბიჯები.\nშენი დიდი პროგრესი.', 'Small steps.\nBig progress.')}</QText><QText size={13} muted>{tx('შეასრულე მისია, მიიღე ჯილდო და გახსენი ახალი ეტაპი.', 'Complete a mission, collect your reward and unlock the next stage.')}</QText></View>
          {profile ? <QCard style={{ borderColor: p.questStyle ? '#B87400' : c.bg300 }}>
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
              <QuestLevelRing percent={levelRingProgress(profile).percent} label={String(profile.level)} caption={tx('დონე', 'Level')} size={96} accessibilityLabel={tx(`დონე ${profile.level}`, `Level ${profile.level}`)} />
              <View style={{ flex: 1, gap: 3 }}><QText size={19} bold>{rankLabel(profile.rankKey, appLang())}</QText><QText size={12} muted>{profile.totalXp.toLocaleString()} {tx('XP დაგროვილია', 'XP earned')}</QText><QText size={12} color={ink}>{levelRingProgress(profile).remaining != null ? tx(`შემდეგ დონემდე ${levelRingProgress(profile).remaining} XP`, `${levelRingProgress(profile).remaining} XP to the next level`) : tx('უმაღლესი დონე მიღწეულია', 'Top level reached')}</QText></View>
            </View>
            <View style={{ height: 1, backgroundColor: c.bg300, marginVertical: 2 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={tx('მონეტები და ჯილდოები', 'Coins and rewards')} onPress={() => { p.onTab('rewards'); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={{ flex: 1, gap: 3, minHeight: 62, justifyContent: 'center' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><QuestCoinMark size={17} /><QText size={20} bold>{profile.coinBalance.toLocaleString()}</QText></View><QText size={11} muted>{tx('Medi Coins · ჯილდოებისთვის', 'Medi Coins · for rewards')}</QText></Pressable>
              <View style={{ width: 1, backgroundColor: c.bg300 }} />
              <Pressable accessibilityRole="button" accessibilityLabel={tx('როგორ მუშაობს სერია', 'How streaks work')} onPress={() => setGuide(true)} style={{ flex: 1, gap: 3, minHeight: 62, paddingLeft: 12, justifyContent: 'center' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><QuestArt source={QUEST_STREAK_ART} size={20} /><QText size={20} bold>{tx(`${profile.currentStreak} დღე`, `${profile.currentStreak} ${profile.currentStreak === 1 ? 'day' : 'days'}`)}</QText></View><QText size={11} muted>{tx('სერია · თითო დღიური მისია', 'Streak · one daily mission a day')}</QText></Pressable>
            </View>
          </QCard> : null}
          {p.dashboard.summary.unclaimedRewards > 0 ? <QNotice text={tx(`${p.dashboard.summary.unclaimedRewards} მისიის ჯილდო მზადაა — მიიღე ბარათიდან ქვემოთ.`, `${p.dashboard.summary.unclaimedRewards} mission ${p.dashboard.summary.unclaimedRewards === 1 ? 'reward is' : 'rewards are'} ready — collect ${p.dashboard.summary.unclaimedRewards === 1 ? 'it' : 'them'} from the card below.`)} /> : null}
          <View style={{ gap: 12 }}>
            <QHeading title={tx('დღის მისიები', 'Daily missions')} meta={tx(`${p.dashboard.summary.dailyCompleted} / ${p.dashboard.summary.dailyTotal} შესრულდა`, `${p.dashboard.summary.dailyCompleted} / ${p.dashboard.summary.dailyTotal} done`)} />
            {daily.length ? <QuestProgressBar percent={p.dashboard.summary.dailyTotal ? p.dashboard.summary.dailyCompleted / p.dashboard.summary.dailyTotal * 100 : 0} height={5} /> : <QNotice text={tx('დღიური მისიები ჯერ არ არის. შეამოწმე აქტივობისა და ჰიდრატაციის პარამეტრები ქვემოთ.', 'No daily missions yet. Check your activity and hydration settings below.')} />}
            {daily.map(q => card(q))}
          </View>
          {weekly.length ? <View style={{ gap: 12 }}><QHeading title={tx('კვირის გამოწვევა', 'Weekly challenge')} meta={tx('ორშაბათი — კვირა', 'Monday — Sunday')} />{weekly.map(q => card(q, true))}</View> : null}
          {setupSteps ? <QLink title={tx('ნაბიჯები დაუკავშირე', 'Connect your steps')} body={tx('შეამოწმე ჯანმრთელობის აპის წვდომა მოძრაობის მისიებისთვის.', 'Check health app access for movement missions.')} art={QUEST_STEPS_ART} onPress={() => open('/profile/permissions')} /> : null}
          {setupWater && can('/health-metrics/hydration') ? <QLink title={tx('წყლის მიზანი დააყენე', 'Set a water goal')} body={tx('შენი დღიური მიზანი ჰიდრატაციის მისიას გახსნის.', 'Your daily goal unlocks the hydration mission.')} art={QUEST_ART.hydration} onPress={() => open('/health-metrics/hydration')} /> : null}
          {can('/profile/invite') ? <QLink title={tx('მოიწვიე ოჯახის წევრი', 'Invite a family member')} body={tx('პირველი ჩანაწერის შემდეგ ორივე მიიღებთ 100 Medi მონეტას.', 'After their first entry, you both get 100 Medi Coins.')} art={QUEST_GIFT_ART} onPress={() => open('/profile/invite')} /> : null}
          <QLink title={tx('ნახე, როგორ ვითარდები', 'See how you’re growing')} body={tx('ეტაპები და კოლექცია — შენი შესრულებული მისიებიდან.', 'Stages and collection — built from the missions you’ve completed.')} art={QUEST_TROPHY_ART} onPress={() => { p.onTab('progress'); scroll.current?.scrollTo({ y: 0, animated: false }); }} />
        </> : p.tab === 'progress' ? <>
          <View><QText size={25} bold>{tx('ყოველი მისია წინ გწევს.', 'Every mission moves you forward.')}</QText><QText size={13} muted>{tx('შენი ეტაპები, სერია და მიღწევები ერთ გზაზე.', 'Your stages, streak and achievements on one path.')}</QText></View>
          {companionBody(p.companion ? <QuestJourneyPanel overview={p.companion} onGuide={() => setGuide(true)} /> : null)}
          {profile ? <QCard><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><QuestArt source={QUEST_STREAK_ART} size={25} /><QText bold>{tx('შენი სერია', 'Your streak')}</QText></View><QText muted>{isEn() ? `Now ${profile.currentStreak} ${profile.currentStreak === 1 ? 'day' : 'days'} · best ${profile.longestStreak} ${profile.longestStreak === 1 ? 'day' : 'days'}` : `ახლა ${profile.currentStreak} დღე · საუკეთესო ${profile.longestStreak} დღე`}</QText><QText size={12} muted>{tx('ყოველ დღე ერთი დღიური მისიის შესრულება მაინც აგრძელებს სერიას.', 'Completing at least one daily mission each day keeps your streak going.')}</QText></QCard> : null}
          <QLink title={tx('ჩემი მიღწევები', 'My achievements')} body={tx('ნახე გახსნილი ნიშნები და მისაღები ჯილდოები.', 'See unlocked badges and rewards to collect.')} art={QUEST_TROPHY_ART} onPress={() => open('/medi-quest/achievements')} />
          <QLink title={tx('მისიების ისტორია', 'Mission history')} body={tx('შესრულებული, მიღებული და დასრულებული მისიები.', 'Completed, collected and ended missions.')} art={QUEST_ART.history} onPress={() => open('/medi-quest/history')} />
        </> : <>
          <View><QText size={25} bold>{tx('შენი შრომის შედეგი.', 'The fruit of your effort.')}</QText><QText size={13} muted>{tx('მონეტები გამოიყენე ჯილდოებისთვის, კოლექციით კი შენი ნიშანი გააფორმე.', 'Spend coins on rewards and style your badge with your collection.')}</QText></View>
          {/* The violet Medi Coins card — the same one the store and the wallet open with. */}
          <QuestWalletCard balance={profile?.coinBalance ?? 0} loading={!profile} caption={tx('ხელმისაწვდომი ბალანსი', 'Available balance')} action={{ label: tx('ჯილდოების მაღაზია', 'Rewards store'), onPress: () => open('/medi-quest/rewards') }} />
          <QLink title={tx('ბალანსის ისტორია', 'Balance history')} body={tx('საიდან მიიღე და რაში გამოიყენე მონეტები.', 'Where your coins came from and what you spent them on.')} art={QUEST_ART.wallet} onPress={() => open('/medi-quest/wallet')} />
          {companionBody(p.companion ? <QuestCollectionPanel overview={p.companion} onEquip={p.onEquip} busyKey={p.equipBusy} error={p.equipError} offline={p.offline || p.companionStale} /> : null)}
        </>}
        <Pressable accessibilityRole="button" onPress={() => setGuide(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48 }}><CircleHelp size={17} color={ink} /><QText bold size={13} color={ink}>{tx('როგორ მუშაობს MEDIQUEST?', 'How does MEDIQUEST work?')}</QText></Pressable>
      </> : null}
    </ScrollView>
    <QuestGuideSheet visible={guide} onClose={() => setGuide(false)} timezone={p.dashboard?.daily.timezone ?? profile?.timezone} />
  </View>;
}
