import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Flashlight, FlashlightOff, QrCode, X } from 'lucide-react-native';
import { hubText } from '@/theme/hub';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useKeyboardPad } from '@/components/ui/KeyboardFormShell';
import { tx } from '@/i18n/locale';

/**
 * Full-screen QR viewfinder. The camera frame never leaves the phone — only the decoded text is used.
 * Camera permission is requested only from the button (App Review 5.1.1, AGENTS.md). Until the system
 * question is answered the screen is a primer: one „გაგრძელება“ button, no close, no alternatives.
 * Afterwards a pasted link or code is the fallback when the camera is unavailable.
 */
export function QrScanner({ title, hint, busy, error, onScan, footer }: { title: string; hint: string; busy?: boolean; error?: string | null; onScan: (data: string) => void; footer?: React.ReactNode }) {
  const router = useRouter();
  const safe = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [asked, setAsked] = useState(false);
  const last = useRef<{ data: string; at: number } | null>(null);
  const keyboard = useKeyboardPad(Math.max(safe.bottom, 16));
  // Worklets may capture only the shared value — never `keyboard` (it holds a view ref; crashes on UI thread).
  const keyboardPad = keyboard.pad;
  const bottomStyle = useAnimatedStyle(() => ({ paddingBottom: keyboardPad.value }));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setForeground(st === 'active'));
    return () => sub.remove();
  }, []);
  const granted = Boolean(permission?.granted);
  // Primer until the OS question was answered once (then close/manual/settings are fine).
  const primer = !granted && !asked && (!permission || permission.status === 'undetermined');
  const blocked = !granted && Boolean(permission) && permission?.canAskAgain === false;
  const handle = (data: string) => {
    if (busy || !data) return;
    const now = Date.now();
    if (last.current && last.current.data === data && now - last.current.at < 4000) return;
    last.current = { data, at: now };
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onScan(data);
  };
  return (
    <View ref={keyboard.frameRef} onLayout={keyboard.onLayout} style={{ flex: 1, backgroundColor: '#030712' }}>
      {granted && foreground ? (
        <CameraView facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : (r) => handle(r.data)} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[s.top, { paddingTop: safe.top + 8 }]}>
        {primer ? <View style={s.round0} /> : (
          <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))} style={s.round}>
            <X size={22} color="#FFFFFF" />
          </Pressable>
        )}
        <Text style={[hubText.cardTitle, { color: '#FFFFFF', flex: 1, textAlign: 'center' }]}>{title}</Text>
        {granted ? (
          <Pressable accessibilityRole="button" accessibilityLabel={torch ? tx('ფანარის გამორთვა', 'Turn off flashlight') : tx('ფანარის ჩართვა', 'Turn on flashlight')} onPress={() => setTorch((v) => !v)} style={s.round}>
            {torch ? <FlashlightOff size={20} color="#FFFFFF" /> : <Flashlight size={20} color="#FFFFFF" />}
          </Pressable>
        ) : <View style={s.round0} />}
      </View>
      <View style={s.center} pointerEvents="none">
        <View style={s.frame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
            <View key={corner} style={[s.corner, s[corner]]} />
          ))}
          {busy ? <ActivityIndicator color="#5EEAD4" size="large" /> : null}
        </View>
        <Text style={s.hint}>{busy
            ? tx('ვამოწმებ…', 'Checking…')
            : granted
              ? hint
              : primer
                ? tx('QR კოდის წასაკითხად კამერა გჭირდება. კადრი ტელეფონს არ ტოვებს — მხოლოდ კოდის ტექსტი გამოიყენება.', 'You need the camera to read the QR code. The image never leaves your phone — only the code’s text is used.')
                : tx('კამერა გამორთულია — ჩართე პარამეტრებში ან ჩასვი ბმული', 'Camera is off — turn it on in Settings or paste a link')}</Text>
      </View>
      <Animated.View style={[s.bottom, bottomStyle]}>
        {error ? <Text accessibilityRole="alert" style={[s.hint, { color: '#FCA5A5', textAlign: 'left' }]}>{error}</Text> : null}
        {primer ? null : footer}
        {!granted ? (
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              if (blocked) {
                void Linking.openSettings().catch(() => undefined);
                return;
              }
              setAsked(true);
              await requestPermission().catch(() => undefined);
            }}
            style={s.primary}
          >
            <QrCode size={18} color="#FFFFFF" />
            <Text style={[hubText.link, { color: '#FFFFFF' }]}>{blocked ? tx('პარამეტრების გახსნა', 'Open Settings') : tx('გაგრძელება', 'Continue')}</Text>
          </Pressable>
        ) : null}
        {primer ? null : (
        <View style={s.manualRow}>
          <TextInput
            accessibilityLabel={tx('ბმულის ან კოდის ჩასმა', 'Paste a link or code')}
            placeholder={tx('ან ჩასვი ბმული / კოდი', 'Or paste a link / code')}
            placeholderTextColor="#9CA3AF"
            value={manual}
            onChangeText={setManual}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => handle(manual.trim())}
            style={s.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={tx('შემოწმება', 'Check')} disabled={!manual.trim() || busy} onPress={() => handle(manual.trim())} style={[s.go, { opacity: !manual.trim() || busy ? 0.45 : 1 }]}>
            <Text style={[hubText.link, { color: '#FFFFFF' }]}>OK</Text>
          </Pressable>
        </View>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(17,24,39,0.7)', alignItems: 'center', justifyContent: 'center' },
  round0: { width: 44, height: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: { width: 250, height: 250, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: '#5EEAD4' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  hint: { color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'center', paddingHorizontal: 24 },
  bottom: { paddingHorizontal: 16, gap: 10, backgroundColor: 'rgba(3,7,18,0.82)', paddingTop: 14 },
  primary: { minHeight: 52, borderRadius: 16, backgroundColor: '#0D9488', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  manualRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#1F2937', color: '#FFFFFF', borderWidth: 1, borderColor: '#374151', fontFamily: 'NotoSansGeorgian_400Regular' },
  go: { minWidth: 64, borderRadius: 14, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
});
