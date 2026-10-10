import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeMediOrb } from '@/components/home/HomeMediOrb';
import { MediMascot, type MascotMood } from '@/components/medi/mascot/MediMascot';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { useHomeAccent } from '@/theme/homeAccent';
import { useFeature } from '@/lib/featureFlags';

const HELLO_DAY_KEY = 'medi.mascot.helloDay';
const localDay = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Medi on Home: asleep 23:00–06:00, waves hello on the first Home of the day, otherwise idles and blinks. */
function useHomeMediMood(): MascotMood {
  const [hello, setHello] = useState(false);
  const hour = new Date().getHours();
  const night = hour >= 23 || hour < 6;
  useEffect(() => {
    if (night) return;
    let alive = true;
    const today = localDay();
    AsyncStorage.getItem(HELLO_DAY_KEY)
      .then((seen) => {
        if (!alive || seen === today) return;
        setHello(true);
        return AsyncStorage.setItem(HELLO_DAY_KEY, today);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [night]);
  return night ? 'sleep' : hello ? 'hello' : 'idle';
}

/**
 * One line to Medi. Reads as an input, behaves as a door: tapping anywhere
 * opens the conversation canvas, where voice and typing both live. Medi itself stands at its start.
 */
export function HomeAskMedi({ onPress }: { onPress: () => void }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const voice = useFeature('voice');
  const mood = useHomeMediMood();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx('Medi — ჰკითხე, ჩაწერე ან დაგეგმე', 'Medi — ask, log or plan')}
      onPress={onPress}
      style={[s.bar, { backgroundColor: c.surface, borderColor: c.bg300 }]}
    >
      <MediMascot mood={mood} size={46} crop="snug" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[s.placeholder, { color: c.text100 }]}>
          {tx('ჰკითხე Medi-ს', 'Ask Medi')}
        </Text>
        <Text numberOfLines={1} style={[s.hint, { color: c.text300 }]}>
          {voice ? tx('ხმით ან ტექსტით', 'By voice or text') : tx('ტექსტით', 'By text')}
        </Text>
      </View>
      <HomeMediOrb size={46} background={accent.soft} ringColor={accent.ring} iconColor={accent.ink} voice={voice} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 30,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 7,
    minHeight: 60,
  },
  placeholder: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
  },
  hint: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 11,
    lineHeight: 15,
  },
});
