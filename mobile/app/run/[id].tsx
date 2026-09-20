import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { RunFinishedView } from '@/components/run/RunFinishedView';
import { IconButton } from '@/components/run/PulseUi';
import { ka } from '@/i18n/ka';
import { getRunById, type RunSummary } from '@/lib/run/history';
import { useThemeColors } from '@/theme/colors';

export default function RunHistoryDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
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

  if (!run) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <RunFinishedView
        summary={run}
        title="შენი გასეირნება"
        headerLeft={
          <IconButton label={ka.common.back} icon={ArrowLeft} onPress={() => router.back()} />
        }
      />
    </View>
  );
}
