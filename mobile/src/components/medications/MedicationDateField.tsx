import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { MedicationSheetApplyButton, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { MedsIconTile, MedsRoundAction, medsPrimaryFill, medsInk } from '@/components/medications/MedsHubUI';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { digitsToYmd, isoToDigits, toDigits, ymdToDigits } from '@/lib/birthdate';
import { isoFromDigits } from '@/components/cycle/CycleDateField';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubText, hubTint } from '@/theme/hub';

type CalendarCell = {
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
  disabled: boolean;
  isToday: boolean;
  digits: string;
};

type Props = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minIso?: string;
  maxIso?: string;
  /** Kept for callers that pass it; every field now renders as a hub row. */
  embedded?: boolean;
  isLast?: boolean;
};

function startOfDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSelectable(year: number, month: number, day: number, minIso?: string, maxIso?: string) {
  const t = startOfDayMs(new Date(year, month - 1, day));
  if (minIso) {
    const [y, m, d] = minIso.split('-').map(Number);
    if (t < startOfDayMs(new Date(y, m - 1, d))) return false;
  }
  if (maxIso) {
    const [y, m, d] = maxIso.split('-').map(Number);
    if (t > startOfDayMs(new Date(y, m - 1, d))) return false;
  }
  return true;
}

function monthGrid(year: number, month: number, now: Date, minIso?: string, maxIso?: string): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: CalendarCell[] = [];

  const makeCell = (y: number, m: number, d: number, inMonth: boolean): CalendarCell => ({
    year: y,
    month: m,
    day: d,
    inMonth,
    disabled: !isSelectable(y, m, d, minIso, maxIso),
    isToday: now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d,
    digits: ymdToDigits(y, m, d),
  });

  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push(makeCell(y, m, day, false));
  }
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(makeCell(year, month, day, true));
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    cells.push(makeCell(y, m, nextDay, false));
    nextDay += 1;
  }
  return cells;
}

function displayDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function MedicationDateField({ label, value, onChange, minIso, maxIso, isLast }: Props) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayDate(value)}`}
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}
      >
        <MedsIconTile icon={Calendar} ink="blue" size={40} iconSize={19} />
        <Text style={[hubText.cardTitle, { flex: 1, fontSize: 14, lineHeight: 20, color: c.text100 }]}>{label}</Text>
        <Text style={[hubText.caption, { color: c.text300 }]}>{displayDate(value)}</Text>
        <ChevronRight size={17} color={c.text300} strokeWidth={2} />
      </Pressable>
      {isLast ? null : <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginLeft: 68 }} />}

      <MedicationCalendarModal
        visible={open}
        title={label}
        value={isoToDigits(value)}
        minIso={minIso}
        maxIso={maxIso}
        onClose={() => setOpen(false)}
        onConfirm={(digits) => {
          const iso = isoFromDigits(digits);
          if (iso) onChange(iso);
          setOpen(false);
        }}
      />
    </>
  );
}

function MedicationCalendarModal({
  visible,
  title,
  value,
  minIso,
  maxIso,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  value: string;
  minIso?: string;
  maxIso?: string;
  onClose: () => void;
  onConfirm: (digits: string) => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const accent = medsInk(dark);
  const primary = medsPrimaryFill(c, dark);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [visible]);

  const minYear = minIso ? Number(minIso.split('-')[0]) : now.getFullYear() - 1;
  const maxYear = maxIso ? Number(maxIso.split('-')[0]) : now.getFullYear() + 10;

  const initial = digitsToYmd(value) ?? { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };

  const [cursor, setCursor] = useState(initial);
  const [draft, setDraft] = useState(value);
  const [yearPicker, setYearPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const next = digitsToYmd(value) ?? initial;
    setCursor(next);
    setDraft(value);
    setYearPicker(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, value]);

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month, now, minIso, maxIso), [cursor.year, cursor.month, now, minIso, maxIso]);

  const draftOk =
    toDigits(draft).length === 8 &&
    (() => {
      const ymd = digitsToYmd(draft);
      return ymd ? isSelectable(ymd.year, ymd.month, ymd.day, minIso, maxIso) : false;
    })();

  const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, i) => minYear + i);

  const shiftMonth = (delta: number) => {
    setCursor((cur) => {
      const date = new Date(cur.year, cur.month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1, day: 1 };
    });
  };

  const previewIso = draftOk ? isoFromDigits(draft) : null;
  const preview = previewIso ? displayDate(previewIso) : ka.meds.pickDate;

  return (
    <MedicationSheetModal
      visible={visible}
      title={title}
      subtitle={preview}
      onClose={onClose}
      footer={<MedicationSheetApplyButton label={ka.meds.dateConfirm} disabled={!draftOk} onPress={() => draftOk && onConfirm(draft)} />}
    >
      <View style={{ paddingVertical: 6, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MedsRoundAction icon={ChevronLeft} tone="quiet" onPress={() => !yearPicker && shiftMonth(-1)} accessibilityLabel={ka.meds.weekPrev} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setYearPicker((v) => !v)}
            style={[s.monthBtn, { backgroundColor: c.bg200 }]}
          >
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>
              {yearPicker ? `${minYear} – ${maxYear}` : `${MONTHS_KA[cursor.month - 1]} ${cursor.year}`}
            </Text>
            <ChevronDown size={16} color={c.text200} />
          </Pressable>
          <MedsRoundAction icon={ChevronRight} tone="quiet" onPress={() => !yearPicker && shiftMonth(1)} accessibilityLabel={ka.meds.weekNext} />
        </View>

        {yearPicker ? (
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
              {years.map((year) => {
                const selected = cursor.year === year;
                return (
                  <Pressable
                    key={year}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setCursor((cur) => ({ ...cur, year }));
                      setYearPicker(false);
                    }}
                    style={{
                      flexBasis: '30%',
                      flexGrow: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: 'center',
                      backgroundColor: selected ? hubTint(accent, dark) : c.bg200,
                    }}
                  >
                    <Text style={[hubText.value, { color: selected ? accent : c.text100 }]}>{year}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS_KA.map((day) => (
                <View key={day} style={{ width: '14.2857%', alignItems: 'center', paddingVertical: 4 }}>
                  <Text style={[hubText.small, { color: c.text300 }]}>{day}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((cell) => {
                const selected = draft === cell.digits;
                return (
                  <View key={cell.digits + String(cell.inMonth)} style={{ width: '14.2857%', padding: 2 }}>
                    <Pressable
                      disabled={cell.disabled}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: cell.disabled }}
                      accessibilityLabel={`${cell.day} ${MONTHS_KA[cell.month - 1]}`}
                      onPress={() => {
                        if (cell.disabled) return;
                        setDraft(cell.digits);
                        setCursor({ year: cell.year, month: cell.month, day: cell.day });
                      }}
                      style={{
                        aspectRatio: 1,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? primary : cell.isToday ? hubTint(accent, dark) : 'transparent',
                        opacity: cell.disabled ? 0.28 : 1,
                      }}
                    >
                      <Text
                        style={[
                          hubText.value,
                          { fontSize: 14, color: selected ? '#FFFFFF' : cell.isToday ? accent : cell.inMonth ? c.text100 : c.text300 },
                        ]}
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
      </View>
    </MedicationSheetModal>
  );
}

const s = StyleSheet.create({
  monthBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
