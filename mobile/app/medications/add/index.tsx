import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Pill, ScanLine, Search } from 'lucide-react-native';
import { HubLinkRow } from '@/components/home/HubTiles';
import { MedsIconTile } from '@/components/medications/MedsHubUI';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';

/** First step of adding a medication: pick how to find it. */
export default function AddMedicationIntroScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top + 8 }}>
        <View style={{ paddingHorizontal: HUB.gutter - 4 }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/medications'))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={ka.common.back}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={22} color={c.text100} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: HUB.gutter, gap: 28 }}>
          <View style={{ alignItems: 'center', gap: 20 }}>
            <MedsIconTile icon={Pill} ink="teal" size={84} iconSize={40} style={{ borderRadius: 26 }} />
            <View style={{ gap: 10, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 33, color: c.text100, textAlign: 'center' }}>
                {ka.meds.addIntroTitle}
              </Text>
              <Text style={[hubText.body, { fontSize: 15, lineHeight: 23, color: c.text200, textAlign: 'center' }]}>{ka.meds.addIntroBody}</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="search"
            accessibilityLabel={ka.meds.addIntroSearchPlaceholder}
            onPress={() => router.push('/medications/add/search')}
            style={{
              minHeight: 54,
              borderRadius: HUB.tileRadius + 2,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              gap: 10,
              backgroundColor: c.surface,
            }}
          >
            <Search size={20} color={c.text300} strokeWidth={2} />
            <Text style={[hubText.body, { flex: 1, fontSize: 16, color: c.text300 }]}>{ka.meds.addIntroSearchPlaceholder}</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: HUB.gutter, paddingBottom: Math.max(insets.bottom, 16) + 12, gap: 10 }}>
          <HubLinkRow icon={Search} ink="teal" title={ka.meds.addOptionSearch} detail={ka.meds.addOptionSearchHint} href="/medications/add/search" />
          <HubLinkRow icon={ScanLine} ink="sky" title={ka.meds.scanWithAi} detail={ka.meds.addOptionScanHint} href="/medications/add/search" />
        </View>
      </View>
    </>
  );
}
