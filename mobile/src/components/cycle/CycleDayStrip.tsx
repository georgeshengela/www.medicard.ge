import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Heart } from 'lucide-react-native';
import type { CycleDayMark } from '@/lib/api';
import { WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { addDaysToKey } from '@/lib/cyclePhase';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { PREDICTED_NUMERAL_PREFIX, classifyCycleDay, getCycleCalendarDayVisualState } from '@/lib/cyclePresentation.js';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

const COLS = 7;
/**
 * The strip opens with the selected day (today by default) in the middle column, three days either side.
 * Tapping a side day selects it without moving the strip (today stays put); swiping selects the middle day.
 */
const CENTER = 3;
const WEEK_RANGE = 40;
const GUTTER = 20;

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
  loggedBleedLabel?: string;
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
  loggedBleedLabel,
}: Props) {
  const c = useCycleColors();
  const { width: windowWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  // Same edges as every section below (20 px gutters); one page = one week.
  const screenWidth = Math.max(280, windowWidth - GUTTER * 2);
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
  }, [anchor, itemWidth]);

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
      listRef.current?.scrollToOffset({
        offset: Math.max(0, idx - CENTER) * itemWidth,
        animated,
      });
    },
    [dates, selected, itemWidth],
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

  // A width change (rotation, split screen, web resize) keeps the same list and only re-aligns it.
  // The list used to be keyed by the width: every resize remounted it, and until the new list had
  // laid out its far-away initial index the card showed no days at all (the „empty white strip“).
  const lastWidthRef = useRef(itemWidth);
  useEffect(() => {
    if (lastWidthRef.current === itemWidth) return;
    lastWidthRef.current = itemWidth;
    requestAnimationFrame(() => scrollToSelectedWeek(false));
  }, [itemWidth, scrollToSelectedWeek]);

  const pickDate = useCallback(
    (date: string, fromStrip = true) => {
      if (date === selected) return;
      if (fromStrip) skipScrollRef.current = true;
      onSelect(date);
      Haptics.selectionAsync().catch(() => undefined);
    },
    [onSelect, selected],
  );

  const todayIndex = dates.indexOf(today);
  // Opening already away from today (e.g. a date picked in the month calendar) shows the pill at once.
  const [awayFromToday, setAwayFromToday] = useState(
    () => todayIndex < 0 || selectedIndex < 0 || Math.abs(selectedIndex - todayIndex) > CENTER,
  );
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const centerIdx = Math.round(e.nativeEvent.contentOffset.x / itemWidth) + CENTER;
    const away = todayIndex < 0 || Math.abs(centerIdx - todayIndex) > CENTER;
    if (away !== awayFromToday) setAwayFromToday(away);
  };
  /** Quiet way home: today back in the middle column and selected. */
  const backToToday = () => {
    Haptics.selectionAsync().catch(() => undefined);
    setAwayFromToday(false);
    if (todayIndex >= 0) listRef.current?.scrollToOffset({ offset: Math.max(0, todayIndex - CENTER) * itemWidth, animated: true });
    if (selected !== today) {
      skipScrollRef.current = todayIndex >= 0;
      onSelect(today);
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (ignoreSnapRef.current) return;
    // The day in the middle column becomes the selected day.
    const next = dates[Math.round(e.nativeEvent.contentOffset.x / itemWidth) + CENTER];
    if (next) pickDate(next, true);
  };

  return (
    <View style={{ width: screenWidth, alignSelf: 'center' }}>
    <View style={{ borderRadius: 22, backgroundColor: c.card, overflow: 'hidden', paddingVertical: 6 }}>
      <FlatList
        ref={listRef}
        key={anchor}
        data={dates}
        horizontal
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        bounces
        initialScrollIndex={Math.max(0, (selectedIndex >= 0 ? selectedIndex : WEEK_RANGE * COLS) - CENTER)}
        getItemLayout={(_, index) => ({
          length: itemWidth,
          offset: itemWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              offset: info.index * itemWidth,
              animated: false,
            });
          }, 50);
        }}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={onScroll}
        scrollEventThrottle={48}
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
          const fertileDay = layers.fertile || layers.ovulation;
          const dayFill = layers.loggedPeriod
            ? c.period
            : fertileDay
              ? c.fertilitySoft
              : visual.fill === 'selectedSoft'
                ? cycleHexAlpha(c.ink, 0.07)
                : 'transparent';
          const dayInk = layers.loggedPeriod ? c.onPeriod : layers.predictedPeriod ? c.period : fertileDay ? c.fertile : c.ink;
          const a11y = [
            isToday ? ka.cycle.jumpToday : weekday,
            String(Number(dd)),
            layers.loggedPeriod ? loggedBleedLabel || ka.cycle.legendPeriod : null,
            layers.predictedPeriod ? ka.cycle.legendPeriodPredicted : null,
            layers.fertile ? ka.cycle.legendFertile : null,
            layers.ovulation ? ka.cycle.legendOvulation : null,
            layers.spotting ? ka.cycle.legendSpotting : null,
            layers.symptomDot ? ka.cycle.legendLogged : null,
            mark?.hasSex ? ka.cycle.a11ySex : null,
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
                minHeight: 76,
              }}
            >
              <Text
                style={{
                  color: isToday ? c.todayRing : active ? c.ink : c.mutedSoft,
                  fontSize: 10,
                  fontFamily: isToday ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold',
                  letterSpacing: 0.2,
                  marginBottom: 5,
                }}
              >
                {isToday ? ka.cycle.jumpToday : weekday}
              </Text>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: visual.ring === 'none' ? 0 : 1.5,
                  borderColor:
                    visual.ring === 'today'
                      ? c.todayRing
                      : visual.ring === 'selected'
                        ? cycleHexAlpha(c.ink, 0.35)
                        : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: dayFill,
                    borderWidth: visual.showPredictedDash || layers.ovulation ? 1.5 : 0,
                    borderColor: visual.showPredictedDash ? c.period : layers.ovulation ? c.fertile : 'transparent',
                    borderStyle: visual.showPredictedDash ? 'dashed' : 'solid',
                  }}
                >
                  <Text
                    style={{
                      color: dayInk,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 14,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {visual.showPredictedPrefix ? `${PREDICTED_NUMERAL_PREFIX}${Number(dd)}` : Number(dd)}
                  </Text>
                </View>
              </View>
              {/* Only logged things get a dot under the date; estimates are carried by the circle itself. */}
              <View style={{ height: 8, marginTop: 3, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
                {visual.semanticIndicator === 'spottingDot' ? (
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.period }} />
                ) : layers.symptomDot ? (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.mutedSoft }} />
                ) : null}
                {mark?.hasSex ? <Heart size={9} color={c.rose} fill={c.rose} strokeWidth={0} /> : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
    {awayFromToday ? (
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: -13, alignItems: 'center' }}>
        <Pressable
          onPress={backToToday}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.jumpToday}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 26, borderRadius: 13, backgroundColor: c.todayRing }}
        >
          <Text style={{ color: c.card, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, lineHeight: 15 }}>{ka.cycle.jumpToday}</Text>
        </Pressable>
      </View>
    ) : null}
    </View>
  );
}
