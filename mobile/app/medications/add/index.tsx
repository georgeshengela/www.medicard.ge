import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Pill, ScanLine, Search } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

export default function AddMedicationIntroScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const ink = hubInk('teal', dark);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.bg100 }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: HUB.gutter, gap: 28 }}>
          <View style={{ alignItems: 'center', gap: 20 }}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hubTint(ink, dark),
              }}
            >
              <Pill size={36} color={ink} strokeWidth={1.6} />
            </View>
            <View style={{ gap: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 33, color: c.text100, textAlign: 'center' }}>
                {ka.meds.addIntroTitle}
              </Text>
              <Text style={[hubText.body, { fontSize: 16, lineHeight: 24, color: c.text200, textAlign: 'center' }]}>
                {ka.meds.addIntroBody}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/medications/add/search')}
            style={{
              minHeight: 52,
              borderRadius: HUB.tileRadius,
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

        <View style={{ padding: HUB.gutter, paddingBottom: 32 }}>
          <Pressable
            onPress={() => router.push('/medications/add/search')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              backgroundColor: c.surface,
              borderRadius: HUB.cardRadius,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <View style={[styles.scanTile, { backgroundColor: hubTint(ink, dark) }]}>
              <ScanLine size={21} color={ink} strokeWidth={1.8} />
            </View>
            <Text style={[hubText.cardTitle, { flex: 1, color: c.text100 }]}>{ka.meds.scanWithAi}</Text>
            <ChevronRight size={20} color={c.text300} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = {
  scanTile: {
    width: HUB.tile,
    height: HUB.tile,
    borderRadius: HUB.tileRadius,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
