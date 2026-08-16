import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Button } from './Button';
import { ka } from '@/i18n/ka';
import {
  ageFromBirthDate,
  birthYearBounds,
  digitsToYmd,
  formatBirthDateInput,
  monthGrid,
  parseBirthDate,
} from '@/lib/birthdate';
import { useThemeColors } from '@/theme/colors';

type Props = {
  label?: string;
  /** Raw digits, e.g. `15051990`. */
  value: string;
  onChangeText: (digits: string) => void;
  error?: string | null;
  hint?: string;
};

const DEFAULT_AGE = 25;

export function DateField({ label, value, onChangeText, error, hint }: Props) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const display = formatBirthDateInput(value);
  const parsed = parseBirthDate(value);

  return (
    <View className="w-full">
      {label ? <Text className="mb-1.5 text-sm font-semibold text-text-200">{label}</Text> : null}

      <Pressable
        testID="birth-date-field"
        accessibilityRole="button"
        accessibilityLabel={label ?? ka.auth.birthDate}
        onPress={() => setOpen(true)}
        className={`flex-row items-center rounded-2xl border bg-surface px-4 py-3.5 active:opacity-80 ${
          error ? 'border-state-danger' : 'border-bg-300'
        }`}
      >
        <CalendarDays size={18} color={display ? colors.primary200 : colors.text300} strokeWidth={2} />
        <Text className={`ml-3 flex-1 text-base ${display ? 'text-text-100' : 'text-text-300'}`}>
          {display || ka.auth.birthDatePlaceholder}
        </Text>
        {parsed.ok ? (
          <View className="rounded-full bg-accent-100 px-2.5 py-1">
            <Text className="text-xs font-bold text-primary-100">{ka.auth.yearsOld(parsed.age)}</Text>
          </View>
        ) : null}
      </Pressable>

      {error ? (
        <Text className="mt-1.5 text-sm text-state-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-sm text-text-300">{hint}</Text>
      ) : null}

      <BirthCalendar
        visible={open}
        value={value}
        onClose={() => setOpen(false)}
        onConfirm={(digits) => {
          onChangeText(digits);
          setOpen(false);
        }}
      />
    </View>
  );
}

