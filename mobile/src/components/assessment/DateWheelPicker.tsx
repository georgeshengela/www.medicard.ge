import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { pickerScrollTick, pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useIsDark } from '@/theme/colors';

/** Figma node 9217:164479 — birthdate picker row. */
const FIGMA_PICKER = {
  itemHeight: 50,
  visibleRows: 5,
  columnGap: 16,
  rowPaddingX: 16,
  fontSize: 24,
  lineHeight: 32,
  letterSpacing: -0.25,
  selectedBg: '#F0FDFA',
  selectedBorder: '#14B8A6',
  selectedText: '#14B8A6',
  nearText: '#4B5563',
  farText: '#9CA3AF',
  selectedRadius: 18,
} as const;

const FIGMA_PICKER_DARK = {
  selectedBg: '#042F2E',
  nearText: '#D1D5DB',
  farText: '#6B7280',
} as const;

const ITEM_HEIGHT = FIGMA_PICKER.itemHeight;
const VISIBLE_ROWS = FIGMA_PICKER.visibleRows;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const SETTLE_MS = 280;

type Props = {
  month: number;
  day: number;
  year: number;
  onChange: (patch: { month?: number; day?: number; year?: number }) => void;
  minYear?: number;
  maxYear?: number;
};

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

function textColorForDistance(distance: number, nearText: string, farText: string) {
  if (distance === 0) return FIGMA_PICKER.selectedText;
  if (distance === 1) return nearText;
  return farText;
}

function clampDayForMonthYear(day: number, month: number, year: number) {
  return Math.min(Math.max(1, day), daysInMonth(month, year));
}

/** Figma birthdate — 3-column wheel with shared teal selection row (9217:164472). */
export function DateWheelPicker({ month, day, year, onChange, minYear, maxYear }: Props) {
  const dark = useIsDark();
  const picker = dark ? { ...FIGMA_PICKER, ...FIGMA_PICKER_DARK } : FIGMA_PICKER;
  const now = new Date().getFullYear();
  const yearMin = minYear ?? now - 100;
  const yearMax = maxYear ?? now - 13;
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const years = useMemo(() => Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMax - i), [yearMax, yearMin]);
  const days = useMemo(() => {
    const max = daysInMonth(month, year);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [month, year]);

  const safeDay = clampDayForMonthYear(day, month, year);
  const monthLabel = useCallback((m: number) => ka.assessment.months[m - 1] ?? String(m), []);

  const emitChange = useCallback(
    (patch: { month?: number; day?: number; year?: number }) => {
      const nextMonth = patch.month ?? month;
      const nextYear = patch.year ?? year;
      const rawDay = patch.day ?? day;
      const nextDay = clampDayForMonthYear(rawDay, nextMonth, nextYear);

      const result: { month?: number; day?: number; year?: number } = {};
      if (patch.month !== undefined && nextMonth !== month) result.month = nextMonth;
      if (patch.year !== undefined && nextYear !== year) result.year = nextYear;
      if (patch.day !== undefined && nextDay !== day) result.day = nextDay;
      if (nextDay !== day && (patch.month !== undefined || patch.year !== undefined)) {
        result.day = nextDay;
      }
      if (Object.keys(result).length > 0) onChange(result);
    },
    [day, month, onChange, year],
  );

  const onMonthSelect = useCallback((v: string | number) => emitChange({ month: Number(v) }), [emitChange]);
  const onDaySelect = useCallback((v: string | number) => emitChange({ day: Number(v) }), [emitChange]);
  const onYearSelect = useCallback((v: string | number) => emitChange({ year: Number(v) }), [emitChange]);

  return (
    <View style={{ width: '100%', alignSelf: 'stretch', paddingVertical: 32 }}>
      <View style={{ height: PICKER_HEIGHT, width: '100%', position: 'relative' }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: PAD,
            left: 0,
            right: 0,
            height: ITEM_HEIGHT,
            borderRadius: FIGMA_PICKER.selectedRadius,
            borderWidth: 1,
            borderColor: FIGMA_PICKER.selectedBorder,
            backgroundColor: picker.selectedBg,
            zIndex: 0,
          }}
        />

        <View style={{ flex: 1, flexDirection: 'row', zIndex: 1, gap: FIGMA_PICKER.columnGap, paddingHorizontal: FIGMA_PICKER.rowPaddingX }}>
          <ColumnWheel
            flex={1.35}
            values={months}
            selected={month}
            onSelect={onMonthSelect}
            format={(v) => monthLabel(Number(v))}
          />
          <ColumnWheel
            flex={0.85}
            values={days}
            selected={safeDay}
            onSelect={onDaySelect}
            format={(v) => String(v).padStart(2, '0')}
          />
          <ColumnWheel
            flex={1.1}
            values={years}
            selected={year}
            onSelect={onYearSelect}
          />
        </View>
      </View>
    </View>
  );
}

