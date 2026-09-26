import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Check, Compass, Footprints, Gift, Globe2, Route, Timer, Trees } from 'lucide-react-native';
import { usePulse } from '@/lib/medipulsi/client';
import { parkProgress, PARK_SHARE } from '@/lib/medipulsi/core/journey';
import { useThemeColors } from '@/theme/colors';
import { formatRunDate } from '@/lib/run/presentation';
import { Card, Copy } from './PulseUi';

type Section = 'walks' | 'stamps' | 'gifts';

export function PulseCollection({ view }: { view: ReturnType<typeof usePulse> }) {
  const c = useThemeColors();
  const [section, setSection] = useState<Section>('walks');
  const snapshot = view.snapshot;
  if (!snapshot) return <Card><ActivityIndicator color={c.primary100} /><Copy muted>შენი აღმოჩენები იტვირთება…</Copy></Card>;

  const walks = snapshot.history;
  const stamps = snapshot.missions.filter(m => view.book.progress[m.id]?.completedAt);
  const kilometers = walks.reduce((sum, session) => sum + session.meters, 0) / 1000;
  const park = parkProgress(view.journey);
  const tabs = [
    { id: 'walks' as const, label: 'გასეირნებები', icon: Route, count: walks.length },
    { id: 'stamps' as const, label: 'შტამპები', icon: Compass, count: stamps.length },
    { id: 'gifts' as const, label: 'საჩუქრები', icon: Gift, count: snapshot.claims.length },
  ];

  return <>
    <Card style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Globe2 color={c.primary100} size={23} /></View><View style={{ flex: 1 }}><Copy bold size={17}>შენი პირადი ატლასი</Copy><Copy muted size={11}>ყველა ქალაქი · ერთი ისტორია</Copy></View></View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}><Copy bold size={42} style={{ lineHeight: 56, letterSpacing: -1.3, fontVariant: ['tabular-nums'], flexShrink: 1 }}>{kilometers.toFixed(1)}</Copy><Copy bold style={{ color: c.primary100 }}>კმ</Copy></View>
      <Copy muted size={12}>შენახული გასეირნებების მანძილი. შენი გზები MEDICARD ანგარიშთან ერთად ინახება.</Copy>
    </Card>

    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 7 }}>
      {tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={`${tab.label}: ${tab.count}`} accessibilityState={{ selected: section === tab.id }} onPress={() => setSection(tab.id)} style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 3, borderRadius: 18, backgroundColor: section === tab.id ? c.accent100 : c.surface, alignItems: 'center', gap: 7 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><tab.icon size={17} color={c.primary100} /><Copy bold size={14}>{tab.count}</Copy></View><Copy size={10} bold>{tab.label}</Copy></Pressable>)}
    </View>

    {section === 'walks' ? <View style={{ gap: 11 }}>
      {!walks.length ? <Card style={{ padding: 24, gap: 12 }}><Footprints color={c.primary100} size={28} /><Copy bold size={18}>პირველი გზა წინ არის</Copy><Copy muted>დაიწყე გასეირნება იქ, სადაც ხარ. დასრულების შემდეგ შენი მანძილი და დრო აქ გამოჩნდება.</Copy></Card> : walks.map(session => <Card key={session.id} style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 41, height: 41, borderRadius: 15, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Route size={19} color={c.primary100} /></View><View style={{ flex: 1 }}><Copy bold size={22} style={{ fontVariant: ['tabular-nums'] }}>{(session.meters / 1000).toFixed(2)} კმ</Copy><Copy muted size={11}>{formatRunDate(session.startedAt)}</Copy></View><Check size={16} color={c.primary100} /></View>
        <View style={{ borderTopWidth: 1, borderColor: c.bg300, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Timer size={14} color={c.primary100} /><Copy muted size={11}>{Math.floor(session.seconds / 60)} წთ</Copy></View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Footprints size={14} color={c.primary100} /><Copy muted size={11}>≈ {Math.round(session.steps).toLocaleString()} ნაბიჯი</Copy></View></View>
      </Card>)}
    </View> : null}

    {section === 'stamps' ? <View style={{ gap: 14 }}>
      <View style={{ gap: 3 }}><Copy bold size={17}>თბილისის პასპორტი</Copy><Copy muted size={12}>{stamps.length} / {snapshot.missions.length} აღმოჩენილი ადგილი</Copy></View>
      {!stamps.length ? <Card><Compass color={c.primary100} size={28} /><Copy bold size={18}>ქალაქს შენი შტამპი აკლია</Copy><Copy muted>თბილისის პასპორტში აირჩიე მისია. მისი ზონის გავლით და მიზნის შესრულებით აქ პირადი შტამპი დაგემატება.</Copy></Card> : stamps.map(mission => <Card key={mission.id} style={{ backgroundColor: c.accent100, gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 45, height: 45, borderRadius: 23, borderWidth: 1, borderStyle: 'dashed', borderColor: c.primary100, alignItems: 'center', justifyContent: 'center' }}><Check size={22} color={c.primary100} /></View><View style={{ flex: 1 }}><Copy bold size={17}>{mission.name}</Copy><Copy muted size={11}>შტამპი შენია</Copy></View></View><Copy muted size={12}>{mission.title}</Copy></Card>)}
      <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Trees size={21} color={c.primary100} /><Copy bold style={{ flex: 1 }}>ვაკის პარკის ბილიკები</Copy><Copy bold style={{ color: c.primary100 }}>{park.percent.toFixed(1)}%</Copy></View><View accessibilityRole="progressbar" accessibilityLabel="ვაკის პარკის უნიკალური ბილიკები" accessibilityValue={{ min: 0, max: 100, now: park.percent }} style={{ height: 5, backgroundColor: c.bg200, borderRadius: 5, overflow: 'hidden' }}><View style={{ width: `${park.percent}%`, height: 5, backgroundColor: '#14B8A6' }} /></View><Copy muted size={12}>{park.complete ? 'პარკი გახსნილია — შეგიძლია დარჩენილი გზებიც აღმოაჩინო.' : 'გაიარე უნიკალური ბილიკების 85%, რომ პარკი გახსნა.'}</Copy><Copy muted size={10}>პარკის ფართობი ვაკის საცდელი საზღვრის დაახლოებით {PARK_SHARE.toFixed(1)}%-ია. ეს გავლილი ვაკის პროცენტს არ ნიშნავს.</Copy></Card>
    </View> : null}

    {section === 'gifts' ? <View style={{ gap: 12 }}>
      {!snapshot.claims.length ? <Card style={{ padding: 24 }}><Gift color={c.primary100} size={28} /><Copy bold size={18}>მოუსმინე შემდეგ აღმოჩენას</Copy><Copy muted>საჩუქარი წინასწარ არ ჩანს. როცა მას მიუახლოვდები, პულსი მიგანიშნებს. მიღებული საჩუქრები აქ შეგინახება.</Copy></Card> : snapshot.claims.map(claim => <Card key={claim.id} style={{ gap: 14 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 45, height: 45, borderRadius: 16, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Gift size={23} color={c.primary100} /></View><Copy bold size={17} style={{ flex: 1 }}>{claim.reward.title}</Copy></View><View style={{ alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: c.bg200 }}><Copy size={11} bold style={{ color: claim.status === 'REJECTED' ? c.danger : c.primary100 }}>{claim.status === 'PENDING' ? 'დადასტურებას ელოდება' : claim.status === 'APPROVED' ? 'დადასტურებულია' : claim.status === 'FULFILLED' ? 'გადმოცემულია' : 'არ დადასტურდა'}</Copy></View>{claim.reward.description ? <Copy muted size={12}>{claim.reward.description}</Copy> : null}<View style={{ borderTopWidth: 1, borderColor: c.bg300, paddingTop: 10, gap: 2 }}><Copy muted size={10}>საჩუქრის კოდი</Copy><Copy bold size={13}>{claim.code}</Copy></View></Card>)}
    </View> : null}
  </>;
}
