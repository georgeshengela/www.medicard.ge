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
import { useCycleColors } from '@/theme/cycle';

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
};

export function CycleDayStrip({ selected, onSelect, marks, onLongPress }: Props) {
  const c = useCycleColors();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const sidePad = Math.max(0, (screenWidth - ITEM_WIDTH) / 2);
  const today = todayKey();
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
    <View style={{ marginBottom: 8 }}>
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

          const actualPeriod = Boolean(mark?.period && mark.predicted === false);
          const predictedPeriod = Boolean(mark?.period && mark.predicted);
          let dot: string = c.mutedSoft;
          if (mark?.ovulation) dot = c.ovulation;
          else if (mark?.fertile) dot = c.fertile;
          else if (actualPeriod) dot = c.period;
          else if (mark?.logged) dot = c.blushDeep;
          const a11y = [
            isToday ? ka.cycle.jumpToday : weekday,
            String(Number(dd)),
            actualPeriod ? ka.cycle.legendPeriod : null,
            predictedPeriod ? ka.cycle.legendPeriodPredicted : null,
            mark?.fertile && !mark?.ovulation ? ka.cycle.legendFertile : null,
            mark?.ovulation ? ka.cycle.legendOvulation : null,
            mark?.logged && !actualPeriod ? ka.cycle.legendLogged : null,
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
                  width: active ? 44 : 38,
                  height: active ? 44 : 38,
                  borderRadius: active ? 22 : 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? c.card : 'transparent',
                  borderWidth: active || isToday ? 2 : 0,
                  borderColor: active ? (isToday ? c.todayRing : c.brand) : isToday ? c.todayRing : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: active ? 17 : 15,
                  }}
                >
                  {Number(dd)}
                </Text>
              </View>
              <View
                style={{
                  width: predictedPeriod ? 7 : 5,
                  height: predictedPeriod ? 7 : 5,
                  borderRadius: 4,
                  backgroundColor: predictedPeriod ? 'transparent' : dot,
                  borderWidth: predictedPeriod ? 1.5 : 0,
                  borderColor: predictedPeriod ? c.period : 'transparent',
                  marginTop: 6,
                  opacity: mark ? 1 : 0.25,
                }}
              />
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
