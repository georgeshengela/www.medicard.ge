import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { NightSky } from '@/components/sleep/NightSky';
import { MOON, MOON_INK, MoonButton, ORCHID } from '@/components/sleep/SleepKit';

/**
 * Breathing before sleep. Presented as relaxation, not treatment (research brief: 4-7-8 has only small
 * trials; slow-exhale „cyclic sighing“ lowered breathing rate and improved mood in an RCT). One orb grows on
 * the in-breath, holds, and shrinks on the out-breath; a soft haptic marks each change. Reduce Motion → the orb
 * stays still and the words and seconds lead.
 */
type Phase = { kind: 'in' | 'hold' | 'out' | 'sip'; seconds: number };
type Pattern = { id: string; title: string; note: string; phases: Phase[] };

const PATTERNS: Pattern[] = [
  { id: '478', title: '4-7-8', note: tx('ცხვირით 4, შეკავება 7, პირით 8', 'In 4, hold 7, out 8'), phases: [{ kind: 'in', seconds: 4 }, { kind: 'hold', seconds: 7 }, { kind: 'out', seconds: 8 }] },
  { id: 'sigh', title: tx('მშვიდი ამოსუნთქვა', 'Slow exhale'), note: tx('ორმაგი ჩასუნთქვა, გრძელი ამოსუნთქვა', 'A double in-breath, a long out-breath'), phases: [{ kind: 'in', seconds: 3 }, { kind: 'sip', seconds: 1 }, { kind: 'out', seconds: 7 }] },
  { id: 'box', title: tx('კვადრატი', 'Box'), note: tx('4 · 4 · 4 · 4', '4 · 4 · 4 · 4'), phases: [{ kind: 'in', seconds: 4 }, { kind: 'hold', seconds: 4 }, { kind: 'out', seconds: 4 }, { kind: 'hold', seconds: 4 }] },
];
const DURATIONS = [1, 3, 5];

const WORD: Record<Phase['kind'], string> = {
  in: tx('ჩაისუნთქე', 'Breathe in'),
  hold: tx('შეიკავე', 'Hold'),
  out: tx('ამოისუნთქე', 'Breathe out'),
  sip: tx('კიდევ ცოტა', 'A little more'),
};

export default function SleepBreathe() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [pattern, setPattern] = useState(PATTERNS[0]);
  const [minutes, setMinutes] = useState(3);
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const scale = useSharedValue(0.55);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    if (tick.current) clearInterval(tick.current);
    timer.current = null;
    tick.current = null;
    setRunning(false);
    scale.value = withTiming(0.55, { duration: 800 });
  };

  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runPhase = (index: number, until: number) => {
    if (Date.now() >= until && index % pattern.phases.length === 0) {
      stop();
      return;
    }
    const phase = pattern.phases[index % pattern.phases.length];
    setPhaseIndex(index % pattern.phases.length);
    setLeft(phase.seconds);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
    if (!reduce) {
      const target = phase.kind === 'in' ? 1 : phase.kind === 'sip' ? 1.08 : phase.kind === 'out' ? 0.55 : scale.value;
      scale.value = withTiming(target, { duration: phase.seconds * 1000, easing: Easing.inOut(Easing.sin) });
    }
    timer.current = setTimeout(() => runPhase(index + 1, until), phase.seconds * 1000);
  };

  const start = () => {
    const until = Date.now() + minutes * 60_000;
    setEndsAt(until);
    setRunning(true);
    tick.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    runPhase(0, until);
  };

  const orb = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const phase = pattern.phases[phaseIndex];
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 60_000));

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0A1F' }}>
      <NightSky colors={['#0B0A1F', '#1B1145', '#2B1A57']} glowAt={{ x: 0.5, y: 0.45 }} stars={36} twinkles={4} seed={9} />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: '#FFFFFF' }}>{tx('სუნთქვა ძილის წინ', 'Breathing before sleep')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/sleep' as never))} hitSlop={10} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <X size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(217,168,255,0.12)' }, orb]} />
          <Animated.View style={[{ position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(217,168,255,0.22)' }, orb]} />
          <Animated.View style={[{ width: 150, height: 150, borderRadius: 75, backgroundColor: ORCHID, opacity: 0.85, shadowColor: ORCHID, shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } }, orb]} />
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            {running ? (
              <>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: MOON_INK }}>{WORD[phase.kind]}</Text>
                <Text style={{ fontWeight: '200', fontSize: 44, color: MOON_INK, fontVariant: ['tabular-nums'] }}>{left}</Text>
              </>
            ) : (
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: MOON_INK }}>{pattern.title}</Text>
            )}
          </View>
        </View>
        <Text style={{ marginTop: 28, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
          {running ? tx(`დარჩა ~${remaining} წთ`, `About ${remaining} min left`) : pattern.note}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 18, gap: 14 }}>
        {!running ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PATTERNS.map((p) => (
                <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: pattern.id === p.id }} onPress={() => setPattern(p)} style={{ flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: pattern.id === p.id ? MOON : 'rgba(255,255,255,0.1)' }}>
                  <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: pattern.id === p.id ? MOON_INK : '#FFFFFF' }}>{p.title}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              {DURATIONS.map((m) => (
                <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: minutes === m }} onPress={() => setMinutes(m)} style={{ height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: minutes === m ? 'rgba(244,227,181,0.2)' : 'transparent', borderWidth: 1, borderColor: minutes === m ? MOON : 'rgba(255,255,255,0.18)' }}>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: '#FFFFFF' }}>{tx(`${m} წთ`, `${m} min`)}</Text>
                </Pressable>
              ))}
            </View>
            <MoonButton label={tx('დაწყება', 'Start')} onPress={start} />
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={stop} style={{ alignSelf: 'center', height: 46, paddingHorizontal: 26, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>{tx('შეჩერება', 'Stop')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
