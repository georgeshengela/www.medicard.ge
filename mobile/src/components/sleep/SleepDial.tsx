import React, { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Moon, Sun } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { hhmm } from '@/lib/sleep/sleepTime';
import { ClockText, MOON, MOON_INK, ORCHID, SleepDuration } from './SleepKit';

/**
 * The MEDISLEEP dial (the hub's one bold element): a 24-hour face — midnight on top, noon at the bottom — with
 * tonight's window drawn as a lit arc from the moon (bedtime) to the sun (wake-up). Both handles drag (5-minute
 * steps, a tick of haptics every 15) and the centre shows how long that night would be. VoiceOver gets ± buttons
 * through the accessibility actions instead of dragging.
 */
const STEP = 5;
const MIN_SLEEP = 4 * 60;
const MAX_SLEEP = 12 * 60;

function angleOf(minutes: number) {
  return (minutes / 1440) * Math.PI * 2;
}
function point(cx: number, r: number, minutes: number) {
  const a = angleOf(minutes);
  return { x: cx + r * Math.sin(a), y: cx - r * Math.cos(a) };
}
function arcPath(cx: number, r: number, from: number, to: number) {
  const span = (((to - from) % 1440) + 1440) % 1440;
  const a = point(cx, r, from);
  const b = point(cx, r, to);
  const large = span > 720 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}
const norm = (m: number) => ((Math.round(m / STEP) * STEP) % 1440 + 1440) % 1440;
const spanOf = (bed: number, wake: number) => (((wake - bed) % 1440) + 1440) % 1440;

