import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { Award, Flag, Flame, Footprints, Gauge, MapPin, Share2, Timer, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RunMap, type RunMapHandle } from './RunMap';
import { MediRunLogo } from './PulseIdentity';
import { Bar, Card, Copy, RUN_TEAL, Section, Tile } from './PulseUi';
import { SplitBars } from './RunVisuals';
import { formatClock, formatKm, formatPace, formatThousands } from '@/lib/run/geo';
import { recordsSetBy, type RecordKind } from '@/lib/run/insights';
import { targetLabel } from '@/lib/run/labels';
import { formatRunDate } from '@/lib/run/presentation';
import { loadRunHistory, type RunSummary } from '@/lib/run/history';
import { useThemeColors } from '@/theme/colors';
import { HUB } from '@/theme/hub';

type Props = { summary: RunSummary; title: string; headerLeft?: ReactNode; footer?: ReactNode };

const RECORD_COPY: Record<RecordKind, string> = { distance: 'ყველაზე გრძელი გასეირნება', pace: 'საუკეთესო ტემპი', time: 'ყველაზე ხანგრძლივი' };

export function RunFinishedView({ summary, title, headerLeft, footer }: Props) {
  const c = useThemeColors(), insets = useSafeAreaInsets();
  const map = useRef<RunMapHandle>(null);
  const [mapReady, setMapReady] = useState(false);
  const [records, setRecords] = useState<RecordKind[]>([]);
  const pct = summary.targetMeters > 0 ? Math.min(100, Math.round(summary.distanceM / summary.targetMeters * 100)) : 0;
  const mapCenter = summary.origin ?? summary.pin ?? summary.path[0] ?? null;
  const avgKmh = summary.movingMs > 0 ? summary.distanceM / 1000 / (summary.movingMs / 3_600_000) : 0;

  useEffect(() => {
    let alive = true;
    // The just-finished walk may not be written yet — include it explicitly.
    void loadRunHistory().then(list => { if (alive) setRecords(recordsSetBy(summary, [summary, ...list.filter(r => r.id !== summary.id && r.startedAt < summary.startedAt)])); });
    return () => { alive = false; };
  }, [summary]);

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

  const share = () => {
    const lines = [
      `MEDIRUN · ${formatRunDate(summary.startedAt)}`,
      `${formatKm(summary.distanceM)} კმ · ${formatClock(summary.movingMs)} · ${formatPace(summary.paceSecPerKm)} /კმ`,
      records.length ? `🏅 ${records.map(r => RECORD_COPY[r]).join(', ')}` : '',
      'ყოველი გზა შენი ისტორიაა — medicard.ge',
    ].filter(Boolean);
    void Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const stats = [
    { icon: Timer, value: formatClock(summary.movingMs), label: 'აქტიური დრო' },
    { icon: Gauge, value: formatPace(summary.paceSecPerKm), label: 'ტემპი · წთ/კმ' },
    { icon: Zap, value: avgKmh > 0 ? avgKmh.toFixed(1) : '–', label: 'საშ. სიჩქარე · კმ/სთ' },
    { icon: Footprints, value: formatThousands(summary.steps), label: 'სავარაუდო ნაბიჯები' },
    { icon: Flame, value: String(summary.calories), label: 'სავარაუდო კკალ' },
    { icon: Flag, value: formatClock(summary.elapsedMs), label: 'სულ, პაუზების ჩათვლით' },
  ];

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: Math.max(24, insets.bottom + 12), paddingHorizontal: HUB.gutter, gap: HUB.sectionGap - 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {headerLeft}
      <View style={{ flex: 1, gap: 2 }}><MediRunLogo size={23} /><Copy muted size={11}>ყოველი გზა შენი ისტორიაა</Copy></View>
      <Pressable accessibilityRole="button" accessibilityLabel="გაზიარება" onPress={share} hitSlop={4} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Share2 size={19} color={c.primary100} /></Pressable>
    </View>

    <View style={{ gap: 4 }}><Copy bold size={25} style={{ lineHeight: 35 }}>{title}</Copy><Copy muted size={12}>{formatRunDate(summary.startedAt)} · {summary.targetMeters === 0 ? 'თავისუფალი გასეირნება' : targetLabel(summary.target)}</Copy></View>

    {records.length ? <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: HUB.cardPad, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(251,191,36,0.16)', alignItems: 'center', justifyContent: 'center' }}><Award size={24} color="#FCD34D" /></View>
      <View style={{ flex: 1 }}><Copy bold size={15} style={{ color: '#fff' }}>ახალი პირადი რეკორდი!</Copy><Copy size={12} style={{ color: '#C5DADA' }}>{records.map(r => RECORD_COPY[r]).join(' · ')}</Copy></View>
    </View> : null}

    <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
      <View style={{ padding: 20, paddingBottom: 16, gap: 2 }}>
        <Copy size={12} muted>შენი გავლილი გზა</Copy>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}><Copy bold size={48} style={{ lineHeight: 62, letterSpacing: -1.5, fontVariant: ['tabular-nums'], flexShrink: 1 }}>{formatKm(summary.distanceM)}</Copy><Copy bold size={17} style={{ color: c.primary100 }}>კმ</Copy></View>
      </View>
      <View style={{ height: 250, backgroundColor: c.bg200 }}>
        {mapCenter ? <RunMap ref={map} center={mapCenter} onReady={() => setMapReady(true)} /> : <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 }}><MapPin size={28} color={c.primary100} /><Copy muted size={12}>ამ ჩანაწერს მარშრუტი არ ახლავს</Copy></View>}
      </View>
    </Card>

    <Section title="გასეირნება რიცხვებში"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {stats.map(stat => <Card key={stat.label} style={{ flexBasis: '46%', flexGrow: 1, padding: 15, gap: 8 }}><Tile icon={stat.icon} size={34} /><View><Copy bold size={21} style={{ lineHeight: 29, fontVariant: ['tabular-nums'] }}>{stat.value}</Copy><Copy size={11} muted>{stat.label}</Copy></View></Card>)}
    </View></Section>

    {summary.splits?.some(s => s >= 0) ? <Section title="კილომეტრები"><Card><SplitBars splits={summary.splits} /><Copy muted size={11}>თითოეული სრული კილომეტრის ტემპი (წთ/კმ). ფერადი — ყველაზე სწრაფი.</Copy></Card></Section> : null}

    {summary.targetMeters > 0 ? <Card style={{ gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Tile icon={Flag} ink={summary.completedTarget ? 'green' : 'teal'} /><View style={{ flex: 1 }}><Copy bold size={14}>{summary.completedTarget ? 'მიზანი შესრულებულია' : 'ყოველი ნაბიჯი წინსვლაა'}</Copy><Copy muted size={12}>{targetLabel(summary.target)}</Copy></View><Copy bold size={22} style={{ color: c.primary100 }}>{pct}%</Copy></View><Bar value={pct} color={summary.completedTarget ? c.success : RUN_TEAL} label="ვარჯიშის მიზანი" /></Card> : null}

    {summary.pin ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><MapPin size={17} color={c.primary100} /><Copy muted size={12} style={{ flex: 1 }}>{summary.reachedPin ? 'დანიშნულების ადგილს მიაღწიე' : 'დანიშნულების ადგილამდე ამ სესიაში ვერ მიხვედი'}</Copy></View> : null}
    <Copy muted size={11} style={{ marginTop: -8 }}>ნაბიჯები და კალორია შეფასებითია. შეინარჩუნე შენთვის კომფორტული ტემპი.</Copy>
    {footer}
  </ScrollView>;
}
