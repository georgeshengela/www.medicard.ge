import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowUp, AudioLines, Keyboard as KeyboardIcon, Mic, Square, Volume2, VolumeX, X } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';
import { ChatActionDock, useChatKeyboardOpen } from '@/components/chat/ChatScreenShell';
import type { VoicePhase } from '@/lib/assistantVoiceSession';

export function AssistantTalkDock(props: {
  tapMode?: boolean; voice: boolean; voiceOutput: boolean; phase: VoicePhase; duration: number; metering?: number;
  speechPhase: 'idle' | 'loading' | 'speaking'; muted: boolean; busy: string | null; reviewing: boolean;
  text: string; onText: (text: string) => void; onSend: () => void; onMode: (typing: boolean) => void; voiceStage: boolean;
  formActive?: boolean; formEditing?: boolean; onTextFocus?: () => void; onSave?: () => void;
  start: () => void; release: () => void; cancel: () => void; stopSpeech: () => void; toggleSpeech: () => void;
}) {
  const C = useThemeColors(), keyboardOpen = useChatKeyboardOpen();
  const [typing, setTyping] = useState(false), [screenReader, setScreenReader] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current, pressX = useRef<number | null>(null), canceled = useRef(false);
  const input = useRef<TextInput>(null);
  const recording = props.phase === 'recording', preparing = props.phase === 'preparing';
  const processing = props.phase === 'transcribing' || !!props.busy;
  const compact = !props.voiceStage;
  const locked = processing; // Never disable while held/preparing: it would lose the release event.
  const toggleMode = props.tapMode || screenReader;
  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (current) setScreenReader(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (current) setReduceMotion(value); });
    const sr = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const rm = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { current = false; sr.remove(); rm.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion || (!recording && props.speechPhase !== 'speaking')) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start(); return () => animation.stop();
  }, [recording, props.speechPhase, reduceMotion, pulse]);
  useEffect(() => { if (props.text) setTyping(true); }, [props.text]);
  useEffect(() => {
    if (!typing) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [typing]);
  const label = recording ? 'გისმენ' : preparing ? 'მიკროფონს ვამზადებ' : props.phase === 'transcribing' ? 'ვუსმენ შენს ჩანაწერს' : props.busy || (props.speechPhase === 'loading' ? 'ხმოვან პასუხს ვამზადებ' : props.speechPhase === 'speaking' ? 'Medi გპასუხობს' : props.reviewing ? 'შევინახოთ?' : 'მოუყევი Medi-ს');
  const hint = recording ? `${Math.floor(props.duration / 1000)} / 60 წმ · ${toggleMode ? 'დასასრულებლად შეეხე' : 'გაგზავნისთვის აუშვი'}`
    : processing ? 'ერთი წამით, დეტალებს ვამოწმებ' : props.reviewing ? 'თქვი „კი“, „არა“ ან შემისწორე დეტალი'
      : toggleMode ? 'შეეხე დასაწყებად და კიდევ ერთხელ — დასასრულებლად' : 'დააჭირე · თქვი · აუშვი';
  const small = (Icon: typeof Mic, name: string, onPress: () => void, disabled = false, selected = false) => <Pressable accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? C.accent100 : C.bg200, opacity: disabled ? .4 : 1 }}><Icon size={21} color={C.primary100} /></Pressable>;
  if (props.formActive && keyboardOpen && props.formEditing) return <ChatActionDock><View style={{ flexDirection: 'row', gap: 10 }}>
    <Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13 }}>კლავიატურის დახურვა</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={processing} onPress={props.onSave} style={{ flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', opacity: processing ? .5 : 1 }}><Text style={{ color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>{processing ? 'ვამოწმებ…' : 'შენახვა'}</Text></Pressable>
  </View></ChatActionDock>;
  return <ChatActionDock style={props.voiceStage ? { borderTopWidth: 0, backgroundColor: C.bg100 } : undefined}><View style={{ gap: 10 }}>
    {props.voice && !keyboardOpen && !typing ? <>
      <View style={{ alignItems: 'center', gap: 3 }}>
        {recording || preparing || processing || props.speechPhase !== 'idle' ? <Text accessibilityLiveRegion="polite" style={{ color: C.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' }}>{label}</Text> : null}
        <Text style={{ color: C.text200, fontSize: 11, lineHeight: 17, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular' }}>{hint}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        {small(KeyboardIcon, 'ტექსტით გაგრძელება', () => { props.cancel(); setTyping(true); props.onMode(true); }, preparing || recording)}
        <View style={{ width: compact ? 78 : 118, height: compact ? 78 : 118, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', width: compact ? 74 : 112, height: compact ? 74 : 112, borderRadius: 56, borderWidth: 1, borderColor: C.primary100, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [.16, .32] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }} />
          <Pressable testID="assistant-talk-button" accessibilityRole="button" accessibilityLabel={toggleMode ? (recording ? 'ჩაწერის დასრულება და გაგზავნა' : 'საუბრის დაწყება') : 'დააჭირე და გააჩერე საუბრისთვის'}
            accessibilityHint={toggleMode ? 'შეხება იწყებს ჩაწერას, მეორე შეხება აგზავნის.' : 'აშვებისას Medi დაამუშავებს ნათქვამს. მარცხნივ გასრიალება აუქმებს.'} accessibilityState={{ disabled: locked, busy: preparing || processing }} disabled={locked}
            pressRetentionOffset={{ left: 90, right: 45, top: 45, bottom: 45 }}
            onPressIn={toggleMode ? undefined : event => { pressX.current = event.nativeEvent.pageX; canceled.current = false; props.start(); }}
            onPressOut={toggleMode ? undefined : () => { if (!canceled.current) props.release(); pressX.current = null; }}
            onTouchMove={toggleMode ? undefined : event => { if (pressX.current !== null && event.nativeEvent.pageX < pressX.current - 60) { canceled.current = true; props.cancel(); } }}
            onTouchCancel={() => { canceled.current = true; props.cancel(); }}
            onPress={toggleMode ? () => { if (recording || preparing) props.release(); else props.start(); } : undefined}
            style={{ width: compact ? 64 : 96, height: compact ? 64 : 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: recording ? '#BE123C' : '#0F766E', opacity: locked ? .62 : 1, borderWidth: 1, borderColor: recording ? '#E11D48' : '#0D9488' }}>
            {preparing || processing ? <ActivityIndicator color="#FFFFFF" size="large" /> : recording ? <View style={{ flexDirection: 'row', gap: 4, height: 35, alignItems: 'center' }}>{[.35, .65, 1, .75, .45].map((level, index) => <View key={index} style={{ width: 5, borderRadius: 3, height: 8 + level * Math.max(8, Math.min(27, ((props.metering ?? -30) + 60) * .7)), backgroundColor: '#FFFFFF' }} />)}</View> : <Mic size={compact ? 26 : 34} strokeWidth={1.8} color="#FFFFFF" />}
          </Pressable>
        </View>
        {recording || preparing ? small(X, 'ჩანაწერის გაუქმება', props.cancel) : props.speechPhase !== 'idle' ? small(Square, 'ხმოვანი პასუხის შეჩერება', props.stopSpeech) : small(props.muted || !props.voiceOutput ? VolumeX : Volume2, !props.voiceOutput ? 'ხმოვანი პასუხების სტატუსი' : props.muted ? 'ხმოვანი პასუხების ჩართვა' : 'ხმოვანი პასუხების გამორთვა', props.toggleSpeech)}
      </View>
    </> : <View style={{ gap: 8 }}>
      {props.voiceOutput ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }}>
          {props.speechPhase === 'loading' ? <ActivityIndicator size="small" color={C.primary100} /> : <AudioLines size={16} color={C.primary100} />}
          <Text accessibilityLiveRegion="polite" style={{ color: C.text200, fontSize: 11, fontFamily: 'NotoSansGeorgian_400Regular' }}>{props.speechPhase === 'speaking' ? 'Medi გპასუხობს' : props.speechPhase === 'loading' ? 'ხმოვან პასუხს ვამზადებ' : props.muted ? 'ხმა გამორთულია' : 'Medi ხმასაც გაგაგონებს'}</Text>
        </View>
        {props.speechPhase !== 'idle' ? small(Square, 'ხმოვანი პასუხის შეჩერება', props.stopSpeech) : small(props.muted ? VolumeX : Volume2, props.muted ? 'ხმოვანი პასუხების ჩართვა' : 'ხმოვანი პასუხების გამორთვა', props.toggleSpeech)}
      </View> : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        {props.voice ? small(Mic, 'საუბრის ღილაკის გამოჩენა', () => { Keyboard.dismiss(); setTyping(false); props.onMode(false); }, processing) : null}
        <TextInput onFocus={props.onTextFocus} ref={input} accessibilityLabel="შეტყობინება Medi-სთვის" value={props.text} onChangeText={props.onText} editable={!processing} multiline maxLength={4000} placeholder="რას გავაკეთებთ დღეს?" placeholderTextColor={C.text200}
          style={{ flex: 1, minHeight: 46, maxHeight: 110, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: C.bg300, color: C.text100, fontSize: 14, fontFamily: 'NotoSansGeorgian_400Regular' }} />
        <Pressable accessibilityRole="button" accessibilityLabel="შეტყობინების გაგზავნა" disabled={processing || !props.text.trim()} onPress={props.onSend} style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', opacity: processing || !props.text.trim() ? .45 : 1 }}><ArrowUp size={22} color="#FFFFFF" /></Pressable>
      </View>

    </View>}
  </View></ChatActionDock>;
}
