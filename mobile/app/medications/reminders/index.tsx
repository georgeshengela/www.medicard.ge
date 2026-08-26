import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { DAY_LABELS_KA, findDoseLog, parseMedicationConfig, todayYmd } from '@/lib/medications.shared';

export default function MedicationRemindersScreen() {
  const router = useRouter();
  const { schedule, medications, doseLogs } = useMedications();
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
  const today = todayYmd();

  const dayDoses = useMemo(() => {
    return schedule
      .filter((d) => {
        const med = medications.find((m) => m.id === d.medicationId);
        if (!med?.active) return false;
        const cfg = parseMedicationConfig(med.config);
        if (!cfg.daysOfWeek?.length) return true;
        return cfg.daysOfWeek.includes(selectedDay);
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [schedule, medications, selectedDay]);

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.meds.remindersScreenTitle,
          headerRight: () => (
            <Pressable onPress={() => router.push('/medications/reminders/calendar')} hitSlop={12}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: FIGMA_MEDS.brand }}>{ka.meds.calendarTitle}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
          {DAY_LABELS_KA.map((label, idx) => {
            const active = selectedDay === idx;
            return (
              <Pressable
                key={label}
                onPress={() => setSelectedDay(idx)}
                style={{
                  width: 52,
                  height: 72,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? FIGMA_MEDS.brand : '#fff',
                  borderWidth: 1,
                  borderColor: active ? FIGMA_MEDS.brand : FIGMA_MEDS.border,
                }}
              >
                <Text style={{ fontWeight: '800', color: active ? '#fff' : FIGMA_MEDS.textSecondary }}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {dayDoses.length === 0 ? (
          <Text style={{ color: FIGMA_MEDS.textSecondary, textAlign: 'center', marginTop: 40 }}>{ka.meds.noDosesToday}</Text>
        ) : (
          dayDoses.map((dose, index) => {
            const med = medications.find((m) => m.id === dose.medicationId);
            const cfg = parseMedicationConfig(med?.config);
            const log = findDoseLog(doseLogs, dose.medicationId, today, dose.time);
            return (
              <View key={`${dose.medicationId}-${dose.time}`} style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ width: 56, alignItems: 'center' }}>
                  <Text style={{ fontWeight: '800', color: FIGMA_MEDS.brand }}>{dose.time}</Text>
                  {index < dayDoses.length - 1 ? (
                    <View style={{ width: 2, flex: 1, backgroundColor: FIGMA_MEDS.brandBorder, marginTop: 8 }} />
                  ) : null}
                </View>
                <Pressable
                  onPress={() => router.push(`/medications/${dose.medicationId}?time=${dose.time}&date=${today}`)}
                  style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderRadius: 20,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: FIGMA_MEDS.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <MedicationPillIcon color={cfg.pillColor} shape={cfg.pillShape} size={44} border />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: FIGMA_MEDS.textPrimary }}>{dose.medName}</Text>
                    <Text style={{ color: FIGMA_MEDS.textMuted, marginTop: 2 }}>{dose.dosage}</Text>
                  </View>
                  <Text style={{ fontWeight: '700', color: log?.status === 'taken' ? '#16A34A' : FIGMA_MEDS.textMuted }}>
                    {log?.status === 'taken' ? ka.meds.statusTaken : log?.status === 'skipped' ? ka.meds.statusSkipped : ka.meds.statusPending}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/medications/add/search')}
        style={{
          position: 'absolute',
          right: 24,
          bottom: 32,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: FIGMA_MEDS.brand,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Plus size={26} color="#fff" strokeWidth={2.5} />
      </Pressable>
    </>
  );
}
