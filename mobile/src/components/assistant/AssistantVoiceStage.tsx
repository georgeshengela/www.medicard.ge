import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useThemeColors } from '@/theme/colors';
import type { VoicePhase } from '@/lib/assistantVoiceSession';

const AnimatedPath = Animated.createAnimatedComponent(Path);
function wavePath(phase: number, amplitude: number, offset: number, frequency: number) {
  'worklet';
  let d = '';
  for (let x = 0; x <= 400; x += 5) {
    const y = 64 + Math.sin(x / 400 * Math.PI * frequency + phase + offset) * amplitude;
    d += `${x === 0 ? 'M' : 'L'}${x},${y} `;
  }
  return d;
}
function VoiceWave({ active, metering, processing, compact }: { active: boolean; metering?: number; processing: boolean; compact: boolean }) {
  const C = useThemeColors();
  const phase = useSharedValue(0), amplitude = useSharedValue(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; sub.remove(); };
  }, []);
  useEffect(() => {
    if ((active || processing) && !reduced) phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 3200, easing: Easing.linear }), -1, false);
    else { cancelAnimation(phase); phase.value = 0; }
    return () => cancelAnimation(phase);
  }, [active, processing, reduced, phase]);
  useEffect(() => {
    const level = metering === undefined ? 18 : Math.max(4, Math.min(42, (metering + 60) * 1.1));
    amplitude.value = withTiming(reduced ? (active ? 18 : 0) : active ? level : processing ? 16 : 7, { duration: 160 });
  }, [active, processing, metering, reduced, amplitude]);
  const first = useAnimatedProps(() => ({ d: wavePath(phase.value, amplitude.value, 0, 2) }));
  const second = useAnimatedProps(() => ({ d: wavePath(-phase.value * .8, amplitude.value * .8, 2.5, 3.4) }));
  const third = useAnimatedProps(() => ({ d: wavePath(phase.value * .6, amplitude.value * .45, 4.5, 2.2) }));
  return <View accessible={false} pointerEvents="none" style={{ width: '100%', height: compact ? 72 : 128 }}>
    <Svg width="100%" height={compact ? 72 : 128} viewBox="0 0 400 128" preserveAspectRatio="none">
      <AnimatedPath animatedProps={third} stroke={C.primary200} strokeOpacity={.17} strokeWidth={1.6} fill="none" />
      <AnimatedPath animatedProps={second} stroke={C.primary200} strokeOpacity={.4} strokeWidth={1.7} fill="none" />
      <AnimatedPath animatedProps={first} stroke={C.primary200} strokeOpacity={.9} strokeWidth={1.8} fill="none" />
    </Svg>
  </View>;
}

/** One conversation canvas for questions, listening, replies and the next action. */
export function AssistantVoiceStage({ phase, metering, processing, speaking, reply, userText, error, notice, hasTask, children }: {
  phase: VoicePhase; metering?: number; processing: boolean; speaking: boolean; reply?: string; userText?: string;
  error: string | null; notice: string | null; hasTask: boolean; children?: React.ReactNode;
}) {
  const C = useThemeColors(), listening = phase === 'recording', compact = useWindowDimensions().height < 760;
  const active = listening || processing || phase === 'preparing';
  const title = listening ? 'გისმენ.' : phase === 'preparing' ? 'ერთი წამით…' : processing ? 'ვუსმენ შენს ნათქვამს…' : error ? 'კავშირი შეფერხდა' : reply || 'აქ ვარ.\nმომიყევი.';
  return <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: compact ? 12 : 30, paddingBottom: 18, alignItems: 'center', justifyContent: !userText && !hasTask ? 'center' : 'flex-start', gap: 20 }}>
    {!active && userText ? <Text numberOfLines={3} selectable style={{ alignSelf: 'flex-end', maxWidth: '90%', color: C.text200, fontSize: 12, lineHeight: 21, fontFamily: 'NotoSansGeorgian_400Regular', textAlign: 'right' }}>{userText}</Text> : null}
    <View style={{ width: '100%', maxWidth: 520, alignItems: 'center', gap: 12 }}>
      <VoiceWave compact active={listening} metering={metering} processing={processing || speaking} />
      <Text accessibilityLiveRegion="polite" selectable style={{ color: C.text100, fontSize: !reply && !error ? 30 : hasTask ? 18 : 20, lineHeight: !reply && !error ? 44 : 29, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular' }}>{title}</Text>
      {!reply && !active && !error ? <Text style={{ maxWidth: 270, color: C.text200, fontSize: 13, lineHeight: 23, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular' }}>შენი სიტყვებით — შენზე, შენს გეგმებზე ან შენს ცხოველზე.</Text> : null}
    </View>
    {error || notice ? <Text accessibilityRole={error ? 'alert' : undefined} style={{ color: error ? C.danger : C.text200, fontSize: 13, lineHeight: 22, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular' }}>{error || notice}</Text> : null}
    {!active ? children : null}
  </ScrollView>;
}
