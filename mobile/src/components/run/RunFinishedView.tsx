import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { Award, Flag, Flame, Footprints, Gauge, MapPin, Share2, Timer, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { RunMap, type RunMapHandle } from './RunMap';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { Bar, Card, Copy, RUN_TEAL, Section, Tile } from './PulseUi';
import { SplitBars } from './RunVisuals';
import { formatClock, formatKm, formatPace, formatThousands } from '@/lib/run/geo';
import { recordsSetBy, type RecordKind } from '@/lib/run/insights';
import { targetLabel } from '@/lib/run/labels';
import { formatRunDate } from '@/lib/run/presentation';
import { loadRunHistory, type RunSummary } from '@/lib/run/history';
import { useThemeColors } from '@/theme/colors';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';
import { useAuth } from '@/store/AuthContext';
import { joinSegments, thin, trimEnds, type LngLat } from '@/lib/run/shareStudio';
import { ShareStudio, canRecordClips, type ShareSceneInput } from './ShareStudio';

/** `onBack`: where the header's back goes (the summary leaves the finished session; history goes back). */
type Props = { summary: RunSummary; title: string; onBack?: () => void; footer?: ReactNode };

const RECORD_COPY: Record<RecordKind, string> = { distance: tx('ყველაზე გრძელი გასეირნება', 'Longest walk'), pace: tx('საუკეთესო ტემპი', 'Best pace'), time: tx('ყველაზე ხანგრძლივი', 'Longest duration') };

export function RunFinishedView({ summary, title, onBack, footer }: Props) {
  const c = useThemeColors(), insets = useSafeAreaInsets();
  const map = useRef<RunMapHandle>(null);
  const [mapReady, setMapReady] = useState(false);
  const [records, setRecords] = useState<RecordKind[]>([]);
  const [studio, setStudio] = useState(false);
  const { user } = useAuth();
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
    map.current?.send({ type: 'init', origin: mapCenter, pin: summary.pin, route: null, radiusM: 28, fit: false, runner: false });
    const segments = summary.segments || [summary.path];
    map.current?.send({ type: 'paint', lines: segments.map(segment => segment.map(pt => [pt.lng, pt.lat] as [number, number])) });
    map.current?.send({ type: 'options', rotate: false, threeD: false });
    if (summary.reachedPin) map.current?.send({ type: 'reached' });
    const timer = setTimeout(() => map.current?.send({ type: 'fit', top: 36, bottom: 42, paintOnly: true }), 250);
    return () => clearTimeout(timer);
  }, [mapReady, mapCenter, summary]);

  // The share clip: this walk lighting the night city. 200 m are cut at both ends (a walk often starts at home);
  // a walk too short for that falls back to the text share.
  const scene = useMemo<ShareSceneInput | null>(() => {
    const segments = (summary.segments?.length ? summary.segments : [summary.path]).map(seg => seg.map(p => [p.lng, p.lat] as LngLat));
    const line = thin(joinSegments(trimEnds(segments, 200)), 1200);
    if (!canRecordClips || line.length < 2) return null;
    return {
      kind: 'walk', line, hero: user?.gender === 'FEMALE' ? 'f' : 'm',
      kicker: formatRunDate(summary.startedAt), title: tx('გავანათე', 'I lit up'), big: formatKm(summary.distanceM), unit: tx('კმ', 'km'),
      stats: [
        { value: formatClock(summary.movingMs), label: tx('აქტიური დრო', 'Active time') },
        { value: formatPace(summary.paceSecPerKm), label: tx('ტემპი /კმ', 'Pace /km') },
        { value: formatThousands(summary.steps), label: tx('ნაბიჯი', 'Steps') },
      ],
    };
  }, [summary, user?.gender]);

  const share = () => {
    if (scene) { setStudio(true); return; }
    const lines = [
      `MEDIRUN · ${formatRunDate(summary.startedAt)}`,
      tx(`${formatKm(summary.distanceM)} კმ · ${formatClock(summary.movingMs)} · ${formatPace(summary.paceSecPerKm)} /კმ`, `${formatKm(summary.distanceM)} km · ${formatClock(summary.movingMs)} · ${formatPace(summary.paceSecPerKm)} /km`),
      records.length ? tx(`რეკორდი: ${records.map(r => RECORD_COPY[r]).join(', ')}`, `Record: ${records.map(r => RECORD_COPY[r]).join(', ')}`) : '',
      tx('ყოველი გზა შენი ისტორიაა — medicard.ge', 'Every path is your story — medicard.ge'),
    ].filter(Boolean);
    void Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const stats = [
    { icon: Timer, value: formatClock(summary.movingMs), label: tx('აქტიური დრო', 'Active time') },
    { icon: Gauge, value: formatPace(summary.paceSecPerKm), label: tx('ტემპი · წთ/კმ', 'Pace · min/km') },
    { icon: Zap, value: avgKmh > 0 ? avgKmh.toFixed(1) : '–', label: tx('საშ. სიჩქარე · კმ/სთ', 'Avg speed · km/h') },
    { icon: Footprints, value: formatThousands(summary.steps), label: tx('სავარაუდო ნაბიჯები', 'Estimated steps') },
    { icon: Flame, value: String(summary.calories), label: tx('სავარაუდო კკალ', 'Estimated kcal') },
    { icon: Flag, value: formatClock(summary.elapsedMs), label: tx('სულ, პაუზების ჩათვლით', 'Total, incl. pauses') },
  ];

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: Math.max(24, insets.bottom + 12), paddingHorizontal: HUB.gutter, gap: HUB.sectionGap - 4 }}>
    <ModuleHeader module="run" subtitle={tx('ყოველი გზა შენი ისტორიაა', 'Every path is your story')} onBack={onBack}
      right={<ModuleHeaderButton label={tx('გაზიარება', 'Share')} icon={Share2} onPress={share} />} />

    <View style={{ gap: 4 }}><Copy bold size={25} style={{ lineHeight: 35 }}>{title}</Copy><Copy muted size={12}>{formatRunDate(summary.startedAt)} · {summary.targetMeters === 0 ? tx('თავისუფალი გასეირნება', 'Free walk') : targetLabel(summary.target)}</Copy></View>

    {records.length ? <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: HUB.cardPad, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(251,191,36,0.16)', alignItems: 'center', justifyContent: 'center' }}><Award size={24} color="#FCD34D" /></View>
      <View style={{ flex: 1 }}><Copy bold size={15} style={{ color: '#fff' }}>{tx('ახალი პირადი რეკორდი!', 'New personal record!')}</Copy><Copy size={12} style={{ color: '#C5DADA' }}>{records.map(r => RECORD_COPY[r]).join(' · ')}</Copy></View>
    </View> : null}

    <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
      <View style={{ padding: HUB.cardPad, paddingBottom: 14, gap: 2 }}>
        <Copy size={12} muted>{tx('შენი გავლილი გზა', 'Your path')}</Copy>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}><Copy bold size={48} style={{ lineHeight: 62, letterSpacing: -1.5, fontVariant: ['tabular-nums'], flexShrink: 1 }}>{formatKm(summary.distanceM)}</Copy><Copy bold size={17} style={{ color: c.primary100 }}>{tx('კმ', 'km')}</Copy></View>
      </View>
      <View style={{ height: 250, backgroundColor: c.bg200 }}>
        {mapCenter ? <RunMap ref={map} center={mapCenter} onReady={() => setMapReady(true)} /> : <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 }}><MapPin size={28} color={c.primary100} /><Copy muted size={12}>{tx('ამ ჩანაწერს მარშრუტი არ ახლავს', 'This record has no route')}</Copy></View>}
      </View>
    </Card>

    <Section title={tx('გასეირნება რიცხვებში', 'Your walk in numbers')}><Card style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 0 }}>
      {/* One card, three columns (owner 2026-10-04: shorter pages) instead of six separate cards. */}
      {stats.map((stat, index) => <View key={stat.label} style={{ width: '33.333%', paddingVertical: 12, paddingHorizontal: 10, gap: 6, borderTopWidth: index >= 3 ? 1 : 0, borderLeftWidth: index % 3 ? 1 : 0, borderColor: c.bg200 }}><Tile icon={stat.icon} size={30} /><Copy bold size={17} numberOfLines={1} style={{ lineHeight: 24, fontVariant: ['tabular-nums'] }}>{stat.value}</Copy><Copy size={10} muted numberOfLines={2} style={{ lineHeight: 14 }}>{stat.label}</Copy></View>)}
    </Card></Section>

    {summary.splits?.some(s => s >= 0) ? <Section title={tx('კილომეტრები', 'Kilometers')}><Card><SplitBars splits={summary.splits} /><Copy muted size={11}>{tx('თითოეული სრული კილომეტრის ტემპი (წთ/კმ). ფერადი — ყველაზე სწრაფი.', 'Pace for each full kilometer (min/km). Colored — the fastest.')}</Copy></Card></Section> : null}

    {summary.targetMeters > 0 ? <Card style={{ gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Tile icon={Flag} ink={summary.completedTarget ? 'green' : 'teal'} /><View style={{ flex: 1 }}><Copy bold size={14}>{summary.completedTarget ? tx('მიზანი შესრულებულია', 'Goal reached') : tx('ყოველი ნაბიჯი წინსვლაა', 'Every step is progress')}</Copy><Copy muted size={12}>{targetLabel(summary.target)}</Copy></View><Copy bold size={22} style={{ color: c.primary100 }}>{pct}%</Copy></View><Bar value={pct} color={summary.completedTarget ? c.success : RUN_TEAL} label={tx('ვარჯიშის მიზანი', 'Workout goal')} /></Card> : null}

    {summary.pin ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><MapPin size={17} color={c.primary100} /><Copy muted size={12} style={{ flex: 1 }}>{summary.reachedPin ? tx('დანიშნულების ადგილს მიაღწიე', 'You reached the destination') : tx('დანიშნულების ადგილამდე ამ სესიაში ვერ მიხვედი', 'You didn’t reach the destination this session')}</Copy></View> : null}
    <View>
      <Copy muted size={11}>{tx('ნაბიჯები და კალორია შეფასებითია. შეინარჩუნე შენთვის კომფორტული ტემპი.', 'Steps and calories are estimates. Keep a pace that feels comfortable for you.')}</Copy>
      <MedicalSourcesLink sourceIds={['activityMet']} />
    </View>
    {footer}
    <ShareStudio visible={studio} scene={scene} source="walk" onClose={() => setStudio(false)} />
  </ScrollView>;
}
