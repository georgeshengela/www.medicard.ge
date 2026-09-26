import React, { useCallback, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ListChecks, Plus } from 'lucide-react-native';
import { MedicationHeaderAction } from '@/components/medications/MedicationNavHeader';
import { MedsCard, medsPrimaryFill } from '@/components/medications/MedsHubUI';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { parseMedicationConfig } from '@/lib/medications.shared';
import { medicationCourseIncludesDate } from '@/lib/notificationPlan';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import type { Medication, ScheduledDose } from '@/lib/api';

const MONTHS_BACK = 2;
const MONTHS_AHEAD = 4;

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type DayCell = { date: Date; inMonth: boolean };

/** Monday-first grid, padded with the neighbouring months' days. */
function monthCells(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: DayCell[] = [];
  for (let i = startOffset; i > 0; i -= 1) cells.push({ date: new Date(year, month - 1, daysInPrev - i + 1), inMonth: false });
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ date: new Date(year, month, day), inMonth: true });
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, next), inMonth: false });
    next += 1;
  }
  return cells;
}

type DayStatus = 'taken' | 'skipped' | 'mixed' | 'planned' | 'none';

function hasScheduledDose(medications: Medication[], schedule: ScheduledDose[], date: Date): boolean {
  const key = ymd(date);
  const dow = (date.getDay() + 6) % 7;
  return medications.some((med) => {
    if (!med.active || !schedule.some((dose) => dose.medicationId === med.id)) return false;
    const cfg = parseMedicationConfig(med.config);
    if (!medicationCourseIncludesDate(cfg, key)) return false;
    return !cfg.daysOfWeek?.length || cfg.daysOfWeek.includes(dow);
  });
}

export default function MedicationCalendarScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { medications, schedule, doseLogs } = useMedications();
  const scrollRef = useRef<ScrollView>(null);
  const scrolledRef = useRef(false);

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const months = useMemo(
    () =>
      Array.from({ length: MONTHS_BACK + MONTHS_AHEAD }, (_, i) => new Date(today.getFullYear(), today.getMonth() - MONTHS_BACK + i, 1)),
    [today],
  );

  const logStatusByDate = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const log of doseLogs) {
      const list = grouped.get(log.date) ?? [];
      list.push(log.status);
      grouped.set(log.date, list);
    }
    const map = new Map<string, DayStatus>();
    for (const [date, statuses] of grouped) {
      const taken = statuses.some((status) => status === 'taken');
      const skipped = statuses.some((status) => status === 'skipped');
      map.set(date, taken && skipped ? 'mixed' : skipped ? 'skipped' : 'taken');
    }
    return map;
  }, [doseLogs]);

  const statusFor = useCallback(
    (date: Date): DayStatus => {
      const logged = logStatusByDate.get(ymd(date));
      if (logged) return logged;
      return hasScheduledDose(medications, schedule, date) ? 'planned' : 'none';
    },
    [logStatusByDate, medications, schedule],
  );

  const dotColor = (status: DayStatus, onPrimary: boolean) => {
    if (onPrimary) return status === 'none' ? 'transparent' : 'rgba(255,255,255,0.9)';
    switch (status) {
      case 'taken':
        return c.success;
      case 'skipped':
        return c.danger;
      case 'mixed':
        return c.warning;
      case 'planned':
        return c.bg300;
      default:
        return 'transparent';
    }
  };

  const openDay = (date: Date) => router.push({ pathname: '/medications/reminders', params: { date: ymd(date) } });

  const onMonthLayout = (key: string) => (event: LayoutChangeEvent) => {
    if (key !== currentKey || scrolledRef.current) return;
    scrolledRef.current = true;
    const y = event.nativeEvent.layout.y;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: false }));
  };

  const primary = medsPrimaryFill(c, dark);
  const legend: { status: DayStatus; label: string }[] = [
    { status: 'taken', label: ka.meds.calendarLegendTaken },
    { status: 'skipped', label: ka.meds.calendarLegendSkipped },
    { status: 'planned', label: ka.meds.calendarLegendPlanned },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.meds.calendarTitle,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <MedicationHeaderAction icon={ListChecks} onPress={() => router.push('/medications/reminders')} accessibilityLabel={ka.meds.calendarOpenSchedule} />
              <MedicationHeaderAction icon={Plus} onPress={() => router.push('/medications/add/search')} accessibilityLabel={ka.meds.quickAdd} />
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: c.bg100 }}>
        <View style={{ paddingHorizontal: HUB.gutter, paddingTop: 2, paddingBottom: 10, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            {legend.map((item) => (
              <View key={item.status} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor(item.status, false) }} />
                <Text style={[hubText.small, { color: c.text200 }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', paddingHorizontal: HUB.cardPad - 4 }}>
            {WEEKDAYS_KA.map((label) => (
              <Text key={label} style={[hubText.small, { flex: 1, textAlign: 'center', color: c.text300 }]}>
                {label}
              </Text>
            ))}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 32, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {months.map((monthDate) => {
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;
            const cells = monthCells(year, month);
            let taken = 0;
            let skipped = 0;
            let planned = 0;
            for (const cell of cells) {
              if (!cell.inMonth) continue;
              const status = statusFor(cell.date);
              if (status === 'taken' || status === 'mixed') taken += 1;
              if (status === 'skipped' || status === 'mixed') skipped += 1;
              if (status === 'planned' && cell.date >= today) planned += 1;
            }
            const summary =
              taken + skipped > 0
                ? [taken ? ka.meds.calendarTakenCount(taken) : null, skipped ? ka.meds.calendarSkippedCount(skipped) : null].filter(Boolean).join(' · ')
                : planned > 0
                  ? ka.meds.calendarPlannedCount(planned)
                  : ka.meds.calendarNoStatus;

            return (
              <View key={key} onLayout={onMonthLayout(key)}>
                <MedsCard style={{ paddingHorizontal: HUB.cardPad - 4, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 }}>
                    <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100 }]}>
                      {MONTHS_KA[month]}
                    </Text>
                    <Text style={[hubText.caption, { color: c.text300, flex: 1 }]}>{year}</Text>
                    <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>
                      {summary}
                    </Text>
                  </View>

                  {Array.from({ length: cells.length / 7 }, (_, week) => (
                    <View key={`${key}-w${week}`} style={{ flexDirection: 'row' }}>
                      {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                        const isToday = sameDay(cell.date, today);
                        const status = cell.inMonth ? statusFor(cell.date) : 'none';
                        return (
                          <Pressable
                            key={ymd(cell.date)}
                            accessibilityRole="button"
                            accessibilityLabel={`${cell.date.getDate()} ${MONTHS_KA[cell.date.getMonth()]}`}
                            onPress={() => openDay(cell.date)}
                            style={s.cell}
                          >
                            <View style={[s.number, isToday ? { backgroundColor: primary } : null]}>
                              <Text
                                style={[
                                  hubText.value,
                                  {
                                    fontSize: 14,
                                    color: isToday ? '#FFFFFF' : cell.inMonth ? c.text100 : c.text300,
                                    opacity: cell.inMonth ? 1 : 0.55,
                                  },
                                ]}
                              >
                                {cell.date.getDate()}
                              </Text>
                            </View>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dotColor(status, false) }} />
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </MedsCard>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  number: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
