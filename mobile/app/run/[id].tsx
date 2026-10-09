import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { RunFinishedView } from '@/components/run/RunFinishedView';
import { Bone } from '@/components/ui/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HUB } from '@/theme/hub';
import { getRunById, type RunSummary } from '@/lib/run/history';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

export default function RunHistoryDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id, video } = useLocalSearchParams<{ id: string; video?: string }>();
  const [run, setRun] = useState<RunSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void getRunById(String(id || '')).then((found) => {
        if (!alive) return;
        if (!found) router.replace('/run' as never);
        else setRun(found);
      });
      return () => {
        alive = false;
      };
    }, [id, router]),
  );

  // A quiet skeleton while the walk loads from the device (never a blank screen).
  if (!run) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, gap: 16 }}>
        <Bone height={44} radius={16} />
        <Bone width={200} height={30} radius={10} />
        <Bone height={330} radius={HUB.cardRadius} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <RunFinishedView
        summary={run}
        title={tx('შენი გასეირნება', 'Your walk')}
        autoVideo={video === '1'}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/run' as never))}
      />
    </View>
  );
}
