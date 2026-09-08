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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { CycleDayMark } from '@/lib/api';
import { WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { addDaysToKey } from '@/lib/cyclePhase';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { CycleOvulationSparkle } from '@/components/cycle/CycleOvulationSparkle';
import { PREDICTED_NUMERAL_PREFIX, classifyCycleDay, getCycleCalendarDayVisualState } from '@/lib/cyclePresentation.js';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

const ITEM_WIDTH = 56;
const RANGE = 60;

function weekdayLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const idx = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return WEEKDAYS_KA[idx];
}

type Props = {
  selected: string;
  onSelect: (date: string) => void;
  marks: Record<string, CycleDayMark>;
  onLongPress?: (date: string) => void;
  /** Server/bundle civil today. Device local is only the fallback. */
  today?: string;
  showFertility?: boolean;
  showPredicted?: boolean;
  /** Keep cells out of the Quick Log FAB column. */
  reservedRight?: number;
};

export function CycleDayStrip({
  selected,
  onSelect,
  marks,
  onLongPress,
  today: todayProp,
  showFertility = true,
  showPredicted = true,
  reservedRight = 0,
}: Props) {
  const c = useCycleColors();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const listWidth = Math.max(ITEM_WIDTH, screenWidth - reservedRight);
  const sidePad = Math.max(0, (listWidth - ITEM_WIDTH) / 2);
  const today = todayProp || todayKey();
  const skipScrollRef = useRef(false);
  const [anchor, setAnchor] = useState(selected);

  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = -RANGE; i <= RANGE; i += 1) {
      out.push(addDaysToKey(anchor, i));
    }
    return out;
  }, [anchor]);

  const selectedIndex = dates.indexOf(selected);
  const initialIndex = selectedIndex >= 0 ? selectedIndex : RANGE;

  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      if (index < 0 || index >= dates.length) return;
      listRef.current?.scrollToIndex({
        index,
        animated,
        viewPosition: 0.5,
      });
    },
    [dates.length],
  );

  useEffect(() => {
    if (selectedIndex === -1) {
      setAnchor(selected);
    }
  }, [selected, selectedIndex]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    const idx = dates.indexOf(selected);
    if (idx >= 0) {
      requestAnimationFrame(() => scrollToIndex(idx, true));
    }
  }, [selected, dates, scrollToIndex]);

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
    const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH);
    const clamped = Math.min(dates.length - 1, Math.max(0, idx));
    const next = dates[clamped];
    if (next) pickDate(next, true);
  };

  return (
    <View style={{ marginBottom: 8, width: listWidth, overflow: 'hidden' }}>
      <FlatList
        ref={listRef}
        key={anchor}
        data={dates}
        horizontal
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        bounces={false}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{ paddingHorizontal: sidePad, paddingVertical: 6 }}
        getItemLayout={(_, index) => ({
          length: ITEM_WIDTH,
          offset: sidePad + ITEM_WIDTH * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => scrollToIndex(info.index, false), 50);
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
                const idx = dates.indexOf(item);
                if (idx >= 0) scrollToIndex(idx, true);
              }}
              onLongPress={() => {
                onLongPress?.(item);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              }}
              accessibilityRole="button"
              accessibilityLabel={a11y}
              accessibilityState={{ selected: active }}
              style={{
                width: ITEM_WIDTH,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 2,
                minHeight: 88,
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

      {/* Soft edge fades — hints swipe, no buttons */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <LinearGradient
          colors={[c.cream, `${c.cream}00`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: 28, height: '100%' }}
        />
        <LinearGradient
          colors={[`${c.cream}00`, c.cream]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: 28, height: '100%' }}
        />
      </View>
    </View>
  );
}
