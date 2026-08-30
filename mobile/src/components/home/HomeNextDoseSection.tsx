import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MedicationFigmaStepRing } from '@/components/medications/MedicationCircularProgress';
import { MedCard } from '@/components/medications/MedicationUI';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { DoseCarouselSkeleton } from '@/components/ui/Skeleton';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import type { ScheduledDose } from '@/lib/api';
import { findDoseLog, parseMedicationConfig, todayYmd } from '@/lib/medications.shared';

/** Figma 11416:83298 — 288×~88 peeking dose cards, 8px gap. */
const CARD_W = 288;
const CARD_GAP = 8;
const SNAP = CARD_W + CARD_GAP;
type MedConfig = ReturnType<typeof parseMedicationConfig>;

type Props = {
  refreshing?: boolean;
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
  const subtitle = formLabel(cfg, dose.dosage);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={{
        width: CARD_W,
        minHeight: 88,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: FIGMA_MEDS.border,
        backgroundColor: FIGMA_MEDS.cardBg,
        padding: 12,
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
            color: FIGMA_MEDS.textSecondary,
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
            color: FIGMA_MEDS.textPrimary,
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
              color: FIGMA_MEDS.textSecondary,
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

export function HomeNextDoseSection({ refreshing }: Props) {
  const router = useRouter();
  const { medications, schedule, doseLogs, load, loading } = useMedications();
  const today = todayYmd();

  useEffect(() => {
    if (refreshing) void load();
  }, [refreshing, load]);

  const { pending, progressByMed } = useMemo(() => {
    const todayDoses = schedule
      .filter((dose) => {
        const med = medications.find((item) => item.id === dose.medicationId);
        if (!med?.active) return false;
        const cfg = parseMedicationConfig(med.config);
        if (!cfg.daysOfWeek?.length) return true;
        const dow = (new Date().getDay() + 6) % 7;
        return cfg.daysOfWeek.includes(dow);
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    const progressByMed = new Map<string, { taken: number; total: number }>();
    for (const dose of todayDoses) {
      const prev = progressByMed.get(dose.medicationId) ?? { taken: 0, total: 0 };
      prev.total += 1;
      if (findDoseLog(doseLogs, dose.medicationId, today, dose.time)?.status === 'taken') prev.taken += 1;
      progressByMed.set(dose.medicationId, prev);
    }

    const pending = todayDoses.filter((dose) => !findDoseLog(doseLogs, dose.medicationId, today, dose.time));
    return { pending, progressByMed };
  }, [doseLogs, medications, schedule, today]);

  if (loading) {
    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <HomeSectionTitle title={ka.home.nextDose} />
        <DoseCarouselSkeleton />
      </View>
    );
  }

  if (pending.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <HomeSectionTitle title={ka.home.nextDose} />
      <MedCard style={{ padding: 16, overflow: 'hidden' }}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={SNAP}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={{ gap: CARD_GAP }}
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
      </MedCard>
    </View>
  );
}
