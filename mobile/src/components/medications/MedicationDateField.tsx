import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { MedFieldLabel, MedInputShell } from '@/components/medications/MedicationUI';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { digitsToYmd, isoToDigits, toDigits, ymdToDigits } from '@/lib/birthdate';
import { formatDateDisplay } from '@/lib/medications.shared';
import { isoFromDigits } from '@/components/cycle/CycleDateField';

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
};

function startOfDayMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSelectable(year: number, month: number, day: number, minIso?: string, maxIso?: string) {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(makeCell(year, month, day, true));
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    cells.push(makeCell(y, m, nextDay, false));
    nextDay += 1;
  }
  return cells;
}

export function MedicationDateField({ label, value, onChange, minIso, maxIso }: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <MedFieldLabel>{label}</MedFieldLabel>
      <MedInputShell onPress={() => setOpen(true)}>
        <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, letterSpacing: 1, color: FIGMA_MEDS.textSecondary }}>
          {formatDateDisplay(value)}
        </Text>
        <Calendar size={18} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
      </MedInputShell>

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
    </View>
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
  const FIGMA_MEDS = useFigmaMeds();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), [visible]);

  const minYear = minIso ? Number(minIso.split('-')[0]) : now.getFullYear() - 1;
  const maxYear = maxIso ? Number(maxIso.split('-')[0]) : now.getFullYear() + 10;

  const initial = digitsToYmd(value) ?? {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };

  const [cursor, setCursor] = useState(initial);
  const [draft, setDraft] = useState(value);
  const [yearPicker, setYearPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const next = digitsToYmd(value) ?? initial;
    setCursor(next);
    setDraft(value);
    setYearPicker(false);
  }, [visible, value]);

  const cells = useMemo(
    () => monthGrid(cursor.year, cursor.month, now, minIso, maxIso),
    [cursor.year, cursor.month, now, minIso, maxIso],
  );

  const draftOk =
    toDigits(draft).length === 8 &&
    (() => {
      const ymd = digitsToYmd(draft);
      return ymd ? isSelectable(ymd.year, ymd.month, ymd.day, minIso, maxIso) : false;
    })();

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const shiftMonth = (delta: number) => {
    setCursor((cur) => {
      const date = new Date(cur.year, cur.month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1, day: 1 };
    });
  };

  const preview = draftOk && isoFromDigits(draft) ? formatDateDisplay(isoFromDigits(draft)!) : ka.meds.pickDate;

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.52)' }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: FIGMA_MEDS.white,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 12,
            borderTopWidth: 1,
            borderColor: FIGMA_MEDS.border,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: FIGMA_MEDS.border,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: FIGMA_MEDS.textPrimary, fontSize: 20, fontWeight: '700' }}>{title}</Text>
              <Text style={{ color: FIGMA_MEDS.textSecondary, marginTop: 4, fontSize: 14 }}>{preview}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: FIGMA_MEDS.brandQuaternary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color={FIGMA_MEDS.brand} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <NavBtn onPress={() => !yearPicker && shiftMonth(-1)}>
              <ChevronLeft size={18} color={FIGMA_MEDS.textPrimary} strokeWidth={2.2} />
            </NavBtn>
            <Pressable
              onPress={() => setYearPicker((v) => !v)}
              style={{
                flex: 1,
                marginHorizontal: 8,
                backgroundColor: FIGMA_MEDS.brandQuaternary,
                borderRadius: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: FIGMA_MEDS.textPrimary, fontWeight: '700', fontSize: 15 }}>
                {yearPicker ? `${minYear} – ${maxYear}` : `${MONTHS_KA[cursor.month - 1]} ${cursor.year}`}
              </Text>
              <ChevronDown size={16} color={FIGMA_MEDS.brand} style={{ marginLeft: 6 }} />
            </Pressable>
            <NavBtn onPress={() => !yearPicker && shiftMonth(1)}>
              <ChevronRight size={18} color={FIGMA_MEDS.textPrimary} strokeWidth={2.2} />
            </NavBtn>
          </View>

          {yearPicker ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 }}>
              {years.map((year) => {
                const selected = cursor.year === year;
                return (
                  <Pressable
                    key={year}
                    onPress={() => {
                      setCursor((cur) => ({ ...cur, year }));
                      setYearPicker(false);
                    }}
                    style={{
                      width: '30%',
                      paddingVertical: 14,
                      borderRadius: 16,
                      alignItems: 'center',
                      backgroundColor: selected ? FIGMA_MEDS.brand : FIGMA_MEDS.brandQuaternary,
                    }}
                  >
                    <Text style={{ color: selected ? '#fff' : FIGMA_MEDS.textPrimary, fontWeight: '700', fontSize: 16 }}>
                      {year}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                {WEEKDAYS_KA.map((day) => (
                  <View key={day} style={{ width: '14.2857%', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ color: FIGMA_MEDS.textMuted, fontSize: 11, fontWeight: '700' }}>{day}</Text>
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
                          backgroundColor: selected ? FIGMA_MEDS.brand : 'transparent',
                          borderWidth: cell.isToday && !selected ? 1.5 : 0,
                          borderColor: FIGMA_MEDS.brand,
                          opacity: cell.disabled ? 0.25 : 1,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: '700',
                            fontSize: 14,
                            color: selected ? '#fff' : cell.inMonth ? FIGMA_MEDS.textPrimary : FIGMA_MEDS.textMuted,
                          }}
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

          <View style={{ marginTop: 18, paddingBottom: Math.max(insets.bottom, 16) }}>
            <Pressable
              disabled={!draftOk}
              onPress={() => draftOk && onConfirm(draft)}
              style={{
                backgroundColor: draftOk ? FIGMA_MEDS.brand : FIGMA_MEDS.border,
                borderRadius: 16,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: draftOk ? 1 : 0.55,
                ...FIGMA_MEDS.shadowInput,
              }}
            >
              <Check size={18} color="#fff" strokeWidth={2.6} />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>{ka.meds.dateConfirm}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NavBtn({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const FIGMA_MEDS = useFigmaMeds();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: FIGMA_MEDS.brandQuaternary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}
