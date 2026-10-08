import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Pill, Plus, Search, X } from 'lucide-react-native';
import { MedicationHeaderAction } from '@/components/medications/MedicationNavHeader';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedicationRescheduleSheet } from '@/components/medications/MedicationRescheduleSheet';
import { MedsButton, MedsCard, MedsChip, MedsEmptyState, MedsProgressBar, MedsRoundAction, MedsStatusPill, doseAttentionInk, medsPrimaryFill, medsInk } from '@/components/medications/MedsHubUI';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { MONTHS_KA } from '@/constants/cycle';
import { useMedicationImages } from '@/hooks/useMedicationImages';
import { useMedications } from '@/hooks/useMedications';
import { EMPTY_ART } from '@/constants/appArt';
import { ka } from '@/i18n/ka';
import {
  DAY_LETTERS,
  findDoseLog,
  formatTime24h,
  parseMedicationConfig,
  saveDoseLog,
} from '@/lib/medications.shared';
import { medicationCourseIncludesDate } from '@/lib/notificationPlan';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import type { DoseStatus, MedicationDoseLog } from '@/types/medications';
import type { Medication, ScheduledDose } from '@/lib/api';

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonday(date: Date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Doses that belong to one calendar day, sorted by time. */
function dosesForDay(medications: Medication[], schedule: ScheduledDose[], date: Date): ScheduledDose[] {
  const key = ymd(date);
  const dow = weekdayIndex(date);
  return schedule
    .filter((dose) => {
      const med = medications.find((item) => item.id === dose.medicationId);
      if (!med?.active) return false;
      const cfg = parseMedicationConfig(med.config);
      if (!medicationCourseIncludesDate(cfg, key)) return false;
      if (!cfg.daysOfWeek?.length) return true;
      return cfg.daysOfWeek.includes(dow);
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

type DayTone = 'none' | 'planned' | DoseStatus;

function dayTone(doses: ScheduledDose[], logs: MedicationDoseLog[], key: string): DayTone {
  if (doses.length === 0) return 'none';
  const statuses = doses
    .map((dose) => findDoseLog(logs, dose.medicationId, key, dose.time)?.status)
    .filter((status): status is DoseStatus => !!status);
  if (statuses.length === 0) return 'planned';
  if (statuses.some((status) => status === 'skipped')) return 'skipped';
  if (statuses.length === doses.length && statuses.every((status) => status === 'taken')) return 'taken';
  return 'pending';
}

export default function MedicationRemindersScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const { schedule, medications, doseLogs, setDoseLogs, loading } = useMedications();
  const images = useMedicationImages(medications);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [reschedule, setReschedule] = useState<{ medicationId: string; time: string } | null>(null);

  useEffect(() => {
    if (typeof dateParam !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    const [year, month, day] = dateParam.split('-').map(Number);
    setSelectedDate(new Date(year, month - 1, day));
  }, [dateParam]);

  const weekDays = useMemo(() => {
    const start = startOfMonday(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const selectedYmd = ymd(selectedDate);
  const dayDoses = useMemo(() => dosesForDay(medications, schedule, selectedDate), [medications, schedule, selectedDate]);
  const takenCount = dayDoses.filter((dose) => findDoseLog(doseLogs, dose.medicationId, selectedYmd, dose.time)?.status === 'taken').length;
  const loggedCount = dayDoses.filter((dose) => findDoseLog(doseLogs, dose.medicationId, selectedYmd, dose.time)).length;
  const remaining = dayDoses.length - loggedCount;

  const groups = useMemo(() => {
    const map = new Map<string, ScheduledDose[]>();
    for (const dose of dayDoses) {
      const list = map.get(dose.time) ?? [];
      list.push(dose);
      map.set(dose.time, list);
    }
    return [...map.entries()];
  }, [dayDoses]);

  const markDose = async (medicationId: string, time: string, status: 'taken' | 'skipped', newTime?: string) => {
    const entry: MedicationDoseLog = {
      medicationId,
      date: selectedYmd,
      time: newTime ?? time,
      status,
      updatedAt: new Date().toISOString(),
    };
    await saveDoseLog(entry);
    setDoseLogs((prev) => [
      ...prev.filter((log) => !(log.medicationId === medicationId && log.date === selectedYmd && log.time === time)),
      entry,
    ]);
    setReschedule(null);
  };

  const isToday = sameDay(selectedDate, today);
  const monthLabel = `${MONTHS_KA[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  const accent = medsInk(dark);
  const primary = medsPrimaryFill(c, dark);

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.meds.remindersScreenTitle,
          headerRight: () => (
            <MedicationHeaderAction icon={Calendar} onPress={() => router.push('/medications/reminders/calendar')} accessibilityLabel={ka.meds.calendarTitle} />
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: c.bg100 }}>
        <View style={{ paddingHorizontal: HUB.gutter, paddingTop: 4, paddingBottom: 12, gap: 12 }}>
          <View style={s.monthRow}>
            <MedsRoundAction icon={ChevronLeft} tone="quiet" size={36} onPress={() => setSelectedDate(addDays(selectedDate, -7))} accessibilityLabel={ka.meds.weekPrev} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text accessibilityRole="header" style={[hubText.cardTitle, { color: c.text100 }]}>
                {monthLabel}
              </Text>
              {!isToday ? <MedsChip label={ka.common.today} active onPress={() => setSelectedDate(today)} /> : null}
            </View>
            <MedsRoundAction icon={ChevronRight} tone="quiet" size={36} onPress={() => setSelectedDate(addDays(selectedDate, 7))} accessibilityLabel={ka.meds.weekNext} />
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            {weekDays.map((day) => {
              const key = ymd(day);
              const active = sameDay(day, selectedDate);
              const isTodayCell = sameDay(day, today);
              const tone = dayTone(dosesForDay(medications, schedule, day), doseLogs, key);
              const dot =
                tone === 'none'
                  ? 'transparent'
                  : active
                    ? 'rgba(255,255,255,0.9)'
                    : tone === 'taken'
                      ? c.success
                      : tone === 'skipped'
                        ? doseAttentionInk(dark)
                        : tone === 'pending'
                          ? c.warning
                          : accent;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${DAY_LETTERS[weekdayIndex(day)]} ${day.getDate()}`}
                  onPress={() => setSelectedDate(day)}
                  style={[s.dayPill, { backgroundColor: active ? primary : c.surface }]}
                >
                  <Text style={[hubText.small, { color: active ? 'rgba(255,255,255,0.82)' : c.text300 }]}>
                    {DAY_LETTERS[weekdayIndex(day)]}
                  </Text>
                  <Text style={[hubText.value, { fontSize: 16, color: active ? '#FFFFFF' : isTodayCell ? accent : c.text100 }]}>
                    {day.getDate()}
                  </Text>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dot }} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingTop: 4, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {loading && medications.length === 0 ? (
            <ListRowsSkeleton rows={3} padded={false} />
          ) : dayDoses.length === 0 ? (
            <View style={{ paddingTop: 24 }}>
              <MedsEmptyState
                icon={Pill}
                art={EMPTY_ART.meds}
                title={isToday ? ka.meds.scheduleEmptyTitle : ka.meds.scheduleEmptyTitleOther}
                body={ka.meds.scheduleEmptyBody}
              >
                <MedsButton label={ka.meds.addMedicationCta} icon={Plus} onPress={() => router.push('/medications/add')} />
                <MedsButton label={ka.meds.quickSearch} icon={Search} tone="tonal" onPress={() => router.push('/medications/add/search')} />
              </MedsEmptyState>
            </View>
          ) : (
            <>
              <MedsCard style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ gap: 2 }}>
                    <Text style={[hubText.caption, { color: c.text200 }]}>{isToday ? ka.meds.todayLabel : ka.meds.dayDosesCount(dayDoses.length)}</Text>
                    <Text style={[hubText.value, { fontSize: 22, lineHeight: 28, color: c.text100 }]}>
                      {ka.meds.todayProgress(takenCount, dayDoses.length)}
                    </Text>
                  </View>
                  <Text style={[hubText.caption, { color: remaining === 0 ? c.success : c.text200 }]}>
                    {remaining === 0 ? ka.meds.todayAllTaken : ka.meds.remainingDoses(remaining)}
                  </Text>
                </View>
                <MedsProgressBar progress={dayDoses.length ? takenCount / dayDoses.length : 0} color={c.success} track={c.bg200} />
              </MedsCard>

              <View style={{ marginTop: 24 }}>
                {groups.map(([time, doses], groupIndex) => {
                  const last = groupIndex === groups.length - 1;
                  return (
                    <View key={time} style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ width: 48, alignItems: 'center' }}>
                        <View style={[s.timeBadge, { backgroundColor: hubTint(accent, dark) }]}>
                          <Text style={[hubText.value, { fontSize: 12, lineHeight: 16, color: accent }]}>{formatTime24h(time)}</Text>
                        </View>
                        {last ? null : <View style={{ flex: 1, width: 2, borderRadius: 1, backgroundColor: c.bg300, marginVertical: 6 }} />}
                      </View>
                      <View style={{ flex: 1, gap: 10, paddingBottom: last ? 0 : 18 }}>
                        {doses.map((dose) => {
                          const med = medications.find((item) => item.id === dose.medicationId);
                          const cfg = parseMedicationConfig(med?.config);
                          const log = findDoseLog(doseLogs, dose.medicationId, selectedYmd, dose.time);
                          const meal = cfg.mealTiming && cfg.mealTiming !== 'any' ? ka.meds.mealTiming[cfg.mealTiming] : null;
                          // One line that fits: the amount and how to take it (the time is the rail's badge).
                          const meta = [dose.dosage, meal].filter(Boolean).join(' · ');
                          return (
                            <MedsCard key={`${dose.medicationId}-${dose.time}`} style={{ padding: 14, gap: 12 }}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${dose.medName}, ${meta}`}
                                onPress={() => router.push(`/medications/${dose.medicationId}?time=${dose.time}&date=${selectedYmd}` as never)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                              >
                                <MedicationPillIcon color={cfg.pillColor} shape={cfg.pillShape} size={46} border imageUrl={images[dose.medicationId] ?? cfg.imageUrl} />
                                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                                  <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>
                                    {dose.medName}
                                  </Text>
                                  {meta ? (
                                    <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
                                      {meta}
                                    </Text>
                                  ) : null}
                                </View>
                                {log ? <StatusDot status={log.status} /> : <ChevronRight size={18} color={c.text300} strokeWidth={2} />}
                              </Pressable>
                              {!log ? (
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                  <MedsButton compact label={ka.meds.actionTake} icon={Check} onPress={() => void markDose(dose.medicationId, dose.time, 'taken')} style={{ flex: 1 }} />
                                  <MedsRoundAction icon={Clock} tone="tonal" onPress={() => setReschedule({ medicationId: dose.medicationId, time: dose.time })} accessibilityLabel={`${ka.meds.actionReschedule}: ${dose.medName}`} />
                                  <MedsRoundAction icon={X} tone="quiet" onPress={() => void markDose(dose.medicationId, dose.time, 'skipped')} accessibilityLabel={`${ka.meds.actionSkip}: ${dose.medName}`} />
                                </View>
                              ) : null}
                            </MedsCard>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <MedicationRescheduleSheet
        visible={!!reschedule}
        currentTime={reschedule?.time}
        onClose={() => setReschedule(null)}
        onPick={(time) => {
          if (!reschedule) return;
          void markDose(reschedule.medicationId, reschedule.time, 'taken', time);
        }}
      />
    </>
  );
}

/** A logged dose as a small round mark (✓ taken, ✕ skipped) — the name keeps the room a text pill took. */
function StatusDot({ status }: { status: DoseStatus }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const color = status === 'taken' ? c.success : status === 'skipped' ? doseAttentionInk(dark) : c.warning;
  const Icon = status === 'skipped' ? X : status === 'taken' ? Check : Clock;
  const label = status === 'taken' ? ka.meds.statusTaken : status === 'skipped' ? ka.meds.statusSkipped : ka.meds.statusPending;
  return (
    <View accessibilityLabel={label} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: hubTint(color, dark) }}>
      <Icon size={16} color={color} strokeWidth={2.8} />
    </View>
  );
}

const s = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayPill: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 3,
  },
  timeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 48,
    alignItems: 'center',
  },
});
