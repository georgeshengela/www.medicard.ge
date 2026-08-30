import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { CycleDayMark } from '@/lib/api';
import { fertilityA11yBits, hasFertilityObservation } from '@/lib/cycleFertility';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayKey() {
  const n = new Date();
  return dateKey(n.getFullYear(), n.getMonth(), n.getDate());
}

type Props = {
  year: number;
  month: number;
  marks: Record<string, CycleDayMark>;
  selected?: string | null;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  /** Drop card chrome when already inside a sheet. */
  embedded?: boolean;
};

export function CycleCalendar({ year, month, marks, selected, onSelect, onPrev, onNext, embedded }: Props) {
  const c = useCycleColors();
  const today = todayKey();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: ({ key: string; day: number } | null)[] = [];
    for (let i = 0; i < startPad; i += 1) out.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push({ key: dateKey(year, month, d), day: d });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={
        embedded
          ? { paddingTop: 4 }
          : {
              backgroundColor: c.card,
              borderRadius: 28,
              padding: 18,
              borderWidth: 1,
              borderColor: c.border,
              ...cycleShadow.card,
            }
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <NavBtn onPress={onPrev} c={c}>
          <ChevronLeft size={22} color={c.brand} strokeWidth={2.4} />
        </NavBtn>
        <Text
          style={{
            color: c.ink,
            fontSize: 17,
            fontFamily: 'NotoSansGeorgian_700Bold',
            letterSpacing: -0.3,
            flex: 1,
            textAlign: 'center',
          }}
        >
          {MONTHS_KA[month]} {year}
        </Text>
        <NavBtn onPress={onNext} c={c}>
          <ChevronRight size={22} color={c.brand} strokeWidth={2.4} />
        </NavBtn>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {WEEKDAYS_KA.map((w) => (
          <Text
            key={w}
            style={{
              flex: 1,
              textAlign: 'center',
              color: c.mutedSoft,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}
          >
            {w}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((cell, idx) => {
          if (!cell) {
            return <View key={`e-${idx}`} style={{ width: '14.2857%', height: 52 }} />;
          }
          const mark = marks[cell.key] || {};
          const isSelected = selected === cell.key;
          const isToday = today === cell.key;

          let bg = 'transparent';
          let textColor: string = c.ink;
          let ring = isSelected ? c.brand : isToday ? c.todayRing : 'transparent';
          let ringWidth = isSelected || isToday ? 2.5 : 0;
          const actualPeriod = Boolean(mark.period && !mark.predicted);
          const predictedPeriod = Boolean(mark.period && mark.predicted);
          if (mark.ovulation) {
            bg = c.ovulation;
            textColor = c.white;
          } else if (mark.fertile) {
            bg = c.fertile;
            textColor = c.white;
          } else if (actualPeriod) {
            bg = c.period;
            textColor = c.white;
          } else if (predictedPeriod) {
            bg = 'transparent';
            textColor = c.period;
            if (!isSelected) {
              ring = c.period;
              ringWidth = 2;
            }
          }

          const a11y = [
            `${cell.day}`,
            isToday ? ka.cycle.jumpToday : null,
            isSelected ? ka.cycle.selectedDay : null,
            actualPeriod ? ka.cycle.legendPeriod : null,
            predictedPeriod ? ka.cycle.legendPeriodPredicted : null,
            ...fertilityA11yBits(mark),
            mark.logged && !actualPeriod ? ka.cycle.legendLogged : null,
          ]
            .filter(Boolean)
            .join(', ');

          return (
            <Pressable
              key={cell.key}
              onPress={() => onSelect(cell.key)}
              accessibilityRole="button"
              accessibilityLabel={a11y}
              accessibilityState={{ selected: isSelected }}
              style={{
                width: '14.2857%',
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View
                entering={isSelected ? ZoomIn.duration(180) : undefined}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: bg,
                  borderWidth: ringWidth,
                  borderColor: ring,
                }}
              >
                <Text
                  style={{
                    color: textColor,
                    fontWeight: isToday || isSelected ? '800' : '600',
                    fontSize: 14,
                  }}
                >
                  {cell.day}
                </Text>
              </Animated.View>
              {hasFertilityObservation(mark) ? (
                <View
                  style={{
                    width: 5,
                    height: 5,
                    marginTop: 2,
                    borderWidth: 1.5,
                    borderColor: c.ink,
                    backgroundColor: 'transparent',
                    transform: [{ rotate: '45deg' }],
                  }}
                  accessibilityElementsHidden
                />
              ) : mark.logged && !actualPeriod && !mark.fertile && !mark.ovulation ? (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: c.blushDeep,
                    marginTop: 2,
                  }}
                />
              ) : (
                <View style={{ height: 6 }} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function NavBtn({
  onPress,
  children,
  c,
}: {
  onPress: () => void;
  children: React.ReactNode;
  c: ReturnType<typeof useCycleColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: c.cardSoft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export { todayKey, dateKey };
