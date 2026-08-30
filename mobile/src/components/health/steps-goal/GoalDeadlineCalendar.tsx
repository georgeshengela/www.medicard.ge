import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { GoalCheck, GoalChevronLeft, GoalCloseX } from '@/components/health/steps-goal/StepsGoalIcons';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';

type Cell = {
  ymd: string;
  day: number;
  inMonth: boolean;
  disabled: boolean;
  isToday: boolean;
};

type Props = {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (ymd: string) => void;
};

function toYmd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function deadlineGrid(year: number, month: number, now: Date): Cell[] {
  const today = startOfDay(now);
  const max = new Date(now);
  max.setFullYear(max.getFullYear() + 1);
  const maxT = startOfDay(max);
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: Cell[] = [];

  const push = (y: number, m: number, day: number, inMonth: boolean) => {
    const t = startOfDay(new Date(y, m - 1, day));
    cells.push({
      ymd: toYmd(y, m, day),
      day,
      inMonth,
      disabled: t < today || t > maxT,
      isToday: t === today,
    });
  };

  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    push(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, day, false);
  }
  for (let day = 1; day <= daysInMonth; day += 1) push(year, month, day, true);
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    push(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, nextDay, false);
    nextDay += 1;
  }
  return cells;
}

export function GoalDeadlineCalendar({ visible, value, onClose, onSelect }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), [visible]);
  const [cursor, setCursor] = useState(() => ({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }));
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!visible) return;
    const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    setCursor({
      year: parsed ? Number(parsed[1]) : now.getFullYear(),
      month: parsed ? Number(parsed[2]) : now.getMonth() + 1,
    });
    setDraft(value);
  }, [visible, value, now]);

  const cells = useMemo(
    () => deadlineGrid(cursor.year, cursor.month, now),
    [cursor.year, cursor.month, now],
  );

  const shiftMonth = (delta: number) => {
    const date = new Date(cursor.year, cursor.month - 1 + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() + 1 });
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: APP_MODAL_OVERLAY }]}
        />
        <View
          style={{
            backgroundColor: FIGMA_STEPS.cardBg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderColor: FIGMA_STEPS.border,
          }}
        >
          <View style={{ alignItems: 'center', height: 16, justifyContent: 'center' }}>
            <View style={{ width: 36, height: 5, borderRadius: 100, backgroundColor: FIGMA_STEPS.border }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 16 }}>
            <Text
              style={{
                flex: 1,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 18,
                lineHeight: 24,
                color: FIGMA_STEPS.textPrimary,
              }}
            >
              {ka.stepsGoal.pickDeadline}
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <GoalCloseX size={24} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: FIGMA_STEPS.pageBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GoalChevronLeft size={20} color={FIGMA_STEPS.textPrimary} />
            </Pressable>
            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: FIGMA_STEPS.textPrimary,
              }}
            >
              {ka.auth.months[cursor.month - 1]} {cursor.year}
            </Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: FIGMA_STEPS.pageBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <GoalChevronLeft size={20} color={FIGMA_STEPS.textPrimary} />
              </View>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {ka.auth.weekdays.map((day) => (
              <View key={day} style={{ width: '14.2857%', alignItems: 'center', paddingVertical: 6 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 12,
                    lineHeight: 16,
                    color: FIGMA_STEPS.textSecondary,
                  }}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((cell) => {
              const selected = draft === cell.ymd;
              return (
                <View key={cell.ymd + String(cell.inMonth)} style={{ width: '14.2857%', padding: 2 }}>
                  <Pressable
                    disabled={cell.disabled}
                    onPress={() => setDraft(cell.ymd)}
                    style={{
                      aspectRatio: 1,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? FIGMA_STEPS.brand : 'transparent',
                      borderWidth: cell.isToday && !selected ? 1.5 : 0,
                      borderColor: FIGMA_STEPS.brand,
                      opacity: cell.disabled ? 0.28 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_600SemiBold',
                        fontSize: 14,
                        lineHeight: 20,
                        color: selected
                          ? '#FFFFFF'
                          : cell.inMonth
                            ? FIGMA_STEPS.textPrimary
                            : FIGMA_STEPS.textSecondary,
                      }}
                    >
                      {cell.day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onSelect(draft);
              onClose();
            }}
            style={{
              marginTop: 16,
              backgroundColor: FIGMA_STEPS.brand,
              height: 48,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              ...FIGMA_STEPS.shadowXs,
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: '#FFFFFF',
              }}
            >
              {ka.auth.birthDateConfirm}
            </Text>
            <GoalCheck size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
