import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { getSymptomSession, loadSymptomHistory, type SavedSymptomSession } from '@/lib/symptomResultStorage';
import { updateSymptomChecker } from '@/lib/symptomCheckerStore';
import { formatDateTime } from '@/lib/format';

export default function SymptomHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SavedSymptomSession[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadSymptomHistory().then((list) => {
        setItems(list);
        setLoading(false);
      });
    }, []),
  );

  const open = async (recordId: string) => {
    let session = await getSymptomSession(recordId);
    if (!session) {
      try {
        const remote = await api.ai.symptomResult(recordId);
        session = {
          recordId,
          createdAt: new Date().toISOString(),
          symptoms: remote.input?.symptoms ?? [],
          durationId: null,
          painLevel: remote.input?.painLevel ?? null,
          bodyPartKa: remote.input?.bodyPartKa,
          organKa: remote.input?.organKa,
          result: remote.result,
        };
      } catch {
        return;
      }
    }
    updateSymptomChecker({
      symptoms: session.symptoms,
      primarySymptom: session.primarySymptom ?? null,
      durationId: session.durationId ?? null,
      painLevel: session.painLevel ?? null,
      result: session.result,
      recordId: session.recordId,
    });
    router.push('/symptoms/results' as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.white, paddingBottom: insets.bottom }}>
      <SymptomNavHeader title={ka.symptoms.historyTitle} onBack={() => router.back()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.brand} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, lineHeight: 26, color: T.textSecondary, textAlign: 'center' }}>{ka.symptoms.historyEmpty}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {items.map((item) => (
            <Pressable
              key={item.recordId}
              onPress={() => open(item.recordId)}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: T.border,
                backgroundColor: T.cardBg,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                ...T.shadowXs,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: T.textPrimary }} numberOfLines={1}>
                  {item.result.conditions[0]?.nameKa ?? ka.symptoms.moduleTitle}
                </Text>
                <Text style={{ fontSize: 13, color: T.textSecondary }} numberOfLines={1}>
                  {item.symptoms.join(', ')}
                </Text>
                <Text style={{ fontSize: 12, color: T.textMuted }}>{formatDateTime(item.createdAt)}</Text>
              </View>
              <ChevronRight size={20} color={T.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
