import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { CalendarDays, House, UserRound, UsersRound } from 'lucide-react-native';
import { PrivateImage } from '@/components/coach/CoachUI';
import type { ProgressPhoto } from '@/lib/coach';
import { daysBetween } from '@/lib/coach';
import { hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/** Weight line with the goal as a dashed target and the ideal path from start to deadline. */
export function WeightChart({ series, goal, height = 170 }: { series: { date: string; kg: number }[]; goal?: { startKg: number; targetKg: number; startedYmd: string; deadlineYmd: string } | null; height?: number }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const data = series.slice(-60);
  const geo = useMemo(() => {
    if (!data.length || !width) return null;
    const first = goal?.startedYmd && goal.startedYmd < data[0].date ? goal.startedYmd : data[0].date;
    const last = data[data.length - 1].date;
    const end = goal?.deadlineYmd && goal.deadlineYmd > last && daysBetween(last, goal.deadlineYmd) < 200 ? goal.deadlineYmd : last;
    const span = Math.max(1, daysBetween(first, end));
    const values = [...data.map((d) => d.kg), ...(goal ? [goal.targetKg, goal.startKg] : [])];
    const min = Math.floor(Math.min(...values) - 1);
    const max = Math.ceil(Math.max(...values) + 1);
    const pad = { l: 34, r: 12, t: 12, b: 22 };
    const x = (ymd: string) => pad.l + (daysBetween(first, ymd) / span) * (width - pad.l - pad.r);
    const y = (kg: number) => pad.t + (1 - (kg - min) / Math.max(1, max - min)) * (height - pad.t - pad.b);
    return { x, y, min, max, pad, first, end };
  }, [data, goal, width, height]);

  const ink = dark ? '#5EEAD4' : '#0F766E';
  const goalInk = dark ? '#FCD34D' : '#B45309';
  return (
    <View onLayout={onLayout} style={{ height }} accessibilityRole="image" accessibilityLabel={data.length ? `წონა: ${data[data.length - 1].kg} კგ${goal ? `, მიზანი ${goal.targetKg} კგ` : ''}` : 'წონის მონაცემი არ არის'}>
      {geo && data.length ? (
        <Svg width={width} height={height}>
          {[geo.min, Math.round((geo.min + geo.max) / 2), geo.max].map((v) => (
            <React.Fragment key={v}>
              <Line x1={geo.pad.l} x2={width - geo.pad.r} y1={geo.y(v)} y2={geo.y(v)} stroke={c.bg300} strokeWidth={1} />
              <SvgText x={4} y={geo.y(v) + 4} fontSize={10} fill={c.text300}>{v}</SvgText>
            </React.Fragment>
          ))}
          {goal ? (
            <>
              <Line x1={geo.pad.l} x2={width - geo.pad.r} y1={geo.y(goal.targetKg)} y2={geo.y(goal.targetKg)} stroke={goalInk} strokeWidth={1.5} strokeDasharray="5 5" />
              <Line x1={geo.x(goal.startedYmd < geo.first ? geo.first : goal.startedYmd)} y1={geo.y(goal.startKg)} x2={geo.x(goal.deadlineYmd > geo.end ? geo.end : goal.deadlineYmd)} y2={geo.y(goal.targetKg)} stroke={goalInk} strokeOpacity={0.35} strokeWidth={2} />
            </>
          ) : null}
          <Path d={data.map((d, i) => `${i ? 'L' : 'M'}${geo.x(d.date).toFixed(1)},${geo.y(d.kg).toFixed(1)}`).join(' ')} stroke={ink} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (i === data.length - 1 || data.length < 16 ? <Circle key={d.date} cx={geo.x(d.date)} cy={geo.y(d.kg)} r={i === data.length - 1 ? 5 : 3} fill={i === data.length - 1 ? ink : c.surface} stroke={ink} strokeWidth={2} /> : null))}
        </Svg>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[hubText.body, { color: c.text300 }]}>აწონვები ჯერ არ არის</Text>
        </View>
      )}
    </View>
  );
}

