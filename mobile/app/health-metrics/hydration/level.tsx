import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HydrationAppBar } from '@/components/hydration/HydrationChrome';
import { HydrationDrop } from '@/components/hydration/HydrationIcons';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { useHydration } from '@/hooks/useHydration';
import { ka } from '@/i18n/ka';
import { hydrationLevel } from '@/lib/hydration';

const COLORS = { 5: '#14B8A6', 4: '#86EFAC', 3: '#F59E0B', 2: '#FB7185', 1: '#4B5563' } as const;

export default function HydrationLevelScreen() {
  const T = useFigmaHydration();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayMl, goalMl } = useHydration();
  const level = hydrationLevel(todayMl, goalMl);
  const [open, setOpen] = useState<number>(level);

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <HydrationAppBar onBack={() => router.back()} title={ka.hydration.levelTitle} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 24 }}>
        <View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand }}>{ka.hydration.levelN(level)}</Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 32, color: T.textPrimary }}>{ka.hydration.levels[level].title}</Text>
        </View>

        <View style={{ height: 240, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: T.brand,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22 }}>{level}</Text>
          </View>
          <View style={{ width: 40, height: 220, borderRadius: 20, overflow: 'hidden', backgroundColor: T.border, justifyContent: 'flex-end' }}>
            <View style={{ height: `${(level / 5) * 100}%`, backgroundColor: T.brand, borderRadius: 20 }} />
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <View
                key={n}
                style={{
                  position: 'absolute',
                  left: 6,
                  bottom: `${((n - 1) / 4) * 78 + 6}%`,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: n === level ? '#FFFFFF' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {n === level ? <HydrationDrop size={16} color={T.brand} /> : null}
              </View>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary, marginBottom: 12 }}>
            {ka.hydration.whatLevelMeans}
          </Text>
          <View style={{ borderRadius: 16, backgroundColor: T.cardBg, overflow: 'hidden' }}>
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <Pressable key={n} onPress={() => setOpen(n)} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: T.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS[n] }} />
                  <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: T.textPrimary }}>
                    {n}. {ka.hydration.levels[n].title}
                  </Text>
                  <Text style={{ color: T.textTertiary }}>{open === n ? '▴' : '▾'}</Text>
                </View>
                {open === n ? (
                  <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>
                    {ka.hydration.levels[n].body}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary, marginBottom: 12 }}>
            {ka.hydration.howToImprove}
          </Text>
          <View style={{ borderRadius: 16, backgroundColor: T.cardBg, padding: 16, gap: 14 }}>
            {[ka.hydration.tip1, ka.hydration.tip2, ka.hydration.tip3, ka.hydration.tip4].map((tip, i) => (
              <View key={tip} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'NotoSansGeorgian_700Bold' }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: T.textSecondary }}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
