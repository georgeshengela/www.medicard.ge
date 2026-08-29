import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, CheckCircle2, Pill, Plus, ScanLine, Utensils, XCircle } from 'lucide-react-native';
import { MedicationBottomSheet } from '@/components/medications/MedicationBottomSheet';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import {
  findDoseLog,
  parseMedicationConfig,
  saveDoseLog,
} from '@/lib/medications.shared';

const RESCHEDULE_OPTIONS = ['08:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
const DAY_LETTER_KA = ['ო', 'ს', 'ო', 'ხ', 'პ', 'შ', 'კ'] as const;
const STRIP_LENGTH = 8;

function startOfMonday(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  return start;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function hourLabel(time24: string) {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === '00' ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function MedicationRemindersScreen() {
  const FIGMA_MEDS = useFigmaMeds();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const { schedule, medications, doseLogs, setDoseLogs } = useMedications();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  useEffect(() => {
    if (typeof dateParam !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    const [year, month, day] = dateParam.split('-').map(Number);
    setSelectedDate(new Date(year, month - 1, day));
  }, [dateParam]);
  const [reschedule, setReschedule] = useState<{ medicationId: string; time: string } | null>(null);

  const stripDays = useMemo(() => {
    const start = startOfMonday(selectedDate);
    return Array.from({ length: STRIP_LENGTH }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [selectedDate]);

  const selectedYmd = ymd(selectedDate);
  const selectedDow = weekdayIndex(selectedDate);
  const logDate = selectedYmd;

  const dayDoses = useMemo(
    () =>
      schedule
        .filter((dose) => {
          const med = medications.find((item) => item.id === dose.medicationId);
          if (!med?.active) return false;
          const cfg = parseMedicationConfig(med.config);
          if (!cfg.daysOfWeek?.length) return true;
          return cfg.daysOfWeek.includes(selectedDow);
        })
        .sort((a, b) => a.time.localeCompare(b.time)),
    [medications, schedule, selectedDow],
  );

  const daysWithDoses = useMemo(() => {
    const set = new Set<number>();
    for (const dose of schedule) {
      const med = medications.find((item) => item.id === dose.medicationId);
      if (!med?.active) continue;
      const cfg = parseMedicationConfig(med.config);
      if (!cfg.daysOfWeek?.length) {
        for (let i = 0; i < 7; i += 1) set.add(i);
        break;
      }
      for (const d of cfg.daysOfWeek) set.add(d);
    }
    return set;
  }, [medications, schedule]);

  const markDose = async (medicationId: string, time: string, status: 'taken' | 'skipped', newTime?: string) => {
    const entry = {
      medicationId,
      date: logDate,
      time: newTime ?? time,
      status,
      updatedAt: new Date().toISOString(),
    };
    await saveDoseLog(entry);
    setDoseLogs((prev) => [
      ...prev.filter((log) => !(log.medicationId === medicationId && log.date === logDate && log.time === time)),
      entry,
    ]);
    setReschedule(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.meds.remindersScreenTitle,
          headerRight: () => (
            <Pressable onPress={() => router.push('/medications/reminders/calendar')} hitSlop={12} accessibilityLabel={ka.meds.calendarTitle}>
              <Calendar size={24} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
            </Pressable>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.pageBg }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, backgroundColor: FIGMA_MEDS.headerBg }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}
        >
          {stripDays.map((day) => {
            const active = sameDay(day, selectedDate);
            const hasDose = daysWithDoses.has(weekdayIndex(day));
            return (
              <Pressable
                key={ymd(day)}
                onPress={() => setSelectedDate(day)}
                style={{
                  minWidth: 36,
                  paddingHorizontal: 8,
                  paddingTop: 8,
                  paddingBottom: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  backgroundColor: active ? FIGMA_MEDS.brandQuaternary : FIGMA_MEDS.surface,
                  borderWidth: 1,
                  borderColor: active ? FIGMA_MEDS.brand : FIGMA_MEDS.borderTertiary,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    lineHeight: 16,
                    color: active ? FIGMA_MEDS.brand : FIGMA_MEDS.textSecondary,
                    textAlign: 'center',
                  }}
                >
                  {DAY_LETTER_KA[weekdayIndex(day)]}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    lineHeight: 20,
                    color: FIGMA_MEDS.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {day.getDate()}
                </Text>
                {hasDose ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: FIGMA_MEDS.brand,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {dayDoses.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 12 }}>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: '700',
                  lineHeight: 32,
                  letterSpacing: -0.25,
                  color: FIGMA_MEDS.textPrimary,
                  textAlign: 'center',
                }}
              >
                {sameDay(selectedDate, new Date()) ? ka.meds.scheduleEmptyTitle : ka.meds.scheduleEmptyTitleOther}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '400',
                  lineHeight: 26,
                  color: FIGMA_MEDS.textSecondary,
                  textAlign: 'center',
                }}
              >
                {ka.meds.scheduleEmptyBody}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16, gap: 10 }}>
              <Pressable
                onPress={() => router.push('/medications/add/search')}
                accessibilityRole="button"
                accessibilityLabel={ka.meds.addMedicationCta}
                style={{
                  height: 48,
                  minHeight: 48,
                  borderRadius: 16,
                  backgroundColor: FIGMA_MEDS.brand,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingHorizontal: 20,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', lineHeight: 22, color: FIGMA_MEDS.textOnBrand }}>
                  {ka.meds.addMedicationCta}
                </Text>
                <Plus size={20} color={FIGMA_MEDS.textOnBrand} strokeWidth={2.4} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/medications/add')}
                accessibilityRole="button"
                accessibilityLabel={ka.meds.scanMedicationCta}
                style={{
                  height: 48,
                  minHeight: 48,
                  borderRadius: 16,
                  backgroundColor: FIGMA_MEDS.brandQuaternary,
                  borderWidth: 1,
                  borderColor: FIGMA_MEDS.brandTertiary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingHorizontal: 20,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', lineHeight: 22, color: FIGMA_MEDS.brand }}>
                  {ka.meds.scanMedicationCta}
                </Text>
                <ScanLine size={20} color={FIGMA_MEDS.brand} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1, backgroundColor: FIGMA_MEDS.pageBg }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 112 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            {dayDoses.map((dose, index) => {
            const med = medications.find((item) => item.id === dose.medicationId);
            const cfg = parseMedicationConfig(med?.config);
            const log = findDoseLog(doseLogs, dose.medicationId, logDate, dose.time);
            const meal = cfg.mealTiming && cfg.mealTiming !== 'any' ? ka.meds.mealTiming[cfg.mealTiming] : null;
            const subtitle = cfg.genericName
              ? `${cfg.genericName}${cfg.form ? ` - ${ka.meds.formLabels[cfg.form]}` : ''}`
              : dose.dosage;
            const isFirst = index === 0;
            const isLast = index === dayDoses.length - 1;
            return (
              <View
                key={`${dose.medicationId}-${dose.time}`}
                style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12, minHeight: 64 }}
              >
                <View style={{ width: 56, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 8,
                      backgroundColor: isFirst ? 'transparent' : FIGMA_MEDS.border,
                    }}
                  />
                  <View
                    style={{
                      width: '100%',
                      paddingHorizontal: 4,
                      paddingVertical: 6,
                      borderRadius: 6,
                      backgroundColor: FIGMA_MEDS.surface,
                      borderWidth: 1,
                      borderColor: FIGMA_MEDS.border,
                      alignItems: 'center',
                      ...FIGMA_MEDS.shadowInput,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        lineHeight: 16,
                        color: FIGMA_MEDS.textPrimary,
                        textAlign: 'center',
                      }}
                    >
                      {hourLabel(dose.time)}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 8,
                      backgroundColor: isLast ? 'transparent' : FIGMA_MEDS.border,
                    }}
                  />
                </View>

                <Pressable
                  onPress={() => router.push(`/medications/${dose.medicationId}?time=${dose.time}&date=${logDate}`)}
                  style={{
                    flex: 1,
                    marginVertical: 8,
                    padding: 12,
                    borderRadius: 24,
                    backgroundColor: FIGMA_MEDS.surface,
                    borderWidth: 1,
                    borderColor: FIGMA_MEDS.border,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                    ...FIGMA_MEDS.shadowInput,
                  }}
                >
                  <MedicationPillIcon
                    color={cfg.pillColor}
                    shape={cfg.pillShape}
                    size={48}
                    border
                    imageUrl={cfg.imageUrl}
                  />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', lineHeight: 16, color: FIGMA_MEDS.textPrimary }}>
                        {dose.medName}
                      </Text>
                      <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textSecondary }}>{subtitle}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Pill size={16} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
                        <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textPrimary }}>{dose.dosage}</Text>
                      </View>
                      {log?.status === 'taken' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={16} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
                          <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textPrimary }}>{ka.meds.statusTaken}</Text>
                        </View>
                      ) : log?.status === 'skipped' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <XCircle size={16} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
                          <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textPrimary }}>{ka.meds.statusSkipped}</Text>
                        </View>
                      ) : meal ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Utensils size={16} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
                          <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textPrimary }}>{meal}</Text>
                        </View>
                      ) : null}
                    </View>
                    {!log ? (
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Pressable
                          onPress={() => setReschedule({ medicationId: dose.medicationId, time: dose.time })}
                          hitSlop={8}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', lineHeight: 16, color: FIGMA_MEDS.textPrimary }}>
                            {ka.meds.actionReschedule}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void markDose(dose.medicationId, dose.time, 'taken')}
                          hitSlop={8}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', lineHeight: 16, color: FIGMA_MEDS.brand }}>
                            {ka.meds.actionTake}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            );
            })}
          </ScrollView>
        )}

        {dayDoses.length > 0 ? (
          <Pressable
          onPress={() => router.push('/medications/add/search')}
          accessibilityRole="button"
          accessibilityLabel={ka.meds.quickAdd}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16 + insets.bottom,
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: FIGMA_MEDS.brand,
            alignItems: 'center',
            justifyContent: 'center',
            ...FIGMA_MEDS.shadowCard,
          }}
        >
            <Plus size={32} color={FIGMA_MEDS.textOnBrand} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>

      <MedicationBottomSheet
        visible={!!reschedule}
        title={ka.meds.actionReschedule}
        onClose={() => setReschedule(null)}
      >
        {RESCHEDULE_OPTIONS.map((time) => (
          <Pressable
            key={time}
            onPress={() => {
              if (!reschedule) return;
              void markDose(reschedule.medicationId, reschedule.time, 'taken', time);
            }}
            style={{
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderColor: FIGMA_MEDS.border,
            }}
          >
            <Text style={{ fontWeight: '700', color: FIGMA_MEDS.textPrimary, fontSize: 16 }}>{time}</Text>
          </Pressable>
        ))}
      </MedicationBottomSheet>
    </>
  );
}
