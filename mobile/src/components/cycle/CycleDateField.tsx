import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import {
  digitsToYmd,
  formatBirthDateInput,
  isoToDigits,
  normalizeIsoDate,
  toDigits,
  ymdToDigits,
} from '@/lib/birthdate';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

type RangeMode = 'past' | 'due';

type CycleCalendarCell = {
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
  disabled: boolean;
  isToday: boolean;
  digits: string;
};

type Props = {
  label?: string;
  /** ISO `YYYY-MM-DD` */
  value: string;
  onChange: (iso: string) => void;
  hint?: string;
  placeholder?: string;
  /** `past` = last period (≤ today, 18 months back). `due` = due date (today → +10 months). */
  range?: RangeMode;
  /** `hero` = large tappable card that clearly opens the calendar */
  variant?: 'default' | 'hero';
  /**
   * Native Modals (especially nested / New Architecture) drop confirms on Expo Go.
   * Default: inline on iOS/Android, overlay Modal on web.
   */
  inline?: boolean;
};

/** Same calendar UX as registration DateField, tuned for cycle dates. */
export function CycleDateField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  range = 'past',
  variant = 'default',
  inline,
}: Props) {
  const c = useCycleColors();
  const useInline = inline ?? Platform.OS !== 'web';
  const [open, setOpen] = useState(useInline && variant === 'hero');
  const iso = normalizeIsoDate(value);
  const digits = isoToDigits(iso || null);
  const displayKa = iso ? formatCycleDateKa(iso) : '';
  const displayDots = formatBirthDateInput(digits);
  const hero = variant === 'hero';

  return (
    <View style={{ width: '100%' }}>
      {label && !hero ? (
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
          {label}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityHint={ka.cycle.onboardTapHint}
        onPress={() => setOpen(true)}
        style={({ pressed }) =>
          hero
            ? {
                backgroundColor: displayKa ? c.card : c.cardSoft,
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: displayKa ? c.brand : c.border,
                borderStyle: displayKa ? 'solid' : 'dashed',
                opacity: pressed ? 0.92 : 1,
              }
            : {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: c.card,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 15,
                borderWidth: 1,
                borderColor: displayKa ? c.brand : c.border,
                opacity: pressed ? 0.9 : 1,
                ...cycleShadow.card,
              }
        }
      >
        {hero ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: c.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarDays size={24} color={c.brand} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, marginLeft: 14, marginRight: 8, minWidth: 0 }}>
              <Text
                style={{
                  color: displayKa ? c.ink : c.brand,
                  fontSize: displayKa ? 17 : 14,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  lineHeight: displayKa ? 22 : 20,
                }}
                numberOfLines={2}
              >
                {displayKa || placeholder || ka.cycle.onboardTapCalendar}
              </Text>
              {!displayKa ? (
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 12,
                    fontWeight: '600',
                    marginTop: 4,
                  }}
                >
                  {ka.cycle.onboardOpenCalendar}
                </Text>
              ) : (
                <Text
                  style={{
                    color: c.brand,
                    fontSize: 12,
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    marginTop: 4,
                  }}
                >
                  {ka.cycle.onboardChangeDate}
                </Text>
              )}
            </View>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c.cta,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronRight size={18} color="#fff" strokeWidth={2.6} />
            </View>
          </View>
        ) : (
          <>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                backgroundColor: c.cardSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarDays size={20} color={c.brand} strokeWidth={2.2} />
            </View>
            <Text
              style={{
                marginLeft: 12,
                flex: 1,
                fontSize: 16,
                fontWeight: displayKa ? '700' : '500',
                color: displayKa ? c.ink : c.mutedSoft,
              }}
            >
              {displayKa || displayDots || placeholder || ka.cycle.pickDate}
            </Text>
            <View
              style={{
                backgroundColor: c.cardSoft,
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12 }}>
                {displayKa ? ka.cycle.onboardChangeDate : ka.cycle.onboardOpenCalendar}
              </Text>
            </View>
          </>
        )}
      </Pressable>

      {hint && !hero ? (
        <Text style={{ color: c.mutedSoft, fontSize: 12, marginTop: 8, lineHeight: 16 }}>{hint}</Text>
      ) : null}

      <CycleCalendarModal
        visible={open}
        inline={useInline}
        value={digits}
        title={label || ka.cycle.lastPeriod}
        range={range}
        onClose={() => setOpen(false)}
        onConfirm={(nextDigits) => {
          const ymd = digitsToYmd(nextDigits);
          if (!ymd) return;
          const iso = `${ymd.year}-${String(ymd.month).padStart(2, '0')}-${String(ymd.day).padStart(2, '0')}`;
          onChange(iso);
          setOpen(false);
        }}
      />
    </View>
  );
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isCycleSelectable(
  year: number,
  month: number,
  day: number,
  now: Date,
  range: RangeMode,
) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false;
  }
  const t = startOfDay(date);
  const today = startOfDay(now);
  if (range === 'due') {
    if (t < today) return false;
    const max = new Date(now);
    max.setMonth(max.getMonth() + 10);
    if (t > startOfDay(max)) return false;
    return true;
  }
  if (t > today) return false;
  const min = new Date(now);
  min.setMonth(min.getMonth() - 18);
  if (t < startOfDay(min)) return false;
  return true;
}

