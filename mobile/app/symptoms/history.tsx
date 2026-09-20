import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';
import { bodyPartById, DURATION_OPTIONS, organById } from '@/constants/symptomCatalog';
import { api } from '@/lib/api';
import { getSymptomSession, loadSymptomHistory, type SavedSymptomSession } from '@/lib/symptomResultStorage';
import { resetSymptomChecker, updateSymptomChecker } from '@/lib/symptomCheckerStore';
import { formatDateTime } from '@/lib/format';

export default function SymptomHistoryScreen() {
  const T = useFigmaSymptoms();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SavedSymptomSession[]>([]);
  const [loading, setLoading] = useState(true);

  const focused = useRef(false);
  const generation = useRef(0);
  const opening = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const ticket = ++generation.current;
      opening.current = false;
      const owner = localAccountId();
      setItems([]);
      setLoading(true);
      void loadSymptomHistory().then((list) => {
        if (!focused.current || ticket !== generation.current || owner !== localAccountId()) return;
        setItems(list);
        setLoading(false);
      });
      return () => { focused.current = false; generation.current++; };
    }, []),
  );

  const open = async (recordId: string) => {
    const owner = localAccountId();
    if (!owner || opening.current) return;
    opening.current = true;
    const ticket = generation.current;
    setError(null);
    const current = () => focused.current && ticket === generation.current && owner === localAccountId();
    try {
      let session = await getSymptomSession(recordId);
      if (!current()) return;
      if (!session) {
        const remote = await api.ai.symptomResult(recordId);
        if (!current()) return;
        const input = remote.input;
        const part = bodyPartById(input?.bodyPartId), organ = organById(input?.organId);
        session = {
          recordId, createdAt: new Date().toISOString(), symptoms: input?.symptoms ?? [],
          primarySymptom: input?.primarySymptom ?? null,
          durationId: DURATION_OPTIONS.find(d => d.labelKa === input?.durationKa)?.id ?? null,
          painLevel: input?.painLevel ?? null, bodyPartKa: input?.bodyPartKa, organKa: input?.organKa,
          result: remote.result,
          draft: { gender: user?.gender === 'FEMALE' ? 'FEMALE' : 'MALE', method: input?.method ?? 'manual', mode: input?.mode === 'organ' ? 'organ' : 'muscle',
            side: part?.side === 'back' || organ?.side === 'back' ? 'back' : 'front',
            selectedPartId: part?.id ?? null, selectedOrganId: organ?.id ?? null,
            pastConditions: '', notes: input?.notes ?? '', shareToNightingale: input?.includeHealthProfile === true },
        };
      }
      if (!current() || !Array.isArray(session.result?.conditions)) return;
      resetSymptomChecker(session.draft?.gender ?? user?.gender);
      updateSymptomChecker({
        ...session.draft, symptoms: session.symptoms,
        primarySymptom: session.symptoms.includes(session.primarySymptom || '') ? session.primarySymptom : session.symptoms[0] ?? null,
        durationId: session.durationId ?? null, painLevel: session.painLevel ?? null,
        result: session.result, recordId: session.recordId,
      });
      router.push('/symptoms/results' as never);
    } catch {
      if (current()) setError('შედეგი ვერ ჩაიტვირთა. სცადე ხელახლა.');
    } finally { if (ticket === generation.current) opening.current = false; }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.white, paddingBottom: insets.bottom }}>
      <SymptomNavHeader title={ka.symptoms.historyTitle} onBack={() => router.back()} />
      {error ? <Text accessibilityRole="alert" style={{ color: T.danger, padding: 16 }}>{error}</Text> : null}
      {loading ? (
        <View style={{ flex: 1, paddingTop: 16 }}>
          <ListRowsSkeleton rows={5} />
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

