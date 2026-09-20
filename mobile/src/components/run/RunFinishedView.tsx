import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Check, Flag, Flame, Footprints, Gauge, MapPin, Route, Timer } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RunMap, type RunMapHandle } from './RunMap';
import { MediRunLogo } from './PulseIdentity';
import { Card, Copy } from './PulseUi';
import { formatClock, formatKm, formatPace, formatThousands } from '@/lib/run/geo';
import { targetLabel } from '@/lib/run/labels';
import { formatRunDate } from '@/lib/run/presentation';
import type { RunSummary } from '@/lib/run/history';
import { useThemeColors } from '@/theme/colors';

type Props = { summary: RunSummary; title: string; headerLeft?: ReactNode; footer?: ReactNode };

export function RunFinishedView({ summary, title, headerLeft, footer }: Props) {
  const c = useThemeColors(), insets = useSafeAreaInsets();
  const map = useRef<RunMapHandle>(null);
  const [mapReady, setMapReady] = useState(false);
  const pct = summary.targetMeters > 0 ? Math.min(100, Math.round(summary.distanceM / summary.targetMeters * 100)) : 0;
  const mapCenter = summary.origin ?? summary.pin ?? summary.path[0] ?? null;

  useEffect(() => {
    if (!mapReady || !mapCenter) return;
    map.current?.send({ type: 'init', origin: mapCenter, pin: summary.pin, route: null, radiusM: 28, fit: false });
    const segments = summary.segments || [summary.path];
    map.current?.send({ type: 'paint', lines: segments.map(segment => segment.map(pt => [pt.lng, pt.lat] as [number, number])) });
    map.current?.send({ type: 'options', rotate: false, threeD: false });
    if (summary.reachedPin) map.current?.send({ type: 'reached' });
    const timer = setTimeout(() => map.current?.send({ type: 'fit', top: 36, bottom: 42, paintOnly: true }), 250);
    return () => clearTimeout(timer);
  }, [mapReady, mapCenter, summary]);

  const stats = [
    { icon: Timer, value: formatClock(summary.movingMs), label: 'აქტიური დრო' },
    { icon: Gauge, value: formatPace(summary.paceSecPerKm), label: 'ტემპი · წთ/კმ' },
    { icon: Footprints, value: formatThousands(summary.steps), label: 'სავარაუდო ნაბიჯები' },
    { icon: Flame, value: String(summary.calories), label: 'სავარაუდო კკალ' },
  ];

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: Math.max(24, insets.bottom + 12), paddingHorizontal: 20, gap: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {headerLeft}
      <View style={{ flex: 1, gap: 2 }}><MediRunLogo size={23} /><Copy muted size={11}>ყოველი გზა შენი ისტორიაა</Copy></View>
      <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Check size={21} color={c.primary100} /></View>
    </View>

    <View style={{ gap: 5 }}><Copy bold size={25} style={{ lineHeight: 35 }}>{title}</Copy><Copy muted size={12}>{formatRunDate(summary.startedAt)} · {summary.targetMeters === 0 ? 'თავისუფალი გასეირნება' : targetLabel(summary.target)}</Copy></View>

    <Card style={{ padding: 0, borderRadius: 28, overflow: 'hidden', gap: 0 }}>
      <View style={{ padding: 20, paddingBottom: 17, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Route size={16} color={c.primary100} /><Copy size={12} muted>შენი გავლილი გზა</Copy></View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}><Copy bold size={46} style={{ lineHeight: 61, letterSpacing: -1.5, fontVariant: ['tabular-nums'], flexShrink: 1 }}>{formatKm(summary.distanceM)}</Copy><Copy bold size={17} style={{ color: c.primary100 }}>კმ</Copy></View>
      </View>
      <View style={{ height: 240, backgroundColor: c.bg200 }}>
        {mapCenter ? <RunMap ref={map} center={mapCenter} onReady={() => setMapReady(true)} /> : <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 }}><MapPin size={28} color={c.primary100} /><Copy muted size={12}>ამ ჩანაწერს მარშრუტი არ ახლავს</Copy></View>}
      </View>
    </Card>

    <View style={{ gap: 10 }}><Copy bold size={16}>გასეირნება რიცხვებში</Copy><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {stats.map(stat => <Card key={stat.label} style={{ flexBasis: '46%', flexGrow: 1, padding: 15, borderRadius: 21, gap: 6 }}><stat.icon size={18} color={c.primary100} /><Copy bold size={23} style={{ lineHeight: 32, fontVariant: ['tabular-nums'] }}>{stat.value}</Copy><Copy size={10} muted>{stat.label}</Copy></Card>)}
    </View></View>

    {summary.targetMeters > 0 ? <Card style={{ gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Flag color={c.primary100} size={20} /><View style={{ flex: 1 }}><Copy bold size={14}>{summary.completedTarget ? 'მიზანი შესრულებულია' : 'ყოველი ნაბიჯი წინსვლაა'}</Copy><Copy muted size={12}>{targetLabel(summary.target)}</Copy></View><Copy bold size={22} style={{ color: c.primary100 }}>{pct}%</Copy></View><View accessibilityRole="progressbar" accessibilityLabel="ვარჯიშის მიზანი" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 5, backgroundColor: c.bg200, borderRadius: 5, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: 5, backgroundColor: '#14B8A6' }} /></View></Card> : null}

    {summary.pin ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><MapPin size={17} color={c.primary100} /><Copy muted size={12} style={{ flex: 1 }}>{summary.reachedPin ? 'დანიშნულების ადგილს მიაღწიე' : 'დანიშნულების ადგილამდე ამ სესიაში ვერ მიხვედი'}</Copy></View> : null}
    <Copy muted size={11}>ნაბიჯები და კალორია შეფასებითია. შეინარჩუნე შენთვის კომფორტული ტემპი.</Copy>
    {footer}
  </ScrollView>;
}
