import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, Text } from 'react-native';
import { Mic } from 'lucide-react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/theme/colors';

export function AssistantEntry({ tabBar }: { tabBar: boolean }) {
  const router = useRouter(), segments = useSegments(), insets = useSafeAreaInsets(), C = useThemeColors();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => { const a = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true)); const b = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false)); return () => { a.remove(); b.remove(); }; }, []);
  // Keep camera, maps, onboarding and conversations clear. Main screens retain one compact entry.
  if (keyboard || ['assistant', '(auth)', 'chat', 'module', 'run', 'medipulsi', 'symptoms'].includes(segments[0]) || segments.includes('chat')) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Medi — ხმოვანი ასისტენტის გახსნა" onPress={() => router.push('/assistant' as never)}
    style={{ position: 'absolute', right: 16, bottom: Math.max(insets.bottom, 12) + (tabBar ? 78 : 10), minHeight: 46, paddingHorizontal: 16, borderRadius: 24,
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.primary100 }}>
    <Mic size={18} color={C.primary100} /><Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: C.primary100 }}>Medi</Text>
  </Pressable>;
}
