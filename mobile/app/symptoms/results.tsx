import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { List, Phone, Plus } from 'lucide-react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { SymptomCta, SymptomFooter } from '@/components/symptoms/SymptomCta';
import { SymptomGradientHeader } from '@/components/symptoms/SymptomGradientHeader';
import { SymptomResultSummaryCard } from '@/components/symptoms/SymptomResultSummaryCard';
import { SYMPTOM_INTRO_ILLUSTRATION } from '@/constants/symptomAssets';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { DURATION_OPTIONS, PAIN_LEVELS } from '@/constants/symptomCatalog';
import { ka } from '@/i18n/ka';
import { useSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';
import type { SymptomRisk } from '@/types/symptoms';

const FILTERS = ['all', 'high', 'medium', 'low'] as const;

export default function SymptomResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ready } = useLocalSearchParams<{ ready?: string }>();
  const { user } = useAuth();
  const state = useSymptomChecker();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [showReady, setShowReady] = useState(ready === '1');
  const firstName = user?.fullName?.split(' ')[0] ?? '';

  if (!state.result) return <Redirect href="/symptoms" />;

  const duration = DURATION_OPTIONS.find((d) => d.id === state.durationId)?.labelKa;
  const pain = PAIN_LEVELS.find((p) => p.level === state.painLevel)?.labelKa;
  const emergency = state.result.urgency === 'emergency';
  const list =
    filter === 'all' ? state.result.conditions : state.result.conditions.filter((c) => c.risk === filter);
  const highCount = state.result.conditions.filter((c) => c.risk === 'high').length;
  const treatCount = state.result.conditions.filter((c) => c.risk === 'high' || c.risk === 'medium').length;

  if (showReady) {
    return (
      <View style={{ flex: 1, backgroundColor: T.white, paddingBottom: insets.bottom }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ height: 311, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={SYMPTOM_INTRO_ILLUSTRATION} style={{ width: 320, height: 320 }} resizeMode="contain" />
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, lineHeight: 22, color: T.textMuted, textAlign: 'center' }}>
              {ka.symptoms.possibleCount(state.result.conditions.length)}
            </Text>
            <Text
              style={{
                marginTop: 20,
                fontSize: 30,
                lineHeight: 38,
                fontWeight: '700',
                color: T.textPrimary,
                textAlign: 'center',
                letterSpacing: -0.25,
              }}
            >
              {ka.symptoms.resultTitle(firstName)}
            </Text>
            <Text style={{ marginTop: 12, fontSize: 16, lineHeight: 26, color: T.textSecondary, textAlign: 'center' }}>
              {ka.symptoms.resultSubtitle}
            </Text>
            <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <List size={24} color={T.textSecondary} strokeWidth={1.8} />
                <Text style={{ fontSize: 14, lineHeight: 22, color: T.textSecondary }}>{ka.symptoms.highRiskCount(highCount)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Plus size={24} color={T.textSecondary} strokeWidth={1.8} />
                <Text style={{ fontSize: 14, lineHeight: 22, color: T.textSecondary }}>{ka.symptoms.needsTreatmentCount(treatCount)}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ padding: 16 }}>
          <SymptomCta label={ka.symptoms.seeResult} onPress={() => setShowReady(false)} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.cardBg, paddingBottom: insets.bottom }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SymptomGradientHeader
          title={ka.symptoms.possibleConditionTitle}
          subtitle={ka.symptoms.possibleConditionSubtitle}
          onBack={() => router.back()}
        >
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <SymptomResultSummaryCard
              symptoms={state.symptoms}
              durationLabel={duration}
              painLabel={pain}
              onEdit={() => router.push('/symptoms/details' as never)}
            />
          </View>
        </SymptomGradientHeader>

        {emergency ? (
          <View style={{ marginHorizontal: 16, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF1F2', borderRadius: 12, padding: 12 }}>
            <Phone size={18} color={T.danger} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.danger }}>{ka.symptoms.emergencyBanner}</Text>
          </View>
        ) : null}

        <Text style={{ marginHorizontal: 16, marginTop: 20, marginBottom: 8, fontSize: 16, lineHeight: 26, color: T.textSecondary }}>
          {state.result.summaryKa}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}>
          {FILTERS.map((key) => {
            const on = filter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                style={{
                  minHeight: 36,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: on ? T.brand : T.borderTertiary,
                  backgroundColor: on ? T.brandSoft : T.white,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: on ? T.brand : T.textPrimary }}>{ka.symptoms.filters[key]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ padding: 16, gap: 12 }}>
          {list.length === 0 ? (
            <Text style={{ fontSize: 14, lineHeight: 22, color: T.textSecondary, textAlign: 'center', paddingVertical: 24 }}>
              {ka.symptoms.filterEmpty}
            </Text>
          ) : null}
          {list.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/symptoms/condition/${c.id}` as never)}
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: T.border,
                backgroundColor: T.white,
                padding: 16,
                ...T.shadowXs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.textPrimary, paddingRight: 8 }}>{c.nameKa}</Text>
                <RiskBadge risk={c.risk} />
              </View>
              <View style={{ height: 8, borderRadius: 99, backgroundColor: T.cardBg, overflow: 'hidden', marginTop: 12 }}>
                <View style={{ width: `${c.likelihood}%`, height: '100%', backgroundColor: riskColor(c.risk), borderRadius: 99 }} />
              </View>
              <Text style={{ marginTop: 8, fontSize: 13, color: T.textSecondary }}>{ka.symptoms.likelihood(c.likelihood)}</Text>
              {c.overviewKa ? (
                <Text numberOfLines={2} style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
                  {c.overviewKa}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Disclaimer />
        </View>
      </ScrollView>

      <SymptomFooter>
        <SymptomCta
          label={ka.symptoms.talkDoctor}
          onPress={() =>
            router.push(`/chat/doctor?prefill=${encodeURIComponent(state.symptoms.join(', '))}` as never)
          }
        />
        <Pressable onPress={() => router.replace('/symptoms/history' as never)} style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: T.brand }}>{ka.symptoms.viewHistory}</Text>
        </Pressable>
      </SymptomFooter>
    </View>
  );
}

function riskColor(risk: SymptomRisk) {
  if (risk === 'high') return T.danger;
  if (risk === 'medium') return T.warning;
  return T.success;
}

function RiskBadge({ risk }: { risk: SymptomRisk }) {
  return (
    <View style={{ backgroundColor: `${riskColor(risk)}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: riskColor(risk) }}>{ka.symptoms.risk[risk]}</Text>
    </View>
  );
}

