import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { milestoneWeeks } from '@/lib/pregnancyWeekData.js';
import { useCycleColors } from '@/theme/cycle';

export function CyclePregnancyWeekSelector({
  week,
  currentWeek,
  onSelect,
}: {
  week: number;
  currentWeek?: number | null;
  onSelect: (week: number) => void;
}) {
  const c = useCycleColors();
  const scroll = useRef<ScrollView>(null);
  const marks = milestoneWeeks();

  useEffect(() => {
    const index = marks.indexOf(week as never);
    if (index >= 0) {
      scroll.current?.scrollTo({ x: Math.max(0, index * 64 - 40), animated: true });
    }
  }, [week, marks]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 4, gap: 8 }}
    >
      {marks.map((item) => {
        const selected = item === week;
        const isNow = item === currentWeek;
        return (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={
              isNow ? `${ka.cycle.pregnancyWeekTitle(item)}, ${ka.cycle.pregnancyNowChip}` : ka.cycle.pregnancyWeekTitle(item)
            }
            style={{
              minHeight: 44,
              minWidth: 56,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: selected ? c.rose : c.border,
              backgroundColor: selected ? c.roseSoft : c.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: selected ? c.ink : c.muted,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 14,
              }}
            >
              {item}
            </Text>
            {isNow ? (
              <Text style={{ color: c.rose, fontSize: 11, marginTop: 2 }}>{ka.cycle.pregnancyNowChip}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
