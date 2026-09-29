import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Check, Compass, Footprints, Gift, Globe2, Route, Timer, Trees } from 'lucide-react-native';
import { usePulse } from '@/lib/medipulsi/client';
import { parkProgress, PARK_SHARE } from '@/lib/medipulsi/core/journey';
import { useThemeColors } from '@/theme/colors';
import { formatRunDate } from '@/lib/run/presentation';
import { Card, Copy } from './PulseUi';
import { tx } from '@/i18n/locale';

type Section = 'walks' | 'stamps' | 'gifts';

export function PulseCollection({ view }: { view: ReturnType<typeof usePulse> }) {
  const c = useThemeColors();
  const [section, setSection] = useState<Section>('walks');
  const snapshot = view.snapshot;
  if (!snapshot) return <Card><ActivityIndicator color={c.primary100} /><Copy muted>{tx('შენი აღმოჩენები იტვირთება…', 'Loading your finds…')}</Copy></Card>;

  const walks = snapshot.history;
  const stamps = snapshot.missions.filter(m => view.book.progress[m.id]?.completedAt);
  const kilometers = walks.reduce((sum, session) => sum + session.meters, 0) / 1000;
  const park = parkProgress(view.journey);
  const tabs = [
    { id: 'walks' as const, label: tx('გასეირნებები', 'Walks'), icon: Route, count: walks.length },
    { id: 'stamps' as const, label: tx('შტამპები', 'Stamps'), icon: Compass, count: stamps.length },
    { id: 'gifts' as const, label: tx('საჩუქრები', 'Gifts'), icon: Gift, count: snapshot.claims.length },
  ];

  return <>
    <Card style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Globe2 color={c.primary100} size={23} /></View><View style={{ flex: 1 }}><Copy bold size={17}>{tx('შენი პირადი ატლასი', 'Your personal atlas')}</Copy><Copy muted size={11}>{tx('ყველა ქალაქი · ერთი ისტორია', 'Every city · one story')}</Copy></View></View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}><Copy bold size={42} style={{ lineHeight: 56, letterSpacing: -1.3, fontVariant: ['tabular-nums'], flexShrink: 1 }}>{kilometers.toFixed(1)}</Copy><Copy bold style={{ color: c.primary100 }}>{tx('კმ', 'km')}</Copy></View>
      <Copy muted size={12}>{tx('შენახული გასეირნებების მანძილი. შენი გზები MEDICARD ანგარიშთან ერთად ინახება.', 'Distance of your saved walks. Your paths are saved with your MEDICARD account.')}</Copy>
    </Card>

    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 7 }}>
      {tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={`${tab.label}: ${tab.count}`} accessibilityState={{ selected: section === tab.id }} onPress={() => setSection(tab.id)} style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 3, borderRadius: 18, backgroundColor: section === tab.id ? c.accent100 : c.surface, alignItems: 'center', gap: 7 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><tab.icon size={17} color={c.primary100} /><Copy bold size={14}>{tab.count}</Copy></View><Copy size={10} bold>{tab.label}</Copy></Pressable>)}
    </View>

    {section === 'walks' ? <View style={{ gap: 11 }}>
      {!walks.length ? <Card style={{ padding: 24, gap: 12 }}><Footprints color={c.primary100} size={28} /><Copy bold size={18}>{tx('პირველი გზა წინ არის', 'Your first path is ahead')}</Copy><Copy muted>{tx('დაიწყე გასეირნება იქ, სადაც ხარ. დასრულების შემდეგ შენი მანძილი და დრო აქ გამოჩნდება.', 'Start a walk wherever you are. When you finish, your distance and time will show up here.')}</Copy></Card> : walks.map(session => <Card key={session.id} style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 41, height: 41, borderRadius: 15, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Route size={19} color={c.primary100} /></View><View style={{ flex: 1 }}><Copy bold size={22} style={{ fontVariant: ['tabular-nums'] }}>{(session.meters / 1000).toFixed(2)} {tx('კმ', 'km')}</Copy><Copy muted size={11}>{formatRunDate(session.startedAt)}</Copy></View><Check size={16} color={c.primary100} /></View>
        <View style={{ borderTopWidth: 1, borderColor: c.bg300, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Timer size={14} color={c.primary100} /><Copy muted size={11}>{Math.floor(session.seconds / 60)} {tx('წთ', 'min')}</Copy></View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Footprints size={14} color={c.primary100} /><Copy muted size={11}>≈ {Math.round(session.steps).toLocaleString()} {tx('ნაბიჯი', 'steps')}</Copy></View></View>
      </Card>)}
    </View> : null}

    {section === 'stamps' ? <View style={{ gap: 14 }}>
      <View style={{ gap: 3 }}><Copy bold size={17}>{tx('თბილისის პასპორტი', 'Tbilisi passport')}</Copy><Copy muted size={12}>{stamps.length} / {snapshot.missions.length} {tx('აღმოჩენილი ადგილი', 'places found')}</Copy></View>
      {!stamps.length ? <Card><Compass color={c.primary100} size={28} /><Copy bold size={18}>{tx('ქალაქს შენი შტამპი აკლია', 'The city is missing your stamp')}</Copy><Copy muted>{tx('თბილისის პასპორტში აირჩიე მისია. მისი ზონის გავლით და მიზნის შესრულებით აქ პირადი შტამპი დაგემატება.', 'Pick a mission in your Tbilisi passport. Walk through its zone and reach the goal to add a personal stamp here.')}</Copy></Card> : stamps.map(mission => <Card key={mission.id} style={{ backgroundColor: c.accent100, gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 45, height: 45, borderRadius: 23, borderWidth: 1, borderStyle: 'dashed', borderColor: c.primary100, alignItems: 'center', justifyContent: 'center' }}><Check size={22} color={c.primary100} /></View><View style={{ flex: 1 }}><Copy bold size={17}>{mission.name}</Copy><Copy muted size={11}>{tx('შტამპი შენია', 'The stamp is yours')}</Copy></View></View><Copy muted size={12}>{mission.title}</Copy></Card>)}
      <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Trees size={21} color={c.primary100} /><Copy bold style={{ flex: 1 }}>{tx('ვაკის პარკის ბილიკები', 'Vake Park paths')}</Copy><Copy bold style={{ color: c.primary100 }}>{park.percent.toFixed(1)}%</Copy></View><View accessibilityRole="progressbar" accessibilityLabel={tx('ვაკის პარკის უნიკალური ბილიკები', 'Unique Vake Park paths')} accessibilityValue={{ min: 0, max: 100, now: park.percent }} style={{ height: 5, backgroundColor: c.bg200, borderRadius: 5, overflow: 'hidden' }}><View style={{ width: `${park.percent}%`, height: 5, backgroundColor: '#14B8A6' }} /></View><Copy muted size={12}>{park.complete ? tx('პარკი გახსნილია — შეგიძლია დარჩენილი გზებიც აღმოაჩინო.', 'Park unlocked — you can still discover the remaining paths.') : tx('გაიარე უნიკალური ბილიკების 85%, რომ პარკი გახსნა.', 'Walk 85% of the unique paths to unlock the park.')}</Copy><Copy muted size={10}>{tx('პარკის ფართობი ვაკის საცდელი საზღვრის დაახლოებით', 'The park covers about')} {PARK_SHARE.toFixed(1)}{tx('%-ია. ეს გავლილი ვაკის პროცენტს არ ნიშნავს.', '% of the Vake trial area. It isn’t the share of Vake you’ve walked.')}</Copy></Card>
    </View> : null}

    {section === 'gifts' ? <View style={{ gap: 12 }}>
      {!snapshot.claims.length ? <Card style={{ padding: 24 }}><Gift color={c.primary100} size={28} /><Copy bold size={18}>{tx('მოუსმინე შემდეგ აღმოჩენას', 'Listen for the next find')}</Copy><Copy muted>{tx('საჩუქარი წინასწარ არ ჩანს. როცა მას მიუახლოვდები, პულსი მიგანიშნებს. მიღებული საჩუქრები აქ შეგინახება.', 'Gifts are hidden until you get close — the pulse will guide you. Gifts you receive are saved here.')}</Copy></Card> : snapshot.claims.map(claim => <Card key={claim.id} style={{ gap: 14 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 45, height: 45, borderRadius: 16, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Gift size={23} color={c.primary100} /></View><Copy bold size={17} style={{ flex: 1 }}>{claim.reward.title}</Copy></View><View style={{ alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: c.bg200 }}><Copy size={11} bold style={{ color: claim.status === 'REJECTED' ? c.danger : c.primary100 }}>{claim.status === 'PENDING' ? tx('დადასტურებას ელოდება', 'Awaiting confirmation') : claim.status === 'APPROVED' ? tx('დადასტურებულია', 'Confirmed') : claim.status === 'FULFILLED' ? tx('გადმოცემულია', 'Handed over') : tx('არ დადასტურდა', 'Not confirmed')}</Copy></View>{claim.reward.description ? <Copy muted size={12}>{claim.reward.description}</Copy> : null}<View style={{ borderTopWidth: 1, borderColor: c.bg300, paddingTop: 10, gap: 2 }}><Copy muted size={10}>{tx('საჩუქრის კოდი', 'Gift code')}</Copy><Copy bold size={13}>{claim.code}</Copy></View></Card>)}
    </View> : null}
  </>;
}
