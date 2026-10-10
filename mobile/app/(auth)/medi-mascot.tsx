import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { MediMascot, type MascotMood } from '@/components/medi/mascot/MediMascot';
import { useMediCheer } from '@/components/medi/mascot/MediCheerToast';
import { AnswerTurn, SavedNod, ThinkingTurn } from '@/components/medi/MediTurns';
import { MediWelcome } from '@/components/medi/MediWelcome';
import { HomeAskMedi } from '@/components/home/HomeAskMedi';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';

const MOODS: { mood: MascotMood; label: string }[] = [
  { mood: 'idle', label: tx('მშვიდად', 'Idle') },
  { mood: 'hello', label: tx('გამარჯობა', 'Hello') },
  { mood: 'laugh', label: tx('სიცილი', 'Laugh') },
  { mood: 'jump', label: tx('ხტუნვა', 'Jump') },
  { mood: 'love', label: tx('გული', 'Love') },
  { mood: 'think', label: tx('ფიქრი', 'Thinking') },
  { mood: 'surprise', label: tx('გაკვირვება', 'Surprise') },
  { mood: 'sad', label: tx('სევდა', 'Sad') },
  { mood: 'sleep', label: tx('ძილი', 'Sleepy') },
  { mood: 'wink', label: tx('ჩაკვრა', 'Wink') },
  { mood: 'yes', label: tx('კი', 'Yes') },
  { mood: 'no', label: tx('არა', 'No') },
  { mood: 'cheer', label: tx('ზეიმი', 'Cheer') },
  { mood: 'dance', label: tx('ცეკვა', 'Dance') },
  { mood: 'walk', label: tx('სიარული', 'Walk') },
  { mood: 'talk', label: tx('საუბარი', 'Talking') },
];

/**
 * Development-only gallery of the Medi mascot (open /medi-mascot in the Expo dev build). Release builds
 * redirect home, so nothing here reaches users.
 */
export default function MediMascotPreview() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<MascotMood>('hello');
  const [key, setKey] = useState(0);
  const [nod, setNod] = useState(1);
  const { cheer, node: cheerNode } = useMediCheer({ bottom: insets.bottom + 16 });
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 20, gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('უკან', 'Back')} onPress={() => router.back()}
            style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
            <ArrowLeft size={20} color={c.text100} />
          </Pressable>
          <Text style={{ color: c.text100, fontSize: 18, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('Medi — მოძრაობები', 'Medi — moves')}</Text>
        </View>
        <View style={{ alignItems: 'center', borderRadius: 22, backgroundColor: c.surface, paddingVertical: 12 }}>
          <MediMascot mood={mood} playKey={key} size={300} giggle />
          <Text style={{ color: c.text300, fontSize: 12, fontFamily: 'NotoSansGeorgian_400Regular' }}>{tx('შეეხე Medi-ს — გაიცინებს', 'Tap Medi — it giggles')}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MOODS.map((m) => (
            <Pressable key={m.mood} accessibilityRole="button" onPress={() => { setMood(m.mood); setKey((k) => k + 1); }}
              style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: m.mood === mood ? '#0D9488' : c.surface }}>
              <Text style={{ color: m.mood === mood ? '#FFFFFF' : c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: c.text200, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('პატარა ზომები', 'Small sizes')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, borderRadius: 22, backgroundColor: c.surface, padding: 16 }}>
          <MediMascot mood="idle" size={44} crop="snug" />
          <MediMascot mood="think" size={56} crop="snug" />
          <MediMascot mood="talk" size={72} crop="snug" />
          <MediMascot mood="sleep" size={96} crop="snug" />
        </View>
        <Text style={{ color: c.text200, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('ადგილები აპში', 'Placements')}</Text>
        <HomeAskMedi onPress={() => undefined} />
        <View style={{ gap: 18, borderRadius: 22, backgroundColor: c.bg100, borderWidth: 1, borderColor: c.bg300, padding: 16 }}>
          <MediWelcome consilium={false} onStarter={() => undefined} />
          <ThinkingTurn label={tx('ვფიქრობ…', 'Thinking…')} deep={false} />
          <AnswerTurn text="" deep={false} streaming onRate={() => undefined} />
          <AnswerTurn text={tx('წნევა 140/90 ითვლება მომატებულად. ', 'A pressure of 140/90 counts as raised. ')} deep={false} streaming onRate={() => undefined} />
          {nod ? <View style={{ paddingLeft: 30 }}><SavedNod key={nod} onDone={() => setNod(0)} /></View> : null}
          <Pressable accessibilityRole="button" onPress={() => setNod((n) => n + 1)} style={{ minHeight: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: c.surface }}>
            <Text style={{ color: c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('შენახვის თავის დაქნევა', 'Saved nod')}</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => cheer(false)} style={{ flex: 1, minHeight: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: c.surface }}>
            <Text style={{ color: c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('დოზა მიღებულია', 'Dose taken')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => cheer(true)} style={{ flex: 1, minHeight: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: c.surface }}>
            <Text style={{ color: c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('ყველა დოზა', 'All doses')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      {cheerNode}
    </View>
  );
}
