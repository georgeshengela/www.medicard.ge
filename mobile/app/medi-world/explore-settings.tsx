import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { exploreCopy } from '@/i18n/world/explore.js';
import { clearExploreAreaCache, clearExploreIntroSeen, getExploreViewPref, setExploreViewPref } from '@/lib/mediWorld/exploreCache';
import { getExplorePermission, type ExplorePermission } from '@/lib/mediWorld/exploreLocation';
import { useMediWorldExploreAvailable } from '@/lib/mediWorld/enabled';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

export default function ExploreSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const enabled = useMediWorldExploreAvailable();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => exploreCopy(locale), [locale]);
  const [permission, setPermission] = useState<ExplorePermission>('undetermined');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [cacheNote, setCacheNote] = useState('');

  useFocusEffect(
    useCallback(() => {
      void getExplorePermission().then(setPermission);
      void getExploreViewPref().then(setView);
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={() => router.back()} className="active:opacity-75" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, color: colors.text100, marginTop: 12 }}>{copy.settings}</Text>

        <Card title={copy.permStatus} body={permission === 'granted' || permission === 'granted_approximate' ? copy.granted : copy.notGranted} />
        <Card title={copy.preciseStatus} body={permission === 'granted' ? copy.precise : permission === 'granted_approximate' ? copy.approximate : copy.notGranted} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: colors.text200, marginTop: 8 }}>{copy.locationExplain}</Text>
        <Card title={copy.enabledStatus} body={enabled ? copy.on : copy.off} />
        <Card title={copy.reducedMotion} body={reduce ? copy.on : copy.off} />

        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} className="active:opacity-75" style={{ marginTop: 16, minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.primary200 }}>{copy.openSettings}</Text>
        </Pressable>

        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100, marginTop: 22 }}>{copy.mapListPref}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Pressable accessibilityRole="button" onPress={() => { setView('map'); void setExploreViewPref('map'); }} className="active:opacity-75" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: view === 'map' ? colors.primary200 : colors.bg300, justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', color: view === 'map' ? colors.primary200 : colors.text200 }}>{copy.mapView}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setView('list'); void setExploreViewPref('list'); }} className="active:opacity-75" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: view === 'list' ? colors.primary200 : colors.bg300, justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', color: view === 'list' ? colors.primary200 : colors.text200 }}>{copy.listView}</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void clearExploreIntroSeen();
            router.replace('/medi-world/explore' as never);
          }}
          className="active:opacity-75"
          style={{ marginTop: 20, minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.primary200 }}>{copy.replaySafety}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await clearExploreAreaCache();
            setCacheNote(copy.cacheDeleted);
          }}
          className="active:opacity-75"
          style={{ marginTop: 8, minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.primary200 }}>{copy.deleteCache}</Text>
        </Pressable>
        {cacheNote ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300, marginTop: 6 }}>{cacheNote}</Text> : null}
      </ScrollView>
    </View>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  return (
    <View style={{ marginTop: 14, borderRadius: QUEST.radius, backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.lightSoft, padding: QUEST.pad }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100 }}>{title}</Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: colors.text200, marginTop: 6 }}>{body}</Text>
    </View>
  );
}
