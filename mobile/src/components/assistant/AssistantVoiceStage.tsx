import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { AudioLines, ShieldCheck } from 'lucide-react-native';
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
function VoiceWave({ active, metering, processing }: { active: boolean; metering?: number; processing: boolean }) {
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
    amplitude.value = withTiming(reduced ? (active ? 18 : 0) : active ? level : processing ? 16 : 0, { duration: 160 });
  }, [active, processing, metering, reduced, amplitude]);
  const first = useAnimatedProps(() => ({ d: wavePath(phase.value, amplitude.value, 0, 2) }));
  const second = useAnimatedProps(() => ({ d: wavePath(-phase.value * .8, amplitude.value * .8, 2.5, 3.4) }));
  const third = useAnimatedProps(() => ({ d: wavePath(phase.value * .6, amplitude.value * .45, 4.5, 2.2) }));
  return <View accessible={false} pointerEvents="none" style={{ width: '100%', height: 128 }}>
    <Svg width="100%" height="128" viewBox="0 0 400 128" preserveAspectRatio="none">
      <AnimatedPath animatedProps={third} stroke={C.primary200} strokeOpacity={.17} strokeWidth={1.6} fill="none" />
      <AnimatedPath animatedProps={second} stroke={C.primary200} strokeOpacity={.4} strokeWidth={1.7} fill="none" />
      <AnimatedPath animatedProps={first} stroke={C.primary200} strokeOpacity={.9} strokeWidth={1.8} fill="none" />
    </Svg>
  </View>;
}

/** Figma 8856:142096 / 8856:150213: open canvas, centered voice text, fine teal waves. */
export function AssistantVoiceStage({ phase, metering, transcript, notice, error, pet, processing }: {
  phase: VoicePhase; metering?: number; transcript: string; notice: string | null; error: string | null; pet: boolean; processing: boolean;
}) {
  const C = useThemeColors(), listening = phase === 'recording';
  const title = phase === 'preparing' ? 'ერთი წამით…' : listening ? 'გისმენ.\nმომიყევი შენი სიტყვებით.' : transcript || (phase === 'transcribing' ? 'შენს ნათქვამს\nვუსმენ…' : pet ? 'მოუყევი\nMedi Vet-ს' : 'როგორ\nდაგეხმარო დღეს?');
  return <View style={{ flex: 1, minHeight: 0 }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 30, paddingBottom: 12, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, backgroundColor: C.accent100 }}>
        <AudioLines size={14} color={C.primary100} /><Text style={{ color: C.primary100, fontSize: 11, fontFamily: 'NotoSansGeorgian_400Regular' }}>ხმოვანი საუბარი</Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={{ marginTop: 26, color: C.text100, fontSize: transcript ? 25 : 29, lineHeight: transcript ? 38 : 43, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular' }}>{title}</Text>
      {!listening && !processing && !transcript && phase === 'idle' ? <Text style={{ marginTop: 20, maxWidth: 290, color: C.text200, fontSize: 13, lineHeight: 23, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular' }}>{pet ? '„მინდა დავამატო ძაღლი რექსი“' : '„დავლიე 250 მლ წყალი“\n„დამეხმარე მიზნის დამატებაში“'}</Text> : null}
      <View style={{ flex: 1, minHeight: 20 }} />
      {error || notice ? <View style={{ width: '100%', borderRadius: 14, padding: 12, backgroundColor: error ? C.dangerBg : C.bg200 }}><Text accessibilityRole={error ? 'alert' : undefined} style={{ color: error ? C.danger : C.text200, fontSize: 12, lineHeight: 21, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular' }}>{error || notice}</Text></View>
        : !listening && !processing ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ShieldCheck size={14} color={C.text200} /><Text style={{ color: C.text200, fontSize: 11, fontFamily: 'NotoSansGeorgian_400Regular' }}>ინახება მხოლოდ შენი დადასტურებით</Text></View> : null}
    </ScrollView>
    <VoiceWave active={listening} metering={metering} processing={processing} />
  </View>;
}