export function SleepDial({
  bedtime,
  wake,
  size = 272,
  editable = true,
  onChange,
  onCommit,
  sleepMinutes,
}: {
  /** Minutes after midnight. */
  bedtime: number;
  wake: number;
  size?: number;
  editable?: boolean;
  onChange?: (next: { bedtime: number; wake: number }) => void;
  onCommit?: (next: { bedtime: number; wake: number }) => void;
  /** Shown in the centre; defaults to the window minus 15 minutes to fall asleep. */
  sleepMinutes?: number;
}) {
  const cx = size / 2;
  const band = 26;
  const r = cx - band / 2 - 6;
  const [drag, setDrag] = useState<'bed' | 'wake' | null>(null);
  // The gesture callbacks read the ref: a re-render after touch-down must not lose the first moves.
  const dragRef = useRef<'bed' | 'wake' | null>(null);
  const live = useRef({ bedtime, wake });
  live.current = { bedtime, wake };
  const lastTick = useRef(0);

  const bedPt = point(cx, r, bedtime);
  const wakePt = point(cx, r, wake);
  const window = spanOf(bedtime, wake);
  const centre = sleepMinutes ?? Math.max(0, window - 15);

  const ticks = useMemo(() => Array.from({ length: 48 }, (_, i) => i * 30), []);

  const update = (which: 'bed' | 'wake', x: number, y: number) => {
    const angle = Math.atan2(x - cx, cx - y);
    const minutes = norm(((angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2)) * 1440);
    const cur = live.current;
    let next = which === 'bed' ? { bedtime: minutes, wake: cur.wake } : { bedtime: cur.bedtime, wake: minutes };
    const span = spanOf(next.bedtime, next.wake);
    if (span < MIN_SLEEP || span > MAX_SLEEP) {
      // Keep the window within 4–12 hours: the other handle follows.
      const keep = span < MIN_SLEEP ? MIN_SLEEP : MAX_SLEEP;
      next = which === 'bed' ? { bedtime: minutes, wake: norm(minutes + keep) } : { bedtime: norm(minutes - keep), wake: minutes };
    }
    if (next.bedtime === cur.bedtime && next.wake === cur.wake) return;
    const moved = which === 'bed' ? next.bedtime : next.wake;
    if (Math.floor(moved / 15) !== lastTick.current) {
      lastTick.current = Math.floor(moved / 15);
      void Haptics.selectionAsync().catch(() => undefined);
    }
    live.current = next;
    onChange?.(next);
  };

  const pan = Gesture.Pan()
    .enabled(editable)
    .runOnJS(true)
    .manualActivation(true)
    .onTouchesDown((e, manager) => {
      const t = e.allTouches[0];
      if (!t) return manager.fail();
      const dBed = Math.hypot(t.x - bedPt.x, t.y - bedPt.y);
      const dWake = Math.hypot(t.x - wakePt.x, t.y - wakePt.y);
      const near = Math.min(dBed, dWake);
      if (near > 34) return manager.fail();
      dragRef.current = dBed <= dWake ? 'bed' : 'wake';
      setDrag(dragRef.current);
      manager.activate();
    })
    .onUpdate((e) => {
      if (dragRef.current) update(dragRef.current, e.x, e.y);
    })
    .onFinalize(() => {
      if (dragRef.current) onCommit?.(live.current);
      dragRef.current = null;
      setDrag(null);
    });

  const nudge = (which: 'bed' | 'wake', delta: number) => {
    const cur = live.current;
    const next = which === 'bed' ? { bedtime: norm(cur.bedtime + delta), wake: cur.wake } : { bedtime: cur.bedtime, wake: norm(cur.wake + delta) };
    const span = spanOf(next.bedtime, next.wake);
    if (span < MIN_SLEEP || span > MAX_SLEEP) return;
    onChange?.(next);
    onCommit?.(next);
  };

  const Handle = ({ at, which }: { at: { x: number; y: number }; which: 'bed' | 'wake' }) => {
    const active = drag === which;
    const d = active ? 44 : 38;
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: at.x - d / 2, top: at.y - d / 2, width: d, height: d, borderRadius: d / 2,
          backgroundColor: which === 'bed' ? MOON : '#FFFFFF', alignItems: 'center', justifyContent: 'center',
          shadowColor: which === 'bed' ? MOON : '#FFFFFF', shadowOpacity: active ? 0.7 : 0.35, shadowRadius: active ? 16 : 10, shadowOffset: { width: 0, height: 0 },
        }}
      >
        {which === 'bed' ? <Moon size={18} color={MOON_INK} fill={MOON_INK} /> : <Sun size={18} color={MOON_INK} />}
      </View>
    );
  };

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ width: size, height: size, alignSelf: 'center' }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={tx(`ძილის ფანჯარა: დაწოლა ${hhmm(bedtime)}, გაღვიძება ${hhmm(wake)}`, `Sleep window: bedtime ${hhmm(bedtime)}, wake-up ${hhmm(wake)}`)}
        accessibilityActions={editable ? [
          { name: 'increment', label: tx('გაღვიძება 15 წუთით გვიან', 'Wake up 15 minutes later') },
          { name: 'decrement', label: tx('გაღვიძება 15 წუთით ადრე', 'Wake up 15 minutes earlier') },
          { name: 'bedLater', label: tx('დაწოლა 15 წუთით გვიან', 'Go to bed 15 minutes later') },
          { name: 'bedEarlier', label: tx('დაწოლა 15 წუთით ადრე', 'Go to bed 15 minutes earlier') },
        ] : undefined}
        onAccessibilityAction={(e) => {
          const name = e.nativeEvent.actionName;
          if (name === 'increment') nudge('wake', 15);
          else if (name === 'decrement') nudge('wake', -15);
          else if (name === 'bedLater') nudge('bed', 15);
          else if (name === 'bedEarlier') nudge('bed', -15);
        }}
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="sleepArc" x1={bedPt.x} y1={bedPt.y} x2={wakePt.x} y2={wakePt.y} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={MOON} />
              <Stop offset="0.55" stopColor={ORCHID} />
              <Stop offset="1" stopColor="#9A86F0" />
            </LinearGradient>
          </Defs>
          {/* face */}
          <Circle cx={cx} cy={cx} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={band} fill="none" />
          <Circle cx={cx} cy={cx} r={r - band / 2 - 14} fill="rgba(10,8,30,0.35)" />
          <G>
            {ticks.map((m) => {
              const major = m % 360 === 0;
              const hour = m % 60 === 0;
              const outer = point(cx, r - band / 2 - 6, m);
              const inner = point(cx, r - band / 2 - (major ? 16 : hour ? 12 : 9), m);
              return (
                <Line key={m} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
                  stroke={major ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)'} strokeWidth={major ? 2 : 1} strokeLinecap="round" />
              );
            })}
            {[0, 360, 720, 1080].map((m) => {
              const p = point(cx, r - band / 2 - 30, m);
              return (
                <SvgText key={m} x={p.x} y={p.y + 4} fill="rgba(255,255,255,0.55)" fontSize={11} fontWeight="600" textAnchor="middle">
                  {String(m / 60).padStart(2, '0')}
                </SvgText>
              );
            })}
          </G>
          {/* the night */}
          <Path d={arcPath(cx, r, bedtime, wake)} stroke={ORCHID} strokeOpacity={0.18} strokeWidth={band + 14} strokeLinecap="round" fill="none" />
          <Path d={arcPath(cx, r, bedtime, wake)} stroke="url(#sleepArc)" strokeWidth={band} strokeLinecap="round" fill="none" />
        </Svg>
        <Handle at={bedPt} which="bed" />
        <Handle at={wakePt} which="wake" />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <SleepDuration minutes={centre} size={38} color="#FFFFFF" unitColor="rgba(255,255,255,0.72)" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ClockText value={hhmm(bedtime)} size={15} color="rgba(255,255,255,0.85)" />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>→</Text>
            <ClockText value={hhmm(wake)} size={15} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}
