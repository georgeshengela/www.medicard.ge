import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Plus, ShieldCheck } from 'lucide-react-native';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedsButton, MedsCard, MedsChip, MedsIconTile } from '@/components/medications/MedsHubUI';
import { Markdown } from '@/components/ui/Markdown';
import { QuotaSheet } from '@/components/QuotaSheet';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { isAiConsentDeclined } from '@/lib/aiConsentDecline';
import { AiConsentDeclinedNote } from '@/components/ui/AiConsentDeclinedNote';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { tx } from '@/i18n/locale';

export default function MedicationInteractionScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { applyUsage } = useAuth();
  const { medications } = useMedications();
  const [review, setReview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Declined / closed the AI disclosure: a choice, not an error alert — calm note + „ხელახლა ცდა“.
  const [declined, setDeclined] = useState(false);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  const activeMeds = medications.filter((med) => med.active);

  const runReview = async () => {
    setBusy(true);
    setDeclined(false);
    try {
      const response = await api.ai.medicationReview();
      setReview(response.analysis);
      applyUsage(response.usage);
    } catch (err) {
      if (isAiConsentDeclined(err)) {
        setDeclined(true);
      } else if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        Alert.alert(ka.common.error, err instanceof ApiError ? err.message : ka.common.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: ka.meds.reviewTitle }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg100 }}
        contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: HUB.sectionGap - 6 }}
        showsVerticalScrollIndicator={false}
      >
        <MedsCard style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
            <MedsIconTile icon={ShieldCheck} ink="violet" size={48} iconSize={24} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[hubText.cardTitle, { fontSize: 16, lineHeight: 23, color: c.text100 }]}>{ka.meds.interactionScreenTitle}</Text>
              <Text style={[hubText.body, { color: c.text200 }]}>{ka.meds.interactionScreenBody}</Text>
            </View>
          </View>
          <MedsButton label={ka.meds.reviewCta} icon={ShieldCheck} loading={busy} disabled={activeMeds.length === 0} onPress={runReview} />
        </MedsCard>

        {declined && !busy ? <AiConsentDeclinedNote onRetry={() => void runReview()} /> : null}

        <View>
          <HomeSectionHeading title={ka.meds.reviewChecks} />
          <MedsCard style={{ gap: 12 }}>
            {activeMeds.length === 0 ? (
              <>
                <Text style={[hubText.body, { color: c.text200 }]}>{ka.meds.reviewNoMeds}</Text>
                <MedsButton label={ka.meds.addMedicationCta} icon={Plus} tone="tonal" onPress={() => router.push('/medications/add/search')} />
              </>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {activeMeds.map((med) => (
                  <MedsChip key={med.id} label={med.medName} />
                ))}
              </View>
            )}
          </MedsCard>
        </View>

        {review ? (
          <View>
            <HomeSectionHeading title={ka.meds.reviewResultTitle} />
            <MedsCard>
              <Markdown content={review} />
            </MedsCard>
            <Text style={[hubText.small, { color: c.text300, marginTop: 10 }]}>
              {tx('მიმოხილვა AI-ით (Medi) არის შექმნილი შენი წამლების სიიდან — შეიძლება რამე გამოტოვოს და ეს დიაგნოზი ან დანიშნულება არ არის. წამლის შეცვლამდე ჰკითხე ექიმს ან ფარმაცევტს.', 'This review was made by AI (Medi) from your medication list — it may miss something, and it is not a diagnosis or a prescription. Ask your doctor or pharmacist before changing any medication.')}
            </Text>
            <MedicalSourcesLink sourceIds={['medicationInteractions']} />
          </View>
        ) : null}
      </ScrollView>

      <QuotaSheet visible={quotaBlock !== undefined} resetsInMs={quotaBlock} onClose={() => setQuotaBlock(undefined)} />
    </>
  );
}
