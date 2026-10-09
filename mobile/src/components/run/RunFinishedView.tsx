import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, Switch, View } from 'react-native';
import { Award, Clapperboard, Flag, Flame, Footprints, Gauge, MapPin, Share2, Timer, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { RunMap, type RunMapHandle } from './RunMap';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { Action, Bar, Card, Copy, RUN_TEAL, Section, Sheet, Tile } from './PulseUi';
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
import { joinSegments, lineLength, longestLine, privateLines, thin, type LngLat } from '@/lib/run/shareStudio';
import { api } from '@/lib/api';
import { ShareStudio, canRecordClips, type ShareSceneInput } from './ShareStudio';

/** `onBack`: where the header's back goes (the summary leaves the finished session; history goes back). */
type Props = { summary: RunSummary; title: string; onBack?: () => void; footer?: ReactNode; /** Open the video right away (the walks list's 🎬). */ autoVideo?: boolean };

const RECORD_COPY: Record<RecordKind, string> = { distance: tx('ყველაზე გრძელი გასეირნება', 'Longest walk'), pace: tx('საუკეთესო ტემპი', 'Best pace'), time: tx('ყველაზე ხანგრძლივი', 'Longest duration') };

export function RunFinishedView({ summary, title, onBack, footer, autoVideo = false }: Props) {
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

  // The share clip: this walk lighting the night city. „დაფარე სახლის მხარე“ (on by default, owner 2026-10-09) hides
  // only what passes within 250 m of the home place — a walk that starts elsewhere shows in full; without a known
  // home it cuts 200 m off both ends. Off: the whole walk.
  const [hideHome, setHideHome] = useState(true);
  const [home, setHome] = useState<LngLat | null>(null);
  useEffect(() => {
    let alive = true;
    void api.location.get().then(r => { if (alive && r?.location?.enabled && r.location.lat != null && r.location.lng != null) setHome([r.location.lng, r.location.lat]); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const sceneFor = (hide: boolean): ShareSceneInput | null => {
    const segments = (summary.segments?.length ? summary.segments : [summary.path]).map(seg => seg.map(p => [p.lng, p.lat] as LngLat));
    // GPS jumps split the walk; the clip follows its longest unbroken stretch (never a straight leap across town).
    let line = thin(longestLine(privateLines(segments, { hide, home })), 1200);
    // The whole path (switch off / „ვიდეო მთელი გზით“): a short walk the GPS-jump filter chops into bits stays one
    // line — owner 2026-10-09, a 0.25 km walk got „ძალიან მოკლეა“.
    if (!hide && lineLength(line) < 80) line = thin(joinSegments(segments), 1200);
    if (!canRecordClips || line.length < 2 || lineLength(line) < (hide ? 80 : 30)) return null;
    return {
      kind: 'walk', line, hero: user?.gender === 'FEMALE' ? 'f' : 'm',
      kicker: formatRunDate(summary.startedAt), title: tx('გავანათე', 'I lit up'), big: formatKm(summary.distanceM), unit: tx('კმ', 'km'),
      stats: [
        { value: formatClock(summary.movingMs), label: tx('აქტიური დრო', 'Active time') },
        { value: formatPace(summary.paceSecPerKm), label: tx('ტემპი /კმ', 'Pace /km') },
        { value: formatThousands(summary.steps), label: tx('ნაბიჯი', 'Steps') },
      ],
    };
  };
  const scene = useMemo(() => sceneFor(hideHome), [summary, user?.gender, hideHome, home]); // eslint-disable-line react-hooks/exhaustive-deps
  // The whole walk: offered (never used silently) when hiding the home part leaves nothing to film.
  const fullScene = useMemo(() => sceneFor(false), [summary, user?.gender, home]); // eslint-disable-line react-hooks/exhaustive-deps
  const [studioScene, setStudioScene] = useState<ShareSceneInput | null>(null);
  const [askFull, setAskFull] = useState(false);
  const openStudio = (next: ShareSceneInput) => { setStudioScene(next); setStudio(true); };

  // „ვიდეო ყველა გასეირნებას“ (owner 2026-10-09): the walks list's 🎬 opens this page with the clip already starting.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoVideo || autoOpened.current || (!scene && !fullScene)) return;
    autoOpened.current = true;
    if (scene) openStudio(scene); else setAskFull(true);
  }, [autoVideo, scene, fullScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // „ვიდეო მინდა, არა პარამეტრები“ (owner 2026-10-09): the button always makes the clip; when hiding the home part
  // leaves nothing, it asks before showing the whole path — never a silent fallback to text.
  const share = () => {
    if (scene) { openStudio(scene); return; }
    if (fullScene) { setAskFull(true); return; }
    shareText();
  };
  const shareText = () => {
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

    {/* The clip of this walk lighting the night city — the owner's favourite share, now on every walk. */}
    <Pressable accessibilityRole="button" accessibilityLabel={scene || fullScene ? tx('ვიდეოდ გაზიარება', 'Share as a video') : tx('გაზიარება', 'Share')} onPress={share} style={{ minHeight: 60, borderRadius: HUB.cardRadius, backgroundColor: HUB.spotlightBg, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: HUB.cardPad, paddingVertical: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(94,234,212,0.16)', alignItems: 'center', justifyContent: 'center' }}>{scene || fullScene ? <Clapperboard size={20} color="#5EEAD4" /> : <Share2 size={20} color="#5EEAD4" />}</View>
      <View style={{ flex: 1 }}>
        <Copy bold size={15} style={{ color: '#fff' }}>{scene || fullScene ? tx('ვიდეოდ გაზიარება', 'Share as a video') : tx('გაზიარება', 'Share')}</Copy>
        <Copy size={11} style={{ color: 'rgba(255,255,255,0.62)' }}>{scene ? tx('შენი გზა ანთებს ღამის ქალაქს — მზა ვიდეო სთორისთვის', 'Your path lighting the night city — a ready clip for stories') : fullScene ? tx('სახლის დაფარვით გზა თითქმის არ რჩება — დააჭირე და აირჩიე', 'With the home part hidden little is left — tap to choose') : tx('ვიდეოსთვის გზა ძალიან მოკლეა — გაზიარდება ტექსტით', 'Too short for a clip — it shares as text')}</Copy>
      </View>
    </Pressable>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -6, paddingHorizontal: 4 }}>
      <View style={{ flex: 1 }}>
        <Copy bold size={13}>{tx('დაფარე სახლის მხარე', 'Hide the home part')}</Copy>
        <Copy muted size={11}>{hideHome ? (home ? tx('ვიდეოში არ ჩანს გზა შენი სახლიდან 250 მ-ში', 'The clip leaves out the path within 250 m of your home') : tx('ვიდეოში არ ჩანს გზის პირველი და ბოლო 200 მ', 'The clip leaves out the first and last 200 m')) : tx('ვიდეოში მთელი გზა ჩანს — ვინც ნახავს, შეიძლება მიხვდეს, სად დაიწყე', 'The clip shows the whole path — viewers may tell where you started')}</Copy>
      </View>
      <Switch value={hideHome} onValueChange={setHideHome} accessibilityLabel={tx('დაფარე სახლის მხარე', 'Hide the home part')} trackColor={{ true: '#0D9488', false: c.bg300 }} thumbColor="#fff" />
    </View>

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
    <ShareStudio visible={studio} scene={studioScene || scene} source="walk" onClose={() => setStudio(false)} />
    <Sheet title={tx('ვიდეოში სახლის მხარე გამოჩნდება', 'The clip will show the home part')} visible={askFull} onClose={() => setAskFull(false)}>
      <Copy muted size={13}>{home ? tx('ეს გასეირნება თითქმის მთლიანად შენი სახლიდან 250 მ-შია, ამიტომ დაფარვის შემდეგ ვიდეოში გზა აღარ რჩება. მთელი გზით ვიდეოს ვინც ნახავს, შეიძლება მიხვდეს, სად ცხოვრობ.', 'This walk stays almost entirely within 250 m of your home, so with the home part hidden nothing is left to film. Anyone who sees a clip of the whole path may tell where you live.') : tx('გასეირნება მოკლეა: პირველი და ბოლო 200 მ-ის დაფარვის შემდეგ ვიდეოში გზა აღარ რჩება. მთელი გზით ვიდეოს ვინც ნახავს, შეიძლება მიხვდეს, სად დაიწყე.', 'The walk is short: with its first and last 200 m hidden nothing is left to film. Anyone who sees a clip of the whole path may tell where you started.')}</Copy>
      <Action icon={Clapperboard} label={tx('ვიდეო მთელი გზით', 'Clip of the whole path')} onPress={() => { setAskFull(false); setHideHome(false); if (fullScene) openStudio(fullScene); }} />
      <Action secondary label={tx('ტექსტით გაზიარება', 'Share as text')} onPress={() => { setAskFull(false); shareText(); }} />
    </Sheet>
  </ScrollView>;
}
