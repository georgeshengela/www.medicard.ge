import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Trash2 } from 'lucide-react-native';
import { MedicationBottomSheet } from '@/components/medications/MedicationBottomSheet';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import {
  daysSummaryKa,
  findDoseLog,
  parseFrequencyTimes,
  parseMedicationConfig,
  saveDoseLog,
  todayYmd,
} from '@/lib/medications.shared';

const RESCHEDULE_OPTIONS = ['08:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

export default function MedicationDetailScreen() {
  const router = useRouter();
  const { id, time, date } = useLocalSearchParams<{ id: string; time?: string; date?: string }>();
  const { medications, doseLogs, setDoseLogs, load } = useMedications();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const med = medications.find((m) => m.id === id);
  const cfg = parseMedicationConfig(med?.config);
  const times = parseFrequencyTimes(med?.frequency ?? '');
  const doseTime = time ?? times[0] ?? '09:00';
  const doseDate = date ?? todayYmd();
  const log = findDoseLog(doseLogs, id, doseDate, doseTime);

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
      setDoseLogs((prev) => [...prev.filter((l) => !(l.medicationId === id && l.date === doseDate && l.time === doseTime)), entry]);
      setRescheduleOpen(false);
      if (status === 'taken') router.back();
    },
    [id, doseDate, doseTime, router, setDoseLogs],
  );

  const remove = () => {
    if (!med) return;
    Alert.alert(ka.meds.deleteConfirm, med.medName, [
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

  if (!med) {
    return (
      <>
        <Stack.Screen options={{ title: ka.meds.detailTitle }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: FIGMA_MEDS.textSecondary }}>{ka.common.loading}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: med.medName,
          headerRight: () => (
            <Pressable onPress={remove} hitSlop={12}>
              <Trash2 size={24} color="#EF4444" strokeWidth={2} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <MedicationPillIcon color={cfg.pillColor} shape={cfg.pillShape} size={88} border />
          <Text style={{ marginTop: 16, fontSize: 24, fontWeight: '900', color: FIGMA_MEDS.textPrimary }}>{med.medName}</Text>
          <Text style={{ marginTop: 4, color: FIGMA_MEDS.textSecondary, fontSize: 16 }}>{med.dosage}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <Clock size={16} color={FIGMA_MEDS.brand} />
            <Text style={{ marginLeft: 6, fontWeight: '800', color: FIGMA_MEDS.brand, fontSize: 18 }}>{doseTime}</Text>
          </View>
        </View>

        <InfoCard label={ka.meds.scheduleLabel} value={times.join(' · ')} />
        {cfg.daysOfWeek?.length ? <InfoCard label={ka.meds.daysLabel} value={daysSummaryKa(cfg.daysOfWeek)} /> : null}
        {med.notes ? <InfoCard label={ka.meds.notesLabel} value={med.notes} /> : null}
        {cfg.mealTiming ? <InfoCard label={ka.meds.mealTimingLabel} value={ka.meds.mealTiming[cfg.mealTiming]} /> : null}

        <Text style={{ marginTop: 8, marginBottom: 12, fontWeight: '800', fontSize: 18, color: FIGMA_MEDS.textPrimary }}>
          {ka.meds.doseActionsTitle}
        </Text>
        <Text style={{ color: FIGMA_MEDS.textMuted, marginBottom: 16 }}>
          {log?.status === 'taken'
            ? ka.meds.alreadyTaken
            : log?.status === 'skipped'
              ? ka.meds.alreadySkipped
              : ka.meds.doseActionsHint}
        </Text>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 20,
          gap: 10,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderColor: FIGMA_MEDS.border,
        }}
      >
        <ActionButton label={ka.meds.actionTake} tone="brand" onPress={() => markDose('taken')} />
        <ActionButton label={ka.meds.actionReschedule} tone="neutral" onPress={() => setRescheduleOpen(true)} />
        <ActionButton label={ka.meds.actionSkip} tone="danger" onPress={() => markDose('skipped')} />
      </View>

      <MedicationBottomSheet visible={rescheduleOpen} title={ka.meds.actionReschedule} onClose={() => setRescheduleOpen(false)}>
        {RESCHEDULE_OPTIONS.map((t) => (
          <Pressable
            key={t}
            onPress={() => markDose('taken', t)}
            style={{
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderColor: FIGMA_MEDS.border,
            }}
          >
            <Text style={{ fontWeight: '700', color: FIGMA_MEDS.textPrimary, fontSize: 16 }}>{t}</Text>
          </Pressable>
        ))}
      </MedicationBottomSheet>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: FIGMA_MEDS.border,
      }}
    >
      <Text style={{ color: FIGMA_MEDS.textMuted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: FIGMA_MEDS.textPrimary, fontWeight: '700', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, tone, onPress }: { label: string; tone: 'brand' | 'neutral' | 'danger'; onPress: () => void }) {
  const bg = tone === 'brand' ? FIGMA_MEDS.brand : tone === 'danger' ? '#FEE2E2' : FIGMA_MEDS.cardBg;
  const color = tone === 'brand' ? '#fff' : tone === 'danger' ? '#DC2626' : FIGMA_MEDS.textPrimary;
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: bg, borderRadius: 18, paddingVertical: 16, alignItems: 'center' }}>
      <Text style={{ fontWeight: '800', fontSize: 16, color }}>{label}</Text>
    </Pressable>
  );
}
