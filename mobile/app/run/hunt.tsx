import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Shield, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { h, missionLabel } from '@/lib/hunt/copy';
import { huntPublicStatus } from '@/lib/hunt/client';
import { getHuntClient, startHuntPlay } from '@/lib/hunt/store';
import { useIsDark, useThemeColors } from '@/theme/colors';

export default function HuntSetupScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const copy = h('ka');
  const [gentle, setGentle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void huntPublicStatus().then((status) => {
      if (!status || status.schemaReady === false) setNotice(copy.schemaSoon);
      else if (status.enabled === false) setNotice(copy.disabled);
    });
  }, [copy.schemaSoon]);

  const card = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderColor: colors.bg300,
      borderWidth: 1,
      borderRadius: 22,
      padding: 16,
    }),
    [colors],
  );

  const start = async (previewFallback: boolean, simulation?: boolean) => {
    setBusy(true);
    setNotice(null);
    await startHuntPlay({ mode: gentle ? 'gentle' : 'default', simulation, previewFallback });
    const next = getHuntClient();
    setBusy(false);
    if (next.snap) {
      router.push('/run/hunt-active' as never);
      return;
    }
    if (next.error === 'permission') setNotice(copy.permission);
    else if (next.unavailable) setNotice(copy.unavailable);
    else setNotice(copy.schemaSoon);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 40, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color={colors.text100} strokeWidth={2.2} />
          </Pressable>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>{copy.title}</Text>
        </View>

        <View style={{ marginTop: 8, height: 180, borderRadius: 24, overflow: 'hidden', backgroundColor: dark ? '#042F2E' : '#0F766E', padding: 20, justifyContent: 'flex-end' }}>
          <Sparkles size={28} color="#99F6E4" />
          <Text style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: '#fff' }}>{copy.huntTitle}</Text>
          <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.86)' }}>{copy.huntBody}</Text>
        </View>

        <Text style={{ marginTop: 16, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 21, color: colors.text200 }}>{copy.explain}</Text>
        {notice ? (
          <Text style={{ marginTop: 12, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 20, color: colors.primary200 }}>{notice}</Text>
        ) : null}

        <View style={{ marginTop: 16, ...card }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>{copy.dailyMission}</Text>
          <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text200 }}>{missionLabel('capture_2')}</Text>
        </View>

        <View style={{ marginTop: 12, ...card }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>{copy.rewards}</Text>
          <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text200 }}>
            {copy.coinsCapture} 1 · {copy.coinsSession} 5 · {copy.coinsMission} 3 · {copy.coinsCap} 20
          </Text>
          <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>{copy.playAnyway}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setGentle((v) => !v)}
          style={{ marginTop: 12, ...card, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <Shield size={18} color={dark ? '#5EEAD4' : colors.primary100} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>{copy.gentle}</Text>
            <Text style={{ marginTop: 4, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>{copy.gentleHint}</Text>
          </View>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.primary200, backgroundColor: gentle ? '#0D9488' : 'transparent' }} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void start(false)}
          style={{ marginTop: 18, height: 56, borderRadius: 18, backgroundColor: dark ? '#0D9488' : '#0F766E', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#fff' }}>{busy ? copy.preparing : copy.startHunt}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => void start(true)}
          style={{ marginTop: 10, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.text300 }}>{copy.previewStart}</Text>
        </Pressable>
        <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300, textAlign: 'center' }}>{copy.osm}</Text>
      </ScrollView>
    </View>
  );
}
