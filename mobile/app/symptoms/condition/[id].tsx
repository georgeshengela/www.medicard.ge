import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Bookmark, Heart, List, Pill, Target } from 'lucide-react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { SymptomCta, SymptomFooter } from '@/components/symptoms/SymptomCta';
import { SymptomGradientHeader } from '@/components/symptoms/SymptomGradientHeader';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { useSymptomChecker } from '@/lib/symptomCheckerStore';

type Tab = 'overview' | 'treatment';

export default function SymptomConditionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { result } = useSymptomChecker();
  const [tab, setTab] = useState<Tab>('overview');
  const condition = result?.conditions.find((c) => c.id === id);

  if (!result) return <Redirect href="/symptoms" />;
  if (!condition) return <Redirect href="/symptoms/results" />;

  const riskLevel = condition.risk === 'high' ? 7 : condition.risk === 'medium' ? 4 : 2;

  return (
    <View style={{ flex: 1, backgroundColor: T.cardBg, paddingBottom: insets.bottom }}>
      <SymptomGradientHeader
        compact
        title={condition.nameKa}
        onBack={() => router.back()}
        trailing={
          <Pressable hitSlop={12} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Bookmark size={22} color={T.textPrimary} strokeWidth={2} />
          </Pressable>
        }
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Badge icon={AlertTriangle} label={ka.symptoms.riskLevel(riskLevel)} />
        <Badge icon={Heart} label={condition.needsTreatment ? ka.symptoms.needsTreatment : ka.symptoms.selfManage} />
        <Badge icon={Target} label={`${condition.likelihood}%`} />
      </View>

      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.white }}>
        <TabBtn active={tab === 'overview'} icon={List} label={ka.symptoms.overview} onPress={() => setTab('overview')} />
        <TabBtn active={tab === 'treatment'} icon={Pill} label={ka.symptoms.treatment} onPress={() => setTab('treatment')} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {tab === 'overview' ? (
          <View style={{ gap: 16 }}>
            <Card>
              <Text style={styles.kicker}>{ka.symptoms.match}</Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: T.brand }}>{condition.likelihood}%</Text>
              <View style={{ height: 8, borderRadius: 99, backgroundColor: T.cardBg, overflow: 'hidden', marginTop: 12 }}>
                <View style={{ width: `${condition.likelihood}%`, height: '100%', backgroundColor: T.brand }} />
              </View>
              <Text style={{ marginTop: 10, fontSize: 14, lineHeight: 22, color: T.textSecondary }}>
                {ka.symptoms.likelihoodHint(condition.likelihood)}
              </Text>
            </Card>
            <Section title={ka.symptoms.overview}>
              <Text style={styles.body}>{condition.overviewKa}</Text>
            </Section>
            <Section title={ka.symptoms.severity}>
              <Text style={styles.body}>{condition.severityKa} · {ka.symptoms.levelOutOf(condition.severityLevel)}</Text>
            </Section>
            {condition.symptomsKa.length ? (
              <Section title={ka.symptoms.relatedSymptoms}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {condition.symptomsKa.map((s) => (
                    <View key={s} style={chip}>
                      <Text style={{ fontSize: 13, color: T.textPrimary }}>{s}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}
            {condition.causesKa.length ? (
              <Section title={ka.symptoms.causes}>
                {condition.causesKa.map((item) => (
                  <Text key={item} style={[styles.body, { marginBottom: 6 }]}>• {item}</Text>
                ))}
              </Section>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {condition.selfCareKa.length ? (
              <Section title={ka.symptoms.selfCare}>
                {condition.selfCareKa.map((item) => (
                  <Text key={item} style={[styles.body, { marginBottom: 6 }]}>• {item}</Text>
                ))}
              </Section>
            ) : null}
            {condition.treatmentsKa.length ? (
              <Section title={ka.symptoms.treatment}>
                {condition.treatmentsKa.map((item) => (
                  <Text key={item} style={[styles.body, { marginBottom: 6 }]}>• {item}</Text>
                ))}
              </Section>
            ) : null}
            <Section title={ka.symptoms.seeDoctor}>
              {result.redFlagsKa.map((item) => (
                <Text key={item} style={[styles.body, { marginBottom: 6, color: T.danger }]}>• {item}</Text>
              ))}
              <Text style={styles.body}>{condition.whenToSeeDoctorKa}</Text>
            </Section>
          </View>
        )}
        <Disclaimer />
      </ScrollView>

      <SymptomFooter>
        <SymptomCta
          label={ka.symptoms.talkDoctor}
          onPress={() =>
            router.push(`/chat/doctor?prefill=${encodeURIComponent(`${condition.nameKa}: ${condition.overviewKa}`)}` as never)
          }
        />
      </SymptomFooter>
    </View>
  );
}

function Badge({ icon: Icon, label }: { icon: typeof Heart; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: T.borderTertiary, backgroundColor: T.cardBg, ...T.shadowXs }}>
      <Icon size={18} color={T.textSecondary} strokeWidth={2} />
      <Text style={{ fontSize: 14, fontWeight: '500', color: T.textPrimary }}>{label}</Text>
    </View>
  );
}

function TabBtn({ active, icon: Icon, label, onPress }: { active: boolean; icon: typeof List; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: active ? 2 : 0, borderBottomColor: T.brand, backgroundColor: active ? 'rgba(20,184,166,0.08)' : T.white }}>
      <Icon size={24} color={active ? T.brand : T.textSecondary} strokeWidth={2} />
      <Text style={{ marginTop: 4, fontSize: 14, fontWeight: '600', color: active ? T.brand : T.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 16, backgroundColor: T.white, ...T.shadowXs }}>{children}</View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: T.textPrimary, marginBottom: 8 }}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

const chip = { backgroundColor: T.cardBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: T.border };
const styles = {
  kicker: { fontSize: 13, color: T.textSecondary, marginBottom: 4 },
  body: { fontSize: 15, lineHeight: 24, color: T.textSecondary },
};
