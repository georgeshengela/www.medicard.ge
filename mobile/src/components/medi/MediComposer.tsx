import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Check, LayoutGrid, Mic, X } from 'lucide-react-native';
import { useChatKeyboardOpen } from '@/components/chat/ChatScreenShell';
import { CHAT_MESSAGE_LIMIT } from '@/lib/analysisFlow';
import type { VoicePhase } from '@/lib/assistantVoiceSession';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { MediOrb } from './MediOrb';
import { CONSILIUM_SPHERE, consiliumInk } from './mediTheme';

export type ComposerVoice = {
  phase: VoicePhase; duration: number;
  start: () => void; release: () => void; cancel: () => void;
};

/**
 * The one input for Medi, the doctor and the consilium. The consilium switch lives on the composer
 * itself (owner: „a toggle in a visible place“): turning it on recolours the whole capsule indigo, so
 * the person always sees which voice will answer before sending.
 */
export function MediComposer({
  value, onChange, onSend, busy, disabled, placeholder, consilium, onConsilium, voice, onMore, accessory,
}: {
  value: string; onChange: (text: string) => void; onSend: () => void;
  busy: boolean; disabled?: boolean; placeholder?: string;
  /** null = consilium is paused from admin: no switch. */
  consilium: boolean; onConsilium: ((on: boolean) => void) | null;
  /** null = no microphone (voice paused or unavailable). */
  voice: ComposerVoice | null;
  onMore: () => void;
  accessory?: React.ReactNode;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useChatKeyboardOpen();
  const ink = consiliumInk(dark);
  const trimmed = value.trim();
  const canSend = trimmed.length >= 2 && trimmed.length <= CHAT_MESSAGE_LIMIT && !busy && !disabled;
  const recording = voice && voice.phase !== 'idle';
  const accent = consilium ? CONSILIUM_SPHERE.core : '#0D9488';

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 10), backgroundColor: c.bg100 }}>
      {accessory}
      <View style={{
        borderRadius: 26, backgroundColor: c.surface, borderWidth: consilium ? 1.5 : 1,
        borderColor: consilium ? ink : c.bg300, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 6,
        shadowColor: consilium ? CONSILIUM_SPHERE.core : '#0F172A', shadowOpacity: consilium ? 0.22 : 0.06,
        shadowRadius: consilium ? 18 : 12, shadowOffset: { width: 0, height: 4 }, elevation: consilium ? 6 : 2,
      }}>
        {recording ? (
          <RecordingRow voice={voice} accent={accent} />
        ) : (
          <>
            <TextInput
              accessibilityLabel={placeholder || tx('შეტყობინება Medi-სთვის', 'Message to Medi')}
              value={value}
              onChangeText={onChange}
              editable={!disabled}
              multiline
              maxLength={CHAT_MESSAGE_LIMIT}
              placeholder={placeholder || (consilium ? tx('აღწერე საკითხი დეტალურად…', 'Describe it in detail…') : tx('ჰკითხე ან სთხოვე Medi-ს…', 'Ask Medi or ask it to do something…'))}
              placeholderTextColor={c.text300}
              style={{ minHeight: 44, maxHeight: 132, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, color: c.text100, fontSize: 15, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={tx('რას აკეთებს Medi', 'What Medi can do')} onPress={onMore} disabled={busy}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg200 }}>
                <LayoutGrid size={18} color={c.text200} />
              </Pressable>
              {onConsilium ? <ConsiliumSwitch on={consilium} onChange={onConsilium} ink={ink} disabled={busy} /> : null}
              <View style={{ flex: 1 }} />
              {voice && !trimmed ? (
                <Pressable accessibilityRole="button" accessibilityLabel={tx('ხმით თქმა', 'Speak')} onPress={voice.start} disabled={busy || disabled}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg200, opacity: busy ? 0.5 : 1 }}>
                  <Mic size={19} color={c.text100} />
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={busy ? tx('Medi პასუხს ამზადებს', 'Medi is preparing a reply') : tx('გაგზავნა', 'Send')}
                accessibilityState={{ disabled: !canSend, busy }} onPress={onSend} disabled={!canSend}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend || busy ? accent : c.bg200 }}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ArrowUp size={20} strokeWidth={2.4} color={canSend ? '#FFFFFF' : c.text300} />}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** A real switch, labelled with what it does — not a mode tab. */
function ConsiliumSwitch({ on, onChange, ink, disabled }: { on: boolean; onChange: (on: boolean) => void; ink: string; disabled?: boolean }) {
  const c = useThemeColors();
  const knob = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(knob, { toValue: on ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [on, knob]);
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on, disabled }} accessibilityLabel={tx('კონსილიუმი', 'Consilium')}
      accessibilityHint={tx('რამდენიმე სპეციალისტის ერთობლივი, ღრმა ანალიზი', 'A joint, in-depth review by several specialists')}
      onPress={() => onChange(!on)} disabled={disabled}
      style={{ height: 40, paddingLeft: 8, paddingRight: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: on ? `${ink}1F` : c.bg200, opacity: disabled ? 0.55 : 1 }}>
      <MediOrb size={20} deep />
      <Text style={{ color: on ? ink : c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('კონსილიუმი', 'Consilium')}</Text>
      <View style={{ width: 30, height: 18, borderRadius: 9, padding: 2, backgroundColor: on ? ink : c.bg300, justifyContent: 'center' }}>
        <Animated.View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', transform: [{ translateX: knob.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }] }} />
      </View>
    </Pressable>
  );
}

function RecordingRow({ voice, accent }: { voice: ComposerVoice; accent: string }) {
  const c = useThemeColors();
  const pulse = useRef(new Animated.Value(0)).current;
  const recording = voice.phase === 'recording';
  useEffect(() => {
    if (!recording) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);
  const seconds = Math.floor((voice.duration || 0) / 1000);
  const label = voice.phase === 'preparing' ? tx('მიკროფონს ვამზადებ…', 'Getting the mic ready…')
    : voice.phase === 'transcribing' ? tx('შენს ნათქვამს ვკითხულობ…', 'Reading what you said…')
    : `${tx('გისმენ', "I'm listening")} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <View accessibilityLiveRegion="polite" style={{ minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx('ჩანაწერის გაუქმება', 'Cancel recording')} onPress={voice.cancel} disabled={voice.phase === 'transcribing'}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg200 }}>
        <X size={20} color={c.text100} />
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        {recording ? <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E11D48', opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }} /> : <ActivityIndicator size="small" color={accent} />}
        <Text style={{ color: c.text100, fontSize: 14, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={tx('ჩაწერის დასრულება და გაგზავნა', 'Stop recording and send')} onPress={voice.release} disabled={!recording}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: accent, opacity: recording ? 1 : 0.45 }}>
        <Check size={20} strokeWidth={2.6} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
