import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { adventureCopy } from '@/i18n/world/adventure.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import type { AdventurePreferences } from '@/lib/mediWorld/types';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';

const FONT = 1.3;

export default function AdventurePreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => adventureCopy(locale), [locale]);
  const [prefs, setPrefs] = useState<AdventurePreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };

  useEffect(() => {
    void mediWorldApi.adventurePreferences().then((row) => setPrefs(row.preferences)).catch(() => {});
  }, []);

  async function save(patch: Partial<AdventurePreferences>) {
    if (!prefs || busy) return;
    setBusy(true);
    try {
      const next = await mediWorldApi.updateAdventurePreferences({ ...prefs, ...patch });
      setPrefs(next.preferences);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 24) + 32,
          paddingHorizontal: 16,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          onPress={() => router.back()}
          className="active:opacity-75"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={FONT} style={{ ...fontTitle, fontSize: 26, lineHeight: 32, color: colors.text100, marginTop: 16 }}>
          {copy.preferences}
        </Text>

        <Text style={{ ...fontMed, fontSize: 14, color: colors.text300, marginTop: 20 }}>{copy.intensity}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {(['gentle', 'balanced', 'active'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => void save({ intensity: key })}
              className="active:opacity-75"
              style={{
                flex: 1,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: prefs?.intensity === key ? colors.primary200 : colors.bg300,
                backgroundColor: colors.surface,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...fontMed, fontSize: 13, color: colors.text100 }}>{copy[key]}</Text>
            </Pressable>
          ))}
        </View>

        <ToggleRow
          label={copy.allowVariety}
          on={Boolean(prefs?.allowVariety)}
          onPress={() => void save({ allowVariety: !prefs?.allowVariety })}
        />
        <ToggleRow
          label={copy.showTargets}
          on={Boolean(prefs?.showTargets)}
          onPress={() => void save({ showTargets: !prefs?.showTargets })}
        />
        <ToggleRow
          label={copy.reducedPressure}
          on={Boolean(prefs?.reducedPressureLanguage)}
          onPress={() => void save({ reducedPressureLanguage: !prefs?.reducedPressureLanguage })}
        />

        <Text style={{ ...fontMed, fontSize: 14, color: colors.text300, marginTop: 20 }}>{copy.movementMode}</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {([
            ['default', copy.movementDefault],
            ['wheelchair', copy.wheelchair],
            ['low_mobility', copy.lowMobility],
          ] as const).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => void save({ movementMode: key })}
              className="active:opacity-75"
              style={{
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: prefs?.movementMode === key ? colors.primary200 : colors.bg300,
                backgroundColor: colors.surface,
                padding: 14,
              }}
            >
              <Text style={{ ...fontBody, fontSize: 15, color: colors.text100 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ToggleRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-75"
      style={{
        marginTop: 12,
        borderRadius: QUEST.radius,
        borderWidth: 1,
        borderColor: colors.bg300,
        backgroundColor: colors.surface,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, color: colors.text100, flex: 1, paddingRight: 12 }}>
        {label}
      </Text>
      <View
        style={{
          width: 42,
          height: 24,
          borderRadius: 99,
          backgroundColor: on ? colors.primary200 : colors.bg300,
          justifyContent: 'center',
          paddingHorizontal: 3,
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#FFFFFF',
            alignSelf: on ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
    </Pressable>
  );
}
