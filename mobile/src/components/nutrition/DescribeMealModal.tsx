import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic, Send, Sparkles, X } from "lucide-react-native";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { useAssistantVoice } from "@/components/assistant/useAssistantVoice";
import { useFeature } from "@/lib/featureFlags";
import { useThemeColors } from "@/theme/colors";
import { hubText } from "@/theme/hub";
import { tx } from '@/i18n/locale';

const EXAMPLES = tx(["ორი ხინკალი და კიტრი-პომიდვრის სალათი", "ერთი ხაჭაპური და ჭიქა მაწონი", "შვრიის ფაფა ბანანით და ყავა რძით"], ["Two khinkali and a cucumber-tomato salad", "One khachapuri and a glass of matsoni", "Oatmeal with banana and coffee with milk"]);

/**
 * Describe a meal in words. Text is typed or dictated with the same
 * hold-to-talk capture Medi uses; the transcript lands in the field so the
 * person can read and edit it before anything is estimated.
 */
export function DescribeMealModal({
  visible,
  owner,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  owner: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (text: string, voice: boolean) => void;
}) {
  const c = useThemeColors();
  const safe = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [dictated, setDictated] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const input = useRef<TextInput>(null);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  useEffect(() => {
    if (!visible) {
      setText("");
      setNotice("");
      setVoiceError("");
      setDictated(false);
    }
  }, [visible]);
  // Dictation uses Medi's speech recognition; while voice is paused from admin the field is typed only.
  const voiceOn = useFeature("voice");
  const capture = useAssistantVoice({
    owner,
    blocked: busy || !visible || !voiceOn,
    beforeStart: () => {
      Keyboard.dismiss();
      setNotice("");
      setVoiceError("");
    },
    onTranscript: (value) => {
      setDictated(true);
      setText((current) => (current.trim() ? `${current.trim()} ${value}` : value));
    },
    onError: setVoiceError,
    onNotice: setNotice,
  });
  const recording = capture.phase === "recording";
  const transcribing = capture.phase === "transcribing" || capture.phase === "preparing";
  const submit = () => {
    const value = text.trim();
    if (value.length < 3 || busy) return;
    Keyboard.dismiss();
    onSubmit(value, dictated);
  };
  const txt = { color: c.text100, fontFamily: "NotoSansGeorgian_400Regular" };
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface, paddingBottom: keyboard ? 12 : Math.max(safe.bottom, 16) }]}>
          <View style={s.head}>
            <View style={[s.badge, { backgroundColor: c.accent100 }]}>
              <Sparkles size={15} color={c.primary100} />
              <Text style={[hubText.small, { color: c.primary100, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>MEDI</Text>
            </View>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17, flex: 1 }]}>{tx("რა მიირთვი?", "What did you eat?")}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={s.iconButton}>
              <X size={20} color={c.text200} />
            </Pressable>
          </View>
          <TextInput
            ref={input}
            accessibilityLabel={tx("კვების აღწერა", "Meal description")}
            placeholder={tx("მაგ. ორი ხინკალი და სალათი", "e.g. two khinkali and a salad")}
            placeholderTextColor={c.text300}
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (!v.trim()) setDictated(false);
            }}
            editable={!busy && !recording}
            multiline
            maxLength={500}
            autoFocus={Platform.OS !== "web"}
            style={[s.input, { backgroundColor: c.bg200, color: c.text100, borderColor: c.bg300 }]}
          />
          {!text && (
            <View style={s.examples}>
              {EXAMPLES.map((example) => (
                <Pressable key={example} accessibilityRole="button" onPress={() => setText(example)} style={[s.example, { backgroundColor: c.bg200 }]}>
                  <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{example}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!!(notice || voiceError || error) && (
            <Text accessibilityRole={error || voiceError ? "alert" : "text"} style={[txt, { fontSize: 12, lineHeight: 19, color: error || voiceError ? c.danger : c.text200 }]}>{error || voiceError || notice}</Text>
          )}
          <View style={s.actions}>
            {voiceOn ? <Pressable
              accessibilityRole="button"
              accessibilityLabel={recording ? tx("ჩაწერა მიმდინარეობს — აუშვი დასასრულებლად", "Recording — release to finish") : tx("დააჭირე და ილაპარაკე", "Press and speak")}
              accessibilityHint={tx("გააჩერე ღილაკი ლაპარაკის დროს", "Hold the button while you speak")}
              disabled={busy || transcribing}
              onPressIn={capture.start}
              onPressOut={capture.release}
              style={[s.mic, { backgroundColor: recording ? "#DC2626" : c.bg200, opacity: busy || transcribing ? 0.5 : 1 }]}
            >
              {transcribing ? <ActivityIndicator color={c.primary200} /> : <Mic size={22} color={recording ? "#FFFFFF" : c.text100} />}
              <Text style={[hubText.link, { color: recording ? "#FFFFFF" : c.text100 }]}>{recording ? tx("ვისმენ…", "Listening…") : transcribing ? tx("ვამუშავებ", "Processing") : tx("თქვი", "Speak")}</Text>
            </Pressable> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx("შეფასება", "Estimate")}
              disabled={busy || text.trim().length < 3}
              onPress={submit}
              style={[s.send, { backgroundColor: "#0F766E", opacity: busy || text.trim().length < 3 ? 0.45 : 1 }]}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Send size={18} color="#FFFFFF" />}
              <Text style={[hubText.link, { color: "#FFFFFF", fontSize: 14 }]}>{busy ? tx("ვითვლი…", "Counting…") : tx("დათვალე", "Count it")}</Text>
            </Pressable>
          </View>
          <Text style={[hubText.small, { color: c.text300 }]}>{tx("ტექსტი (და ხმა, თუ იყენებ) OpenRouter-ის გავლით Google Vertex AI-ს გადაეცემა. შედეგს შენახვამდე გადაამოწმებ.", "Your text (and voice, if you use it) is sent to Google Vertex AI through OpenRouter. You check the result before saving.")}</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: -8 },
  input: { borderRadius: 16, borderWidth: 1, padding: 14, fontSize: 16, minHeight: 84, maxHeight: 160, textAlignVertical: "top", fontFamily: "NotoSansGeorgian_400Regular" },
  examples: { gap: 6 },
  example: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  actions: { flexDirection: "row", gap: 10 },
  mic: { flex: 1, minHeight: 50, borderRadius: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  send: { flex: 1.3, minHeight: 50, borderRadius: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
});