function BirthCalendar({
  visible,
  value,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (digits: string) => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), [visible]);
  const { minYear, maxYear } = birthYearBounds(now);

  const initial = digitsToYmd(value) ?? {
    year: now.getFullYear() - DEFAULT_AGE,
    month: now.getMonth() + 1,
    day: Math.min(now.getDate(), 28),
  };

  const [cursor, setCursor] = useState(initial);
  const [draft, setDraft] = useState(value);
  const [yearPicker, setYearPicker] = useState(false);
  const [yearPage, setYearPage] = useState(Math.floor(initial.year / 12) * 12);

  useEffect(() => {
    if (!visible) return;
    const next = digitsToYmd(value) ?? {
      year: now.getFullYear() - DEFAULT_AGE,
      month: now.getMonth() + 1,
      day: Math.min(now.getDate(), 28),
    };
    setCursor(next);
    setDraft(value);
    setYearPicker(false);
    setYearPage(Math.floor(next.year / 12) * 12);
  }, [visible, value, now]);

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month, now), [cursor.year, cursor.month, now]);
  const parsedDraft = parseBirthDate(draft);
  const years = useMemo(
    () => Array.from({ length: 12 }, (_, index) => yearPage + index).filter((year) => year >= minYear && year <= maxYear),
    [yearPage, minYear, maxYear],
  );

  const shiftMonth = (delta: number) => {
    const date = new Date(cursor.year, cursor.month - 1 + delta, 1);
    const year = Math.min(maxYear, Math.max(minYear, date.getFullYear()));
    setCursor((current) => ({ ...current, year, month: date.getMonth() + 1 }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-text-100/45" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl border-t border-bg-300 bg-bg-100 px-5 pt-3"
          onPress={() => undefined}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-bg-300" />

          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-bold text-text-100">{ka.auth.birthDate}</Text>
              <Text className="mt-0.5 text-sm text-text-300">
                {parsedDraft.ok
                  ? `${formatBirthDateInput(draft)} · ${ka.auth.yearsOld(parsedDraft.age)}`
                  : ka.auth.birthDatePlaceholder}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.common.close}
              hitSlop={12}
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-bg-200"
            >
              <X size={18} color={colors.text200} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View className="mb-3 flex-row items-center">
            <Pressable
              testID="calendar-prev"
              accessibilityRole="button"
              onPress={() =>
                yearPicker
                  ? setYearPage((page) => Math.max(minYear, page - 12))
                  : shiftMonth(-1)
              }
              className="h-10 w-10 items-center justify-center rounded-full bg-bg-200 active:opacity-70"
            >
              <ChevronLeft size={18} color={colors.text100} strokeWidth={2.2} />
            </Pressable>

            <Pressable
              testID="calendar-year-toggle"
              accessibilityRole="button"
              accessibilityLabel={ka.auth.birthDatePickYear}
              onPress={() => setYearPicker((open) => !open)}
              className="mx-2 flex-1 flex-row items-center justify-center rounded-2xl bg-bg-200 py-2.5 active:opacity-80"
            >
              <Text className="text-base font-bold text-text-100">
                {yearPicker
                  ? `${yearPage} – ${yearPage + 11}`
                  : `${ka.auth.months[cursor.month - 1]} ${cursor.year}`}
              </Text>
              <ChevronDown
                size={16}
                color={colors.text200}
                strokeWidth={2.4}
                style={{ marginLeft: 6, transform: [{ rotate: yearPicker ? '180deg' : '0deg' }] }}
              />
            </Pressable>

            <Pressable
              testID="calendar-next"
              accessibilityRole="button"
              onPress={() =>
                yearPicker
                  ? setYearPage((page) => Math.min(maxYear - 11, page + 12))
                  : shiftMonth(1)
              }
              className="h-10 w-10 items-center justify-center rounded-full bg-bg-200 active:opacity-70"
            >
              <ChevronRight size={18} color={colors.text100} strokeWidth={2.2} />
            </Pressable>
          </View>

          {yearPicker ? (
            <View className="flex-row flex-wrap pb-2">
              {years.map((year) => {
                const selected = cursor.year === year;
                return (
                  <View key={year} style={{ width: '25%', padding: 4 }}>
                    <Pressable
                      testID={`calendar-year-${year}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setCursor((current) => ({ ...current, year }));
                        setYearPicker(false);
                      }}
                      className={`items-center rounded-2xl py-3.5 ${selected ? 'bg-primary-200' : 'bg-surface'}`}
                    >
                      <Text className={`text-base font-bold ${selected ? 'text-white' : 'text-text-100'}`}>{year}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <>
              <View className="mb-1 flex-row">
                {ka.auth.weekdays.map((day) => (
                  <View key={day} style={{ width: '14.2857%' }} className="items-center py-1.5">
                    <Text className="text-xs font-bold text-text-300">{day}</Text>
                  </View>
                ))}
              </View>

              <View className="flex-row flex-wrap">
                {cells.map((cell) => {
                  const selected = draft === cell.digits;
                  return (
                    <View key={cell.digits + String(cell.inMonth)} style={{ width: '14.2857%', padding: 2 }}>
                      <Pressable
                        testID={cell.inMonth ? `calendar-day-${cell.day}` : undefined}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: cell.disabled }}
                        accessibilityLabel={`${cell.day} ${ka.auth.months[cell.month - 1]} ${cell.year}`}
                        disabled={cell.disabled}
                        onPress={() => {
                          setDraft(cell.digits);
                          setCursor({ year: cell.year, month: cell.month, day: cell.day });
                        }}
                        className={`aspect-square items-center justify-center rounded-full ${
                          selected ? 'bg-primary-200' : cell.isToday ? 'border border-primary-200' : ''
                        }`}
                        style={{ opacity: cell.disabled ? 0.28 : 1 }}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            selected
                              ? 'text-white'
                              : cell.inMonth
                                ? 'text-text-100'
                                : 'text-text-300'
                          }`}
                        >
                          {cell.day}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <View className="mt-5" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <Button
              testID="calendar-confirm"
              label={ka.auth.birthDateConfirm}
              icon={Check}
              size="lg"
              disabled={!parsedDraft.ok}
              onPress={() => {
                if (parsedDraft.ok) onConfirm(draft);
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
