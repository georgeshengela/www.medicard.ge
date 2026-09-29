import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PauseCircle } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { useHideTabChromeWhile } from '@/components/navigation/tabChrome';
import { FEATURE_LABELS, featureForPath, featureMessage, isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

/**
 * Covers a screen whose module an admin paused (admin „მოდულები“). Entries are already hidden
 * on Home / Explore / Profile; this catches deep links, notification taps and screens that
 * were open when the switch flipped. The screen underneath stays mounted, so turning the module
 * back on reveals it again without a reload.
 */
export function ModuleGate() {
  const segments = useSegments() as string[];
  const flags = useFeatureState();
  const key = featureForPath(segments);
  const paused = key != null && !isFeatureOn(key, flags);
  useHideTabChromeWhile(paused);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const dark = useIsDark();

  if (!paused || !key) return null;
  const ink = hubInk('amber', dark);
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  return (
    <View
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, s.wrap, { backgroundColor: c.bg100, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <View style={[s.tile, { backgroundColor: hubTint(ink, dark) }]}>
          <PauseCircle size={24} color={ink} strokeWidth={1.8} />
        </View>
        <Text accessibilityRole="header" style={[hubText.cardTitle, { color: c.text100, fontSize: 18, lineHeight: 26 }]}>
          {tx(`${FEATURE_LABELS[key]} დროებით შეჩერებულია`, `${FEATURE_LABELS[key]} is paused for now`)}
        </Text>
        <Text accessibilityRole="alert" style={[hubText.body, { color: c.text200, fontSize: 14, lineHeight: 22 }]}>
          {featureMessage(key, flags)}
        </Text>
        <Button label={tx('მთავარზე დაბრუნება', 'Back to Home')} onPress={() => router.replace('/(tabs)/home')} />
        {router.canGoBack() ? <Button label={tx('უკან', 'Back')} variant="secondary" onPress={leave} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { zIndex: 50, justifyContent: 'center', paddingHorizontal: HUB.gutter },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: HUB.cardRadius, padding: 22, gap: 14 },
  tile: { width: 48, height: 48, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
});
