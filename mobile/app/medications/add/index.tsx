import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { PenLine, Pill, Search } from 'lucide-react-native';
import { HubLinkRow } from '@/components/home/HubTiles';
import { MedsIconTile } from '@/components/medications/MedsHubUI';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';

/** First step of adding a medication: find it in the catalogue, or type it in by hand. */
export default function AddMedicationIntroScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: ka.meds.addMedicationScreenTitle }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg100 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: HUB.gutter, paddingBottom: Math.max(insets.bottom, 16) + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: 28, paddingVertical: 24 }}>
          <View style={{ alignItems: 'center', gap: 20 }}>
            <MedsIconTile icon={Pill} size={84} iconSize={40} style={{ borderRadius: 26 }} />
            <View style={{ gap: 10, alignItems: 'center' }}>
              <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 33, color: c.text100, textAlign: 'center' }}>
                {ka.meds.addIntroTitle}
              </Text>
              <Text style={[hubText.body, { fontSize: 15, lineHeight: 23, color: c.text200, textAlign: 'center' }]}>
                {tx(
                  'მოძებნე კატალოგში ან ჩაწერე სახელი ხელით — დროზე შეგახსენებთ და ყოველ მიღებას აღვნიშნავთ.',
                  'Find it in the catalogue or type the name yourself — we remind you on time and keep track of every dose.',
                )}
              </Text>
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

        <View style={{ gap: 10 }}>
          <HubLinkRow icon={Search} ink="blue" title={ka.meds.addOptionSearch} detail={ka.meds.addOptionSearchHint} href="/medications/add/search" />
          <HubLinkRow
            icon={PenLine}
            ink="violet"
            title={ka.meds.addCustom}
            detail={tx('კატალოგში თუ ვერ იპოვე', 'If it is not in the catalogue')}
            href="/medications/add/setup"
          />
        </View>
      </ScrollView>
    </>
  );
}
