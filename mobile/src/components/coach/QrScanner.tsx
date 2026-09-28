import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Flashlight, FlashlightOff, QrCode, X } from 'lucide-react-native';
import { hubText } from '@/theme/hub';

/**
 * Full-screen QR viewfinder. The camera frame never leaves the phone — only the decoded text is used.
 * Camera permission is requested only from the button (App Review 5.1.1, AGENTS.md). A pasted link
 * or code is the fallback when the camera is unavailable.
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
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setForeground(st === 'active'));
    return () => sub.remove();
  }, []);
  const granted = Boolean(permission?.granted);
  const handle = (data: string) => {
    if (busy || !data) return;
    const now = Date.now();
    if (last.current && last.current.data === data && now - last.current.at < 4000) return;
    last.current = { data, at: now };
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onScan(data);
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#030712' }}>
      {granted && foreground ? (
        <CameraView facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : (r) => handle(r.data)} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[s.top, { paddingTop: safe.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))} style={s.round}>
          <X size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={[hubText.cardTitle, { color: '#FFFFFF', flex: 1, textAlign: 'center' }]}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'ფანარის გამორთვა' : 'ფანარის ჩართვა'} disabled={!granted} onPress={() => setTorch((v) => !v)} style={[s.round, { opacity: granted ? 1 : 0.4 }]}>
          {torch ? <FlashlightOff size={20} color="#FFFFFF" /> : <Flashlight size={20} color="#FFFFFF" />}
        </Pressable>
      </View>
      <View style={s.center} pointerEvents="none">
        <View style={s.frame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
            <View key={corner} style={[s.corner, s[corner]]} />
          ))}
          {busy ? <ActivityIndicator color="#5EEAD4" size="large" /> : null}
        </View>
        <Text style={s.hint}>{busy ? 'ვამოწმებ…' : granted ? hint : 'კამერა გამორთულია — ჩართე ან ჩასვი ბმული'}</Text>
      </View>
      <View style={[s.bottom, { paddingBottom: Math.max(safe.bottom, 16) }]}>
        {error ? <Text accessibilityRole="alert" style={[s.hint, { color: '#FCA5A5', textAlign: 'left' }]}>{error}</Text> : null}
        {footer}
        {!granted ? (
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              setAsked(true);
              await requestPermission().catch(() => undefined);
            }}
            style={s.primary}
          >
            <QrCode size={18} color="#FFFFFF" />
            <Text style={[hubText.link, { color: '#FFFFFF' }]}>{asked && permission && !permission.canAskAgain ? 'კამერის ნებართვა პარამეტრებში ჩართე' : 'კამერის ჩართვა'}</Text>
          </Pressable>
        ) : null}
        <View style={s.manualRow}>
          <TextInput
            accessibilityLabel="ბმულის ან კოდის ჩასმა"
            placeholder="ან ჩასვი ბმული / კოდი"
            placeholderTextColor="#9CA3AF"
            value={manual}
            onChangeText={setManual}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => handle(manual.trim())}
            style={s.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="შემოწმება" disabled={!manual.trim() || busy} onPress={() => handle(manual.trim())} style={[s.go, { opacity: !manual.trim() || busy ? 0.45 : 1 }]}>
            <Text style={[hubText.link, { color: '#042F2E' }]}>OK</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(17,24,39,0.7)', alignItems: 'center', justifyContent: 'center' },
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
  go: { minWidth: 64, borderRadius: 14, backgroundColor: '#14B8A6', alignItems: 'center', justifyContent: 'center' },
});
