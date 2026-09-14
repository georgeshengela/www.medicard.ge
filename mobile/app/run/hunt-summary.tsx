import React from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { h } from '@/lib/hunt/copy';
import { clearHunt, useHuntSession } from '@/lib/hunt/store';
import { useThemeColors } from '@/theme/colors';

export default function HuntSummaryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const copy = h('ka');
  const { snap } = useHuntSession();

  const done = () => {
    clearHunt();
    router.replace('/run' as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: insets.top + 24, paddingHorizontal: 20 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, color: colors.text100 }}>{copy.summary}</Text>
      {snap?.simulation || snap?.previewLocal ? (
        <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.primary200 }}>{copy.simBadge}</Text>
      ) : null}
      <View style={{ marginTop: 20, gap: 12 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, color: colors.text200 }}>
          {copy.captured}: {snap?.captures || 0}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, color: colors.text200 }}>
          {copy.walked}: {Math.round(snap?.distanceM || 0)} m
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, color: colors.text200 }}>
          {copy.coinsEarned}: {snap?.previewLocal || snap?.simulation ? 0 : snap?.coins.confirmed || 0}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text300 }}>
          {snap?.qualify.qualified ? copy.qualified : copy.notQualified}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => void Share.share({ message: copy.shareBody })}
        style={{ marginTop: 24, height: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.bg300, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }}>{copy.share}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={done}
        style={{ marginTop: 12, height: 54, borderRadius: 16, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#fff' }}>{copy.done}</Text>
      </Pressable>
    </View>
  );
}
