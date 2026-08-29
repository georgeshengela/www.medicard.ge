import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Calendar, Check, Clock, Plus, X } from 'lucide-react-native';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

/** Figma monthly grid is Sunday-first; labels stay Georgian. */
const WEEKDAYS_SUN_KA = [WEEKDAYS_KA[6], ...WEEKDAYS_KA.slice(0, 6)] as const;
const MONTHS_AHEAD = 6;

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthLabelKa(month: number) {
  return MONTHS_KA[month];
}

type DayCell = { date: Date; inMonth: boolean };

function monthCells(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: DayCell[] = [];

  for (let i = startOffset; i > 0; i -= 1) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i + 1), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, next), inMonth: false });
    next += 1;
  }
  return cells;
}

type DayStatus = 'taken' | 'skipped' | 'pending' | 'none';

export default function MedicationCalendarScreen() {
  const FIGMA_MEDS = useFigmaMeds();
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { doseLogs } = useMedications();
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);
  const [anchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const months = useMemo(
    () => Array.from({ length: MONTHS_AHEAD }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth() + i, 1)),
    [anchor],
  );

  const statusByDate = useMemo(() => {
    const map = new Map<string, DayStatus>();
    const grouped = new Map<string, string[]>();
    for (const log of doseLogs) {
      const list = grouped.get(log.date) ?? [];
      list.push(log.status);
      grouped.set(log.date, list);
    }
    for (const [date, statuses] of grouped) {
      if (statuses.every((status) => status === 'taken')) map.set(date, 'taken');
      else if (statuses.some((status) => status === 'skipped')) map.set(date, 'skipped');
      else map.set(date, 'pending');
    }
    return map;
  }, [doseLogs]);

  const openDay = (date: Date) => {
    router.push({ pathname: '/medications/reminders', params: { date: ymd(date) } });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.meds.calendarTitle,
          headerRight: () => (
            <Pressable onPress={() => router.push('/medications/reminders')} hitSlop={12} accessibilityLabel={ka.meds.remindersScreenTitle}>
              <Calendar size={24} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
            </Pressable>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.pageBg }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: FIGMA_MEDS.headerBg }}>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS_SUN_KA.map((label) => (
              <Text
                key={label}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 14,
                  fontWeight: '600',
                  lineHeight: 20,
                  color: FIGMA_MEDS.textPrimary,
                  paddingBottom: 2,
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {months.map((monthDate) => {
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth();
            const cells = monthCells(year, month);
            const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
            let taken = 0;
            let skipped = 0;
            for (const [date, status] of statusByDate) {
              if (!date.startsWith(prefix)) continue;
              if (status === 'taken') taken += 1;
              if (status === 'skipped') skipped += 1;
            }

            return (
              <View key={prefix} style={{ paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 24,
                      fontWeight: '600',
                      lineHeight: 32,
                      letterSpacing: -0.25,
                      color: FIGMA_MEDS.textPrimary,
                    }}
                  >
                    {monthLabelKa(month)}
                  </Text>
                  {taken + skipped === 0 ? (
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_500Medium',
                        fontSize: 14,
                        fontWeight: '500',
                        lineHeight: 20,
                        color: FIGMA_MEDS.textSecondary,
                      }}
                    >
                      {ka.meds.calendarNoStatus}
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_500Medium',
                          fontSize: 14,
                          fontWeight: '500',
                          lineHeight: 20,
                          color: FIGMA_MEDS.textSecondary,
                        }}
                      >
                        {ka.meds.calendarTakenCount(taken)}
                      </Text>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: FIGMA_MEDS.border }} />
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_500Medium',
                          fontSize: 14,
                          fontWeight: '500',
                          lineHeight: 20,
                          color: FIGMA_MEDS.textSecondary,
                        }}
                      >
                        {ka.meds.calendarSkippedCount(skipped)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                  {Array.from({ length: cells.length / 7 }, (_, week) => (
                    <View key={`${prefix}-w${week}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                        const key = ymd(cell.date);
                        const selected = sameDay(cell.date, today);
                        const status = cell.inMonth ? (statusByDate.get(key) ?? 'none') : 'none';
                        return (
                          <Pressable
                            key={key}
                            onPress={() => openDay(cell.date)}
                            style={{
                              flex: 1,
                              minWidth: 44,
                              padding: 8,
                              gap: 4,
                              alignItems: 'center',
                              borderRadius: 8,
                              backgroundColor: selected ? FIGMA_MEDS.brandQuaternary : 'transparent',
                              borderWidth: selected ? 1 : 0,
                              borderColor: selected ? FIGMA_MEDS.brand : 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: 'NotoSansGeorgian_500Medium',
                                fontSize: 14,
                                fontWeight: '500',
                                lineHeight: 20,
                                textAlign: 'center',
                                color: selected
                                  ? FIGMA_MEDS.brand
                                  : cell.inMonth
                                    ? FIGMA_MEDS.textPrimary
                                    : FIGMA_MEDS.textMuted,
                              }}
                            >
                              {cell.date.getDate()}
                            </Text>
                            <StatusDot status={status} colors={colors} pageBg={FIGMA_MEDS.pageBg} border={FIGMA_MEDS.border} />
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>

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
      </View>
    </>
  );
}

function StatusDot({
  status,
  colors,
  pageBg,
  border,
}: {
  status: DayStatus;
  colors: ReturnType<typeof useThemeColors>;
  pageBg: string;
  border: string;
}) {
  if (status === 'none') {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: pageBg,
          borderWidth: 1,
          borderColor: border,
        }}
      />
    );
  }

  const fill = status === 'taken' ? colors.success : status === 'skipped' ? colors.danger : colors.warning;
  const Icon = status === 'taken' ? Check : status === 'skipped' ? X : Clock;

  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={14} color="#FFFFFF" strokeWidth={2.6} />
    </View>
  );
}