/** Before/after: the after photo is revealed by dragging the divider. */
export function BeforeAfter({ before, after, height = 380 }: { before: ProgressPhoto; after: ProgressPhoto; height?: number }) {
  const c = useThemeColors();
  const [width, setWidth] = useState(0);
  const [split, setSplit] = useState(0.5);
  const widthRef = useRef(0);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => widthRef.current && setSplit(Math.max(0.04, Math.min(0.96, e.nativeEvent.locationX / widthRef.current))),
        onPanResponderMove: (e) => widthRef.current && setSplit(Math.max(0.04, Math.min(0.96, e.nativeEvent.locationX / widthRef.current))),
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  const kgDelta = before.weightKg != null && after.weightKg != null ? Math.round((after.weightKg - before.weightKg) * 10) / 10 : null;
  const days = daysBetween(before.takenOn, after.takenOn);
  const urlOf = (p: ProgressPhoto) => p.url;
  return (
    <View>
      <View
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setWidth(e.nativeEvent.layout.width);
        }}
        style={[st.compare, { height, backgroundColor: c.bg200 }]}
        accessibilityRole="adjustable"
        accessibilityLabel="მანამდე და შემდეგ — გადაათრიე გამყოფი"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(split * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => setSplit((v) => Math.max(0.04, Math.min(0.96, v + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
        {...responder.panHandlers}
      >
        <PrivateImage path={urlOf(after)} style={StyleSheet.absoluteFill} label="შემდეგ" />
        <View style={[StyleSheet.absoluteFill, { width: width * split, overflow: 'hidden' }]}>
          <PrivateImage path={urlOf(before)} style={{ width, height }} label="მანამდე" />
        </View>
        <View pointerEvents="none" style={[st.divider, { left: width * split - 1.5 }]}>
          <View style={st.knob}>
            <Text style={st.knobText}>‹ ›</Text>
          </View>
        </View>
        <View pointerEvents="none" style={[st.tag, { left: 10 }]}>
          <Text style={st.tagText}>მანამდე · {before.takenOn}</Text>
        </View>
        <View pointerEvents="none" style={[st.tag, { right: 10 }]}>
          <Text style={st.tagText}>შემდეგ · {after.takenOn}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={[hubText.cardTitle, { color: c.text100 }]}>{days} დღე</Text>
        {kgDelta != null ? (
          <Text style={[hubText.cardTitle, { color: kgDelta <= 0 ? c.success : c.warning }]}>
            {kgDelta > 0 ? '+' : ''}
            {kgDelta} კგ
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const TABS = [
  { href: '/coach', label: 'დღეს', Icon: House, match: (p: string) => p === '/coach' },
  { href: '/coach/calendar', label: 'კალენდარი', Icon: CalendarDays, match: (p: string) => p.startsWith('/coach/calendar') },
  { href: '/coach/clients', label: 'კლიენტები', Icon: UsersRound, match: (p: string) => p.startsWith('/coach/clients') || p.startsWith('/coach/client/') },
  { href: '/coach/profile', label: 'პროფილი', Icon: UserRound, match: (p: string) => p.startsWith('/coach/profile') },
] as const;

/** The trainer workspace has its own navigation: the consumer tab bar is hidden on /coach. */
export function CoachTabBar() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  return (
    <View style={[st.tabBar, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: c.surface, borderTopColor: c.bg300 }]} accessibilityRole="tablist">
      {TABS.map(({ href, label, Icon, match }) => {
        const active = match(path);
        const color = active ? c.primary100 : c.text300;
        return (
          <Pressable
            key={href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            onPress={() => !active && router.replace(href as never)}
            style={st.tab}
          >
            <Icon size={22} color={color} strokeWidth={active ? 2.4 : 1.9} />
            <Text style={[hubText.small, { color, fontFamily: active ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium' }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const COACH_TAB_HEIGHT = 64;

const st = StyleSheet.create({
  compare: { borderRadius: 22, overflow: 'hidden' },
  divider: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  knob: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginLeft: -0.5 },
  knobText: { fontSize: 16, color: '#0F1A1C', fontWeight: '700' },
  tag: { position: 'absolute', bottom: 10, backgroundColor: 'rgba(3,7,18,0.62)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'NotoSansGeorgian_600SemiBold' },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48, justifyContent: 'center' },
});
