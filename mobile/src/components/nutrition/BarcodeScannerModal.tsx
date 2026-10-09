import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Flashlight, FlashlightOff, ScanBarcode, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { useThemeColors } from "@/theme/colors";
import { hubText } from "@/theme/hub";
import { tx } from '@/i18n/locale';
import { onReturnToForeground } from "@/lib/appForeground";

const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "itf14"] as const;

/**
 * Live barcode viewfinder for packaged products. The camera frame never leaves
 * the phone: only the decoded digits are looked up. A typed code is the
 * fallback when the camera is unavailable or the print is damaged.
 *
 * Camera permission is requested only from the button (App Review 5.1.1(iv)). Until the system question
 * was answered the sheet is a primer: one „გაგრძელება“ button, no close, no alternatives. After a „no“
 * the OS will not ask again, so the button opens Settings.
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
  const [permission, requestPermission, readPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState("");
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [asked, setAsked] = useState(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);
  // Fresh answer on every open and back from Settings (a read, never a request): a camera turned on
  // there works at once, and a „no“ given elsewhere in the app shows the Settings button.
  useEffect(() => {
    if (!visible) return;
    void readPermission().catch(() => undefined);
    return onReturnToForeground(() => void readPermission().catch(() => undefined));
  }, [visible, readPermission]);
  useEffect(() => {
    if (!visible) {
      setTorch(false);
      setManual("");
      setAsked(false);
      lastCode.current = null;
    }
  }, [visible]);
  const granted = !!permission?.granted;
  // Primer until the OS question was answered once (then close, typing the code and Settings are fine).
  const primer = !granted && !asked && (!permission || permission.status === "undetermined");
  // Answered „no“ and the OS will not show its sheet again: only Settings can turn the camera on.
  const blocked = !granted && !!permission && permission.canAskAgain === false;
  const ask = async () => {
    if (blocked) {
      void Linking.openSettings().catch(() => undefined);
      return;
    }
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
          {primer ? (
            <View style={s.round0} />
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={s.round}>
              <X size={22} color="#FFFFFF" />
            </Pressable>
          )}
          <Text style={[hubText.cardTitle, { color: "#FFFFFF", flex: 1, textAlign: "center" }]}>{tx("შტრიხკოდის სკანი", "Scan barcode")}</Text>
          {primer ? (
            <View style={s.round0} />
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={torch ? tx("ფანარის გამორთვა", "Turn off flashlight") : tx("ფანარის ჩართვა", "Turn on flashlight")} disabled={!granted} onPress={() => setTorch((v) => !v)} style={[s.round, { opacity: granted ? 1 : 0.4 }]}>
              {torch ? <FlashlightOff size={20} color="#FFFFFF" /> : <Flashlight size={20} color="#FFFFFF" />}
            </Pressable>
          )}
        </View>
        <View style={s.center} pointerEvents="none">
          <View style={s.frame}>
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <View key={corner} style={[s.corner, s[corner]]} />
            ))}
            {busy && <ActivityIndicator color="#6EE7B7" size="large" />}
          </View>
          <Text style={[txt, s.hint]}>
            {busy
              ? tx("პროდუქტს ვეძებ…", "Looking up the product…")
              : granted
                ? tx("მოათავსე შტრიხკოდი ჩარჩოში", "Place the barcode inside the frame")
                : blocked
                  ? tx("კამერა გამორთულია — ჩართე პარამეტრებში ან აკრიფე კოდი", "Camera is off — turn it on in Settings or type the code")
                  : tx("შტრიხკოდის წასაკითხად კამერა გჭირდება.", "You need the camera to read the barcode.")}
          </Text>
        </View>
        <View style={[s.bottom, { paddingBottom: Math.max(safe.bottom, 16) }]}>
          {!!error && <Text accessibilityRole="alert" style={[txt, { color: "#FCA5A5", fontSize: 13, lineHeight: 20 }]}>{error}</Text>}
          {!granted && (
            <Pressable accessibilityRole="button" onPress={() => void ask()} style={[s.primary, { backgroundColor: '#047857' }]}>
              <ScanBarcode size={18} color="#FFFFFF" />
              <Text style={[hubText.link, { color: "#FFFFFF" }]}>{blocked ? tx("ნებართვა პარამეტრებში ჩართე", "Allow it in Settings") : tx("გაგრძელება", "Continue")}</Text>
            </Pressable>
          )}
          {primer ? null : (
          <View style={s.manualRow}>
            <TextInput
              accessibilityLabel={tx("შტრიხკოდის აკრეფა", "Type barcode")}
              placeholder={tx("ან აკრიფე ციფრები", "Or type the digits")}
              placeholderTextColor="#9CA3AF"
              value={manual}
              onChangeText={(v) => setManual(v.replace(/\D/g, "").slice(0, 14))}
              keyboardType="number-pad"
              returnKeyType="search"
              onSubmitEditing={submitManual}
              style={[s.input, { backgroundColor: "#1F2937", color: "#FFFFFF", borderColor: "#374151" }]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={tx("კოდის ძებნა", "Search code")} disabled={manual.length < 6 || busy} onPress={submitManual} style={[s.go, { backgroundColor: '#6EE7B7', opacity: manual.length < 6 || busy ? 0.45 : 1 }]}>
              <Text style={[hubText.link, { color: '#022C22' }]}>{tx("ძებნა", "Search")}</Text>
            </Pressable>
          </View>
          )}
          <Text style={[txt, { fontSize: 11, lineHeight: 17, color: "#9CA3AF" }]}>{tx("კამერის კადრი ტელეფონიდან არ იგზავნება. მხოლოდ კოდი მოწმდება Open Food Facts-ის ბაზაში.", "The camera image never leaves your phone. Only the code is checked in the Open Food Facts database.")}</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(17,24,39,0.7)", alignItems: "center", justifyContent: "center" },
  round0: { width: 44, height: 44 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  frame: { width: 260, height: 170, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 30, height: 30, borderColor: "#6EE7B7" },
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
