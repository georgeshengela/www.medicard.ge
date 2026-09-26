import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MedicationFigmaStepRing } from '@/components/medications/MedicationCircularProgress';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { DoseCarouselSkeleton } from '@/components/ui/Skeleton';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { useThemeColors } from '@/theme/colors';
import type { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import type { ScheduledDose } from '@/lib/api';
import { parseMedicationConfig, todayYmd } from '@/lib/medications.shared';
import { computeTodayDoses } from '@/lib/home/todayDoses';

/** Figma 11416:83298 — 288×~88 peeking dose cards, 8px gap. */
const CARD_W = 288;
const CARD_GAP = 10;
const SNAP = CARD_W + CARD_GAP;
type MedConfig = ReturnType<typeof parseMedicationConfig>;

type Props = {
  /** Shared medications bundle — Home loads it once for the hero rings and this carousel. */
  meds: ReturnType<typeof useMedications>;
};

function formLabel(cfg: MedConfig, dosage: string) {
  const form = cfg.form ? ka.meds.formLabels[cfg.form] : null;
  if (dosage && form && !dosage.toLowerCase().includes(form.toLowerCase())) {
    return `${dosage} ${form}`;
  }
  return dosage || form || '';
}

function NextDoseCard({
  dose,
  cfg,
  taken,
  total,
  onOpen,
}: {
  dose: ScheduledDose;
  cfg: MedConfig;
  taken: number;
  total: number;
  onOpen: () => void;
}) {
  const FIGMA_MEDS = useFigmaMeds();
  const c = useThemeColors();
  const subtitle = formLabel(cfg, dose.dosage);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={{
        width: CARD_W,
        minHeight: 88,
        borderRadius: 20,
        backgroundColor: c.surface,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_500Medium',
            fontSize: 12,
            lineHeight: 16,
            color: c.text200,
          }}
          numberOfLines={1}
        >
          {ka.home.nextDoseOf(taken, total)}
        </Text>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 18,
            lineHeight: 24,
            color: c.text100,
          }}
          numberOfLines={1}
        >
          {dose.medName}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 14,
              lineHeight: 20,
              color: c.text200,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <MedicationFigmaStepRing steps={total} filled={taken} />
    </Pressable>
  );
}

export function HomeNextDoseSection({ meds }: Props) {
  const router = useRouter();
  const { medications, schedule, doseLogs, loading } = meds;
  const today = todayYmd();

  const { pending, progressByMed } = useMemo(
    () => computeTodayDoses(medications, schedule, doseLogs, today),
    [doseLogs, medications, schedule, today],
  );

  if (loading) {
    return (
      <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
        <HomeSectionTitle title={ka.home.nextDose} style={{ fontSize: 17, lineHeight: 24, marginBottom: 12 }} />
        <DoseCarouselSkeleton />
      </View>
    );
  }

  if (pending.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
      <HomeSectionTitle title={ka.home.nextDose} style={{ fontSize: 17, lineHeight: 24, marginBottom: 12 }} />
      <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={SNAP}
          snapToAlignment="start"
          disableIntervalMomentum
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: 20 }}
        >
          {pending.map((dose) => {
            const med = medications.find((item) => item.id === dose.medicationId);
            const cfg = parseMedicationConfig(med?.config);
            const progress = progressByMed.get(dose.medicationId) ?? { taken: 0, total: 1 };
            return (
              <NextDoseCard
                key={`${dose.medicationId}-${dose.time}`}
                dose={dose}
                cfg={cfg}
                taken={progress.taken}
                total={progress.total}
                onOpen={() =>
                  router.push(`/medications/${dose.medicationId}?time=${dose.time}&date=${today}` as never)
                }
              />
            );
          })}
        </ScrollView>
    </View>
  );
}
