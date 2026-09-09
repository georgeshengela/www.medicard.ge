import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { CycleDayMark } from '@/lib/api';
import { WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { addDaysToKey } from '@/lib/cyclePhase';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { CycleOvulationSparkle } from '@/components/cycle/CycleOvulationSparkle';
import { PREDICTED_NUMERAL_PREFIX, classifyCycleDay, getCycleCalendarDayVisualState } from '@/lib/cyclePresentation.js';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

const COLS = 7;
const WEEK_RANGE = 40;

function weekdayLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const idx = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return WEEKDAYS_KA[idx];
}

function mondayOf(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDaysToKey(key, -dow);
}

type Props = {
  selected: string;
  onSelect: (date: string) => void;
  marks: Record<string, CycleDayMark>;
  /** User tap only — never from snap/scroll. */
  onActivate?: (date: string) => void;
  onLongPress?: (date: string) => void;
  today?: string;
  showFertility?: boolean;
  showPredicted?: boolean;
};

export function CycleDayStrip({
  selected,
  onSelect,
  marks,
  onActivate,
  onLongPress,
  today: todayProp,
  showFertility = true,
  showPredicted = true,
}: Props) {
  const c = useCycleColors();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const itemWidth = screenWidth / COLS;
  const today = todayProp || todayKey();
  const skipScrollRef = useRef(false);
  const ignoreSnapRef = useRef(true);
  const [anchor, setAnchor] = useState(() => mondayOf(selected));

  useEffect(() => {
    ignoreSnapRef.current = true;
    const t = setTimeout(() => {
      ignoreSnapRef.current = false;
    }, 350);
    return () => clearTimeout(t);
  }, [anchor, screenWidth]);

  const dates = useMemo(() => {
    const start = mondayOf(anchor);
    const out: string[] = [];
    for (let i = -WEEK_RANGE * COLS; i < WEEK_RANGE * COLS; i += 1) {
      out.push(addDaysToKey(start, i));
    }
    return out;
  }, [anchor]);

  const selectedIndex = dates.indexOf(selected);

  const scrollToSelectedWeek = useCallback(
    (animated = true) => {
      const idx = dates.indexOf(selected);
      if (idx < 0) return;
      const weekStart = idx - (idx % COLS);
      listRef.current?.scrollToOffset({
        offset: (weekStart / COLS) * screenWidth,
        animated,
      });
    },
    [dates, selected, screenWidth],
  );

  useEffect(() => {
    if (selectedIndex === -1) {
      setAnchor(mondayOf(selected));
    }
  }, [selected, selectedIndex]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    requestAnimationFrame(() => scrollToSelectedWeek(true));
  }, [selected, dates, scrollToSelectedWeek]);

  const pickDate = useCallback(
    (date: string, fromStrip = true) => {
      if (date === selected) return;
      if (fromStrip) skipScrollRef.current = true;
      onSelect(date);
      Haptics.selectionAsync().catch(() => undefined);
    },
    [onSelect, selected],
  );

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (ignoreSnapRef.current) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    const col = selectedIndex >= 0 ? selectedIndex % COLS : 0;
    const next = dates[page * COLS + col];
    if (next) pickDate(next, true);
  };

  return (
    <View style={{ width: screenWidth, marginBottom: 4 }}>
      <FlatList
        ref={listRef}
        key={`${anchor}-${screenWidth}`}
        data={dates}
        horizontal
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        decelerationRate="fast"
        bounces
        initialScrollIndex={selectedIndex >= 0 ? selectedIndex - (selectedIndex % COLS) : WEEK_RANGE * COLS}
        getItemLayout={(_, index) => ({
          length: itemWidth,
          offset: itemWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              offset: (Math.floor(info.index / COLS) * screenWidth),
              animated: false,
            });
          }, 50);
        }}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => {
          const active = item === selected;
          const isToday = item === today;
          const mark = marks[item];
          const [, , dd] = item.split('-');
          const weekday = weekdayLabel(item);

          const layers = classifyCycleDay(mark, { showFertility, showPredicted });
          const visual = getCycleCalendarDayVisualState({
            layers,
            isSelected: active,
            isToday,
          });
          const a11y = [
            isToday ? ka.cycle.jumpToday : weekday,
            String(Number(dd)),
            layers.loggedPeriod ? ka.cycle.legendPeriod : null,
            layers.predictedPeriod ? ka.cycle.legendPeriodPredicted : null,
            layers.fertile ? ka.cycle.legendFertile : null,
            layers.ovulation ? ka.cycle.legendOvulation : null,
            layers.spotting ? ka.cycle.legendSpotting : null,
            layers.symptomDot ? ka.cycle.legendLogged : null,
          ]
            .filter(Boolean)
            .join(', ');

          return (
            <Pressable
              onPress={() => {
                pickDate(item, true);
                onActivate?.(item);
              }}
              onLongPress={() => {
                onLongPress?.(item);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              }}
              accessibilityRole="button"
              accessibilityLabel={a11y}
              accessibilityState={{ selected: active }}
              style={{
                width: itemWidth,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 2,
                minHeight: 84,
              }}
            >
              <Text
                style={{
                  color: active ? c.brand : c.mutedSoft,
                  fontSize: 10,
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  letterSpacing: 0.2,
                  marginBottom: 6,
                }}
              >
                {isToday ? ka.cycle.jumpToday : weekday}
              </Text>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: visual.ring === 'none' ? 0 : 1.5,
                  borderColor:
                    visual.ring === 'today'
                      ? c.todayRing
                      : visual.ring === 'selected'
                        ? cycleHexAlpha(c.ink, 0.38)
                        : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      visual.fill === 'loggedPeriod'
                        ? c.period
                        : visual.fill === 'selectedSoft'
                          ? cycleHexAlpha(c.ink, 0.07)
                          : 'transparent',
                    borderWidth: visual.showPredictedDash ? 1.5 : 0,
                    borderColor: visual.showPredictedDash ? c.period : 'transparent',
                    borderStyle: visual.showPredictedDash ? 'dashed' : 'solid',
                  }}
                >
                  <Text
                    style={{
                      color: layers.loggedPeriod ? c.white : layers.predictedPeriod ? c.period : c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 15,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {visual.showPredictedPrefix ? `${PREDICTED_NUMERAL_PREFIX}${Number(dd)}` : Number(dd)}
                  </Text>
                </View>
              </View>
              <View style={{ height: 10, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}>
                {visual.semanticIndicator === 'spottingDot' ? (
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.period }} />
                ) : visual.semanticIndicator === 'ovulationSparkle' ? (
                  <CycleOvulationSparkle color={c.ovulation} size={8} />
                ) : visual.semanticIndicator === 'fertileDots' ? (
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: c.fertile }}
                      />
                    ))}
                  </View>
                ) : visual.semanticIndicator === 'symptomDot' ? (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.mutedSoft }} />
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
