import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { RunFinishedView } from '@/components/run/RunFinishedView';
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

  const title = new Date(run.startedAt).toLocaleDateString('ka-GE', { day: 'numeric', month: 'long' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <RunFinishedView
        summary={run}
        title={title}
        headerLeft={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.common.back}
            onPress={() => router.back()}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(15,23,42,0.55)',
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.3} />
          </Pressable>
        }
      />
    </View>
  );
}