function cycleMonthGrid(year: number, month: number, now: Date, range: RangeMode): CycleCalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: CycleCalendarCell[] = [];

  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push(makeCycleCell(y, m, day, false, now, range));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(makeCycleCell(year, month, day, true, now, range));
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    cells.push(makeCycleCell(y, m, nextDay, false, now, range));
    nextDay += 1;
  }

  return cells;
}

function makeCycleCell(
  year: number,
  month: number,
  day: number,
  inMonth: boolean,
  now: Date,
  range: RangeMode,
): CycleCalendarCell {
  return {
    year,
    month,
    day,
    inMonth,
    disabled: !isCycleSelectable(year, month, day, now, range),
    isToday: now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day,
    digits: ymdToDigits(year, month, day),
  };
}

function CycleCalendarModal({
  visible,
  inline,
  value,
  title,
  range,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  inline?: boolean;
  value: string;
  title: string;
  range: RangeMode;
  onClose: () => void;
  onConfirm: (digits: string) => void;
}) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), [visible]);
  const minDate = useMemo(() => {
    const d = new Date(now);
    if (range === 'due') return d;
    d.setMonth(d.getMonth() - 18);
    return d;
  }, [now, range]);
  const minYear = range === 'due' ? now.getFullYear() : minDate.getFullYear();
  const maxYear = range === 'due' ? now.getFullYear() + 1 : now.getFullYear();

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
    const next = digitsToYmd(value) ?? {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
    setCursor(next);
    setDraft(value);
    setYearPicker(false);
  }, [visible, value, now]);

  const cells = useMemo(
    () => cycleMonthGrid(cursor.year, cursor.month, now, range),
    [cursor.year, cursor.month, now, range],
  );
  const draftOk = toDigits(draft).length === 8 && (() => {
    const ymd = digitsToYmd(draft);
    return ymd ? isCycleSelectable(ymd.year, ymd.month, ymd.day, now, range) : false;
  })();

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const shiftMonth = (delta: number) => {
    setCursor((cur) => {
      const date = new Date(cur.year, cur.month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1, day: 1 };
    });
  };

  const previewLabel = draftOk
    ? isoFromDigits(draft)
      ? formatCycleDateKa(isoFromDigits(draft)!)
      : formatBirthDateInput(draft)
    : ka.cycle.pickDate;

  if (!visible) return null;

  const pickDay = (digits: string, year: number, month: number, day: number) => {
    setDraft(digits);
    setCursor({ year, month, day });
    if (inline) onConfirm(digits);
  };

  const sheet = (
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: inline ? 16 : 28,
            borderTopRightRadius: inline ? 16 : 28,
            borderBottomLeftRadius: inline ? 16 : 0,
            borderBottomRightRadius: inline ? 16 : 0,
            paddingHorizontal: 20,
            paddingTop: 12,
            borderWidth: inline ? 1 : 0,
            borderTopWidth: 1,
            borderColor: c.border,
            marginTop: inline ? 12 : 0,
          }}
        >
          {inline ? null : (
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: c.creamDeep,
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: c.ink, fontSize: inline ? 15 : 20, fontFamily: 'NotoSansGeorgian_700Bold' }}>{title}</Text>
              <Text style={{ color: c.muted, marginTop: 4, fontSize: 13 }}>
                {previewLabel}
              </Text>
            </View>
            {inline ? null : (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={ka.common.close}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: c.cardSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} color={c.ink} strokeWidth={2.2} />
              </Pressable>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <NavBtn c={c} onPress={() => !yearPicker && shiftMonth(-1)}>
              <ChevronLeft size={18} color={c.ink} strokeWidth={2.2} />
            </NavBtn>
            <Pressable
              onPress={() => setYearPicker((v) => !v)}
              style={{
                flex: 1,
                marginHorizontal: 8,
                backgroundColor: c.cardSoft,
                borderRadius: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                {yearPicker
                  ? `${minYear} – ${maxYear}`
                  : `${MONTHS_KA[cursor.month - 1]} ${cursor.year}`}
              </Text>
              <ChevronDown size={16} color={c.brand} style={{ marginLeft: 6 }} />
            </Pressable>
            <NavBtn c={c} onPress={() => !yearPicker && shiftMonth(1)}>
              <ChevronRight size={18} color={c.ink} strokeWidth={2.2} />
            </NavBtn>
          </View>

          {yearPicker ? (
            <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 8 }}>
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
                      flex: 1,
                      paddingVertical: 16,
                      borderRadius: 16,
                      alignItems: 'center',
                      backgroundColor: selected ? c.cta : c.cardSoft,
                    }}
                  >
                    <Text style={{ color: selected ? '#fff' : c.ink, fontWeight: '800', fontSize: 16 }}>
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
                    <Text style={{ color: c.mutedSoft, fontSize: 11, fontWeight: '700' }}>{day}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {cells.map((cell) => {
                  const selected = draft === cell.digits;
                  return (
                    <View
                      key={cell.digits + String(cell.inMonth)}
                      style={{ width: '14.2857%', padding: 2 }}
                    >
                      <Pressable
                        disabled={cell.disabled}
                        onPress={() => {
                          if (cell.disabled) return;
                          pickDay(cell.digits, cell.year, cell.month, cell.day);
                        }}
                        style={{
                          aspectRatio: 1,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? c.card : 'transparent',
                          borderWidth: selected || cell.isToday ? 2 : 0,
                          borderColor: selected ? c.brand : c.todayRing,
                          opacity: cell.disabled ? 0.25 : 1,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: '700',
                            fontSize: 14,
                            color: cell.inMonth ? c.ink : c.mutedSoft,
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

          {inline ? (
            <View style={{ height: 12 }} />
          ) : (
            <View style={{ marginTop: 18, paddingBottom: Math.max(insets.bottom, 16) }}>
              <Pressable
                disabled={!draftOk}
                onPress={() => {
                  if (draftOk) onConfirm(draft);
                }}
                style={{
                  backgroundColor: draftOk ? c.cta : c.creamDeep,
                  borderRadius: 16,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: draftOk ? 1 : 0.55,
                  ...cycleShadow.soft,
                }}
              >
                <Check size={18} color="#fff" strokeWidth={2.6} />
                <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, marginLeft: 8 }}>
                  {ka.auth.birthDateConfirm}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
  );

  if (inline) return sheet;

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: c.overlay }]}
        />
        {sheet}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
});

function NavBtn({
  c,
  onPress,
  children,
}: {
  c: ReturnType<typeof useCycleColors>;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: c.cardSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}

export function isoFromDigits(digits: string): string | null {
  const ymd = digitsToYmd(digits);
  if (!ymd) return null;
  return `${ymd.year}-${String(ymd.month).padStart(2, '0')}-${String(ymd.day).padStart(2, '0')}`;
}
