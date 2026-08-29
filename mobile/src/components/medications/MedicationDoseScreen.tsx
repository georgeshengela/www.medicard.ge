import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MedicationBottomSheet } from '@/components/medications/MedicationBottomSheet';
import {
  DoseCalendar,
  DoseCheck,
  DoseCloseX,
  DoseDotsVertical,
  DoseDrugContainer,
  DoseLink,
  DosePillCircle,
  DosePillHero,
  DoseTrash,
} from '@/components/medications/MedicationDoseIcons';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import {
  formatTime12h,
  parseFrequencyTimes,
  parseMedicationConfig,
  saveDoseLog,
  todayYmd,
} from '@/lib/medications.shared';

const RESCHEDULE_OPTIONS = ['08:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

export function MedicationDoseScreen() {
  const FIGMA_MEDS = useFigmaMeds();
  const router = useRouter();
  const { id, time, date } = useLocalSearchParams<{ id: string; time?: string; date?: string }>();
  const { medications, setDoseLogs, load } = useMedications();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const med = medications.find((item) => item.id === id);
  const cfg = parseMedicationConfig(med?.config);
  const times = parseFrequencyTimes(med?.frequency ?? '');
  const doseTime = time ?? times[0] ?? '09:00';
  const doseDate = date ?? todayYmd();

  const markDose = useCallback(
    async (status: 'taken' | 'skipped', newTime?: string) => {
      const entry = {
        medicationId: id,
        date: doseDate,
        time: newTime ?? doseTime,
        status,
        updatedAt: new Date().toISOString(),
      };
      await saveDoseLog(entry);
      setDoseLogs((prev) => [
        ...prev.filter((item) => !(item.medicationId === id && item.date === doseDate && item.time === doseTime)),
        entry,
      ]);
      setRescheduleOpen(false);
      if (status === 'taken' || status === 'skipped') router.back();
    },
    [id, doseDate, doseTime, router, setDoseLogs],
  );

  const remove = () => {
    if (!med) return;
    Alert.alert(ka.meds.deleteFromSchedule, med.medName, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.common.delete,
        style: 'destructive',
        onPress: async () => {
          await api.medications.remove(med.id).catch(() => undefined);
          await load();
          router.replace('/(tabs)/medications');
        },
      },
    ]);
  };

  const openMore = () => {
    if (!med) return;
    if (cfg.catalogProductId) {
      router.push(`/pharmacy/product/${cfg.catalogProductId}` as never);
      return;
    }
    router.push('/medications/interaction' as never);
  };

  if (!med) {
    return (
      <>
        <Stack.Screen options={{ title: ka.meds.scheduleScreenTitle }} />
        <View className="flex-1 items-center justify-center bg-bg-100">
          <Text className="font-sans text-base text-text-200">{ka.common.loading}</Text>
        </View>
      </>
    );
  }

  const form = ka.meds.formLabels[cfg.form ?? 'pills'];
  const amount = cfg.amount ?? 1;
  const remaining = cfg.remainingCount;
  const knownAs = cfg.genericName ? ka.meds.knownAs(cfg.genericName, med.medName) : null;
  const freqLabel =
    cfg.frequencyKind === 'weekly'
      ? ka.meds.frequencyWeekly
      : cfg.frequencyKind === 'as_needed'
        ? ka.meds.frequencyAsNeeded
        : cfg.frequencyKind === 'one_time'
          ? ka.meds.frequencyOneTime
          : ka.meds.frequencyDaily;
  const timeLine = `${formatTime12h(doseTime)}, ${freqLabel}`;
  const moreLabel = ka.meds.moreOn(med.medName);

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.meds.scheduleScreenTitle,
          contentStyle: { flex: 1, backgroundColor: FIGMA_MEDS.pageBg },
          headerRight: () => (
            <Pressable onPress={remove} hitSlop={12} accessibilityLabel={ka.meds.deleteFromSchedule}>
              <DoseDotsVertical size={24} color={FIGMA_MEDS.textPrimary} />
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 bg-bg-100">
        <View className="w-full flex-1 justify-center">
          <View className="w-full items-center gap-4 px-4 py-6">
            {cfg.imageUrl ? (
              <MedicationPillIcon imageUrl={cfg.imageUrl} size={80} shape={cfg.pillShape} />
            ) : (
              <DosePillHero
                leftFill={FIGMA_MEDS.cardBgTertiary}
                rightFill={FIGMA_MEDS.border}
                stroke={FIGMA_MEDS.textMuted}
              />
            )}

            <View className="w-full items-center gap-4">
              <Text className="w-full text-center font-sans text-sm text-text-200">{timeLine}</Text>
              <View className="w-full items-center gap-3">
                <Text className="w-full text-center font-sans-bold text-2xl text-text-100">{med.medName}</Text>
                {knownAs ? (
                  <Text className="w-full text-center font-sans text-base text-text-200">{knownAs}</Text>
                ) : med.dosage ? (
                  <Text className="w-full text-center font-sans text-base text-text-200">{med.dosage}</Text>
                ) : null}
              </View>

              <View className="w-full flex-row items-center justify-center gap-3">
                <View className="flex-row items-center gap-2">
                  <DosePillCircle size={24} color={FIGMA_MEDS.textMuted} />
                  <Text className="font-sans-medium text-base text-text-100">{ka.meds.doseAmountLine(amount, form)}</Text>
                </View>
                {remaining != null ? (
                  <>
                    <View className="h-1.5 w-1.5 rounded-full bg-bg-300" />
                    <View className="flex-row items-center gap-2">
                      <DoseDrugContainer size={24} color={FIGMA_MEDS.textMuted} />
                      <Text className="font-sans-medium text-base text-text-100">{ka.meds.pillsLeft(remaining)}</Text>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          <View className="w-full flex-row items-start gap-4 p-4">
            <CircleAction label={ka.meds.actionTake} onPress={() => markDose('taken')}>
              <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: FIGMA_MEDS.ctaBg }}>
                <DoseCheck size={24} color="#FFFFFF" />
              </View>
            </CircleAction>
            <CircleAction label={ka.meds.actionReschedule} onPress={() => setRescheduleOpen(true)}>
              <View
                className="h-12 w-12 items-center justify-center rounded-full border border-bg-300 bg-surface"
              >
                <DoseCalendar size={24} color={FIGMA_MEDS.textPrimary} />
              </View>
            </CircleAction>
            <CircleAction label={ka.meds.actionSkip} onPress={() => markDose('skipped')}>
              <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: FIGMA_MEDS.destructive }}>
                <DoseCloseX size={24} color="#FFFFFF" />
              </View>
            </CircleAction>
          </View>

          <View className="w-full gap-6 px-4 py-8">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={moreLabel}
              onPress={openMore}
              className="w-full active:opacity-80"
            >
              <View className="h-12 w-full flex-row items-center justify-center rounded-2xl px-5" style={[styles.moreFill, { backgroundColor: FIGMA_MEDS.ctaBg }]}>
                <Text className="font-sans-semibold text-base text-white" numberOfLines={1}>
                  {moreLabel}
                </Text>
                <View className="ml-2.5 h-5 w-5">
                  <DoseLink size={20} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.meds.deleteFromSchedule}
              onPress={remove}
              className="w-full active:opacity-70"
            >
              <View className="h-12 w-full flex-row items-center justify-center">
                <Text className="font-sans-semibold text-base text-state-danger" numberOfLines={1}>
                  {ka.meds.deleteFromSchedule}
                </Text>
                <View className="ml-2.5 h-5 w-5">
                  <DoseTrash size={20} color={FIGMA_MEDS.destructive} />
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      <MedicationBottomSheet
        visible={rescheduleOpen}
        title={ka.meds.actionReschedule}
        onClose={() => setRescheduleOpen(false)}
      >
        <View className="gap-2 pb-2">
          {RESCHEDULE_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => markDose('taken', option)}
              className="rounded-2xl border px-4 py-3.5"
              style={{
                backgroundColor: FIGMA_MEDS.cardBg,
                borderColor: option === doseTime ? FIGMA_MEDS.brand : FIGMA_MEDS.border,
              }}
            >
              <Text className="font-sans-semibold text-base text-text-100">{option}</Text>
            </Pressable>
          ))}
        </View>
      </MedicationBottomSheet>
    </>
  );
}

function CircleAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-w-0 flex-1 items-center"
    >
      {children}
      <Text className="mt-2 w-full text-center font-sans-medium text-base text-text-200">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  moreFill: {
    height: 48,
    width: '100%',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
