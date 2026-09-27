import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Flashlight, FlashlightOff, ScanBarcode, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { useThemeColors } from "@/theme/colors";
import { hubText } from "@/theme/hub";

const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "itf14"] as const;

/**
 * Live barcode viewfinder for packaged products. The camera frame never leaves
 * the phone: only the decoded digits are looked up. A typed code is the
 * fallback when the camera is unavailable or the print is damaged.
 */
export function BarcodeScannerModal({
  visible,
  busy,
  error,
  onClose,
  onCode,
}: {
  visible: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCode: (code: string) => void;
}) {
  const c = useThemeColors();
  const safe = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState("");
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [asked, setAsked] = useState(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!visible) {
      setTorch(false);
      setManual("");
      setAsked(false);
      lastCode.current = null;
    }
  }, [visible]);
  const granted = !!permission?.granted;
  const ask = async () => {
    setAsked(true);
    try {
      await requestPermission();
    } catch {
      /* the sheet shows the manual field either way */
    }
  };
  const handle = (code: string) => {
    const digits = code.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 14 || busy) return;
    const now = Date.now();
    if (lastCode.current && lastCode.current.code === digits && now - lastCode.current.at < 4000) return;
    lastCode.current = { code: digits, at: now };
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onCode(digits);
  };
  const submitManual = () => {
    Keyboard.dismiss();
    handle(manual);
  };
  const txt = { color: "#FFFFFF", fontFamily: "NotoSansGeorgian_400Regular" };
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#030712" }}>
        {granted && foreground && visible ? (
          <CameraView
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={busy ? undefined : (result) => handle(result.data)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[s.top, { paddingTop: safe.top + 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={onClose} style={s.round}>
            <X size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={[hubText.cardTitle, { color: "#FFFFFF", flex: 1, textAlign: "center" }]}>შტრიხკოდის სკანი</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={torch ? "ფანარის გამორთვა" : "ფანარის ჩართვა"} disabled={!granted} onPress={() => setTorch((v) => !v)} style={[s.round, { opacity: granted ? 1 : 0.4 }]}>
            {torch ? <FlashlightOff size={20} color="#FFFFFF" /> : <Flashlight size={20} color="#FFFFFF" />}
          </Pressable>
        </View>
        <View style={s.center} pointerEvents="none">
          <View style={s.frame}>
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <View key={corner} style={[s.corner, s[corner]]} />
            ))}
            {busy && <ActivityIndicator color="#5EEAD4" size="large" />}
          </View>
          <Text style={[txt, s.hint]}>{busy ? "პროდუქტს ვეძებ…" : granted ? "მოათავსე შტრიხკოდი ჩარჩოში" : "კამერა გამორთულია — ჩართე ან აკრიფე კოდი"}</Text>
        </View>
        <View style={[s.bottom, { paddingBottom: Math.max(safe.bottom, 16) }]}>
          {!!error && <Text accessibilityRole="alert" style={[txt, { color: "#FCA5A5", fontSize: 13, lineHeight: 20 }]}>{error}</Text>}
          {!granted && (
            <Pressable accessibilityRole="button" onPress={() => void ask()} style={[s.primary, { backgroundColor: "#0D9488" }]}>
              <ScanBarcode size={18} color="#FFFFFF" />
              <Text style={[hubText.link, { color: "#FFFFFF" }]}>{asked && permission && !permission.canAskAgain ? "ნებართვა პარამეტრებში ჩართე" : "კამერის ჩართვა"}</Text>
            </Pressable>
          )}
          <View style={s.manualRow}>
            <TextInput
              accessibilityLabel="შტრიხკოდის აკრეფა"
              placeholder="ან აკრიფე ციფრები"
              placeholderTextColor="#9CA3AF"
              value={manual}
              onChangeText={(v) => setManual(v.replace(/\D/g, "").slice(0, 14))}
              keyboardType="number-pad"
              returnKeyType="search"
              onSubmitEditing={submitManual}
              style={[s.input, { backgroundColor: "#1F2937", color: "#FFFFFF", borderColor: "#374151" }]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="კოდის ძებნა" disabled={manual.length < 6 || busy} onPress={submitManual} style={[s.go, { backgroundColor: c.primary200, opacity: manual.length < 6 || busy ? 0.45 : 1 }]}>
              <Text style={[hubText.link, { color: "#042F2E" }]}>ძებნა</Text>
            </Pressable>
          </View>
          <Text style={[txt, { fontSize: 11, lineHeight: 17, color: "#9CA3AF" }]}>კამერის კადრი ტელეფონიდან არ იგზავნება. მხოლოდ კოდი მოწმდება Open Food Facts-ის ბაზაში.</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(17,24,39,0.7)", alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  frame: { width: 260, height: 170, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 30, height: 30, borderColor: "#5EEAD4" },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
  hint: { fontSize: 14, lineHeight: 22, textAlign: "center", paddingHorizontal: 30 },
  bottom: { paddingHorizontal: 20, gap: 12, backgroundColor: "rgba(3,7,18,0.85)", paddingTop: 14 },
  primary: { minHeight: 48, borderRadius: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  manualRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 16, minHeight: 48, fontFamily: "NotoSansGeorgian_400Regular" },
  go: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