function ColumnWheel({
  values,
  selected,
  onSelect,
  flex,
  format = (v) => String(v),
}: {
  values: (string | number)[];
  selected: string | number;
  onSelect: (v: string | number) => void;
  flex: number;
  format?: (v: string | number) => string;
}) {
  const dark = useIsDark();
  const picker = dark ? { ...FIGMA_PICKER, ...FIGMA_PICKER_DARK } : FIGMA_PICKER;
  const scrollRef = useRef<ScrollView>(null);
  const dragging = useRef(false);
  const settling = useRef(false);
  const lastHapticIndex = useRef(-1);
  const pendingSyncIndex = useRef<number | null>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);

  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  const selectedIndex = clampIndex(Math.max(0, values.indexOf(selected)), values.length);
  const [centerIndex, setCenterIndex] = useState(selectedIndex);

  const snapOffsets = useMemo(() => values.map((_, index) => index * ITEM_HEIGHT), [values]);

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated });
  }, []);

  const applySync = useCallback(
    (index: number) => {
      const safeIndex = clampIndex(index, values.length);
      pendingSyncIndex.current = null;
      setCenterIndex(safeIndex);
      lastHapticIndex.current = safeIndex;
      requestAnimationFrame(() => scrollToIndex(safeIndex, false));
    },
    [scrollToIndex, values.length],
  );

  useEffect(() => {
    if (dragging.current || settling.current) {
      pendingSyncIndex.current = selectedIndex;
      return;
    }
    applySync(selectedIndex);
  }, [applySync, selectedIndex]);

  const finishSettling = useCallback(() => {
    settling.current = false;
    dragging.current = false;
    const pending = pendingSyncIndex.current;
    if (pending !== null && !dragging.current) {
      applySync(pending);
    }
  }, [applySync]);

  const settleAtOffset = useCallback(
    (offsetY: number) => {
      if (values.length === 0) return;
      if (settling.current) return;

      settling.current = true;
      dragging.current = false;

      const index = clampIndex(Math.round(offsetY / ITEM_HEIGHT), values.length);
      scrollToIndex(index, true);
      setCenterIndex(index);

      if (index !== lastHapticIndex.current) {
        lastHapticIndex.current = index;
        pickerSelectionTick();
      }

      const value = values[index];
      if (value !== undefined && value !== selectedRef.current) {
        onSelectRef.current(value);
      }

      setTimeout(finishSettling, SETTLE_MS);
    },
    [finishSettling, scrollToIndex, values],
  );

  return (
    <View style={{ flex, height: PICKER_HEIGHT, overflow: 'hidden' }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={{ paddingVertical: PAD, backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        decelerationRate={Platform.OS === 'ios' ? 0.992 : 0.98}
        scrollEventThrottle={16}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        onScrollBeginDrag={() => {
          dragging.current = true;
          settling.current = false;
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const index = clampIndex(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), values.length);
          if (index !== centerIndex) setCenterIndex(index);
          if (dragging.current && index !== lastHapticIndex.current) {
            lastHapticIndex.current = index;
            pickerScrollTick();
          }
        }}
        onMomentumScrollEnd={(e) => settleAtOffset(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => {
          if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.08) {
            settleAtOffset(e.nativeEvent.contentOffset.y);
          }
        }}
      >
        {values.map((value, index) => {
          const distance = Math.abs(index - centerIndex);
          return (
            <View
              key={String(value)}
              style={{
                height: ITEM_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: FIGMA_PICKER.fontSize,
                  lineHeight: FIGMA_PICKER.lineHeight,
                  letterSpacing: FIGMA_PICKER.letterSpacing,
                  color: textColorForDistance(distance, picker.nearText, picker.farText),
                  textAlign: 'center',
                }}
              >
                {format(value)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function birthDateIso(month: number, day: number, year: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function parseBirthDate(iso: string | null | undefined): { month: number; day: number; year: number } {
  if (!iso) {
    const y = new Date().getFullYear() - 25;
    return { month: 6, day: 15, year: y };
  }
  const [y, m, d] = iso.split('-').map(Number);
  return { month: m || 6, day: d || 15, year: y || new Date().getFullYear() - 25 };
}

export function ageFromBirthDate(month: number, day: number, year: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const md = (today.getMonth() + 1) * 100 + today.getDate();
  const bd = month * 100 + day;
  if (md < bd) age -= 1;
  return age;
}

export const DATE_PICKER_HEIGHT = PICKER_HEIGHT;
