import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { CycleDayMark } from '@/lib/api';
import { fertilityA11yBits } from '@/lib/cycleFertility';
import { CycleOvulationSparkle } from '@/components/cycle/CycleOvulationSparkle';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import {
  PREDICTED_NUMERAL_PREFIX,
  calendarDayA11y,
  classifyCycleDay,
  getCycleCalendarDayVisualState,
} from '@/lib/cyclePresentation.js';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { cycleHexAlpha, cycleShadow, useCycleColors } from '@/theme/cycle';

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
  /** Server/bundle civil today. Device local is only the fallback. */
  today?: string;
  /** When set, days that return false are dimmed and not tappable. */
  canSelect?: (iso: string) => boolean;
  /** Engine contraception presentation — hides fertility layers cleanly. */
  showFertility?: boolean;
  /** Low server confidence — hide predicted period / fertile / ovulation marks. */
  showPredicted?: boolean;
  /** Logged bleed a11y/legend. Postpartum uses neutral bleeding, not period. */
  loggedBleedLabel?: string;
};

export function CycleCalendar({ year, month, marks, selected, onSelect, onPrev, onNext, embedded, today: todayProp, canSelect, showFertility = true, showPredicted = true, loggedBleedLabel }: Props) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const today = todayProp || todayKey();
  const selectedSoft = cycleHexAlpha(c.ink, 0.07);
  const selectedRing = cycleHexAlpha(c.ink, 0.38);

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
            return <View key={`e-${idx}`} style={{ width: '14.2857%', height: 56 }} />;
          }
          const mark = marks[cell.key] || {};
          const isSelected = selected === cell.key;
          const isToday = today === cell.key;
          const blocked = canSelect ? !canSelect(cell.key) : false;
          const layers = classifyCycleDay(mark, { showFertility, showPredicted });
          const visual = getCycleCalendarDayVisualState({ layers, isSelected, isToday });

          const innerBg =
            visual.fill === 'loggedPeriod'
              ? c.period
              : visual.fill === 'selectedSoft'
                ? selectedSoft
                : 'transparent';
          const textColor = layers.loggedPeriod
            ? c.white
            : layers.predictedPeriod
              ? c.period
              : c.ink;
          const ringColor =
            visual.ring === 'today' ? c.todayRing : visual.ring === 'selected' ? selectedRing : 'transparent';

          const a11y = calendarDayA11y({
            dayLabel: `${cell.day} ${MONTHS_KA[month]}`,
            isToday,
            isSelected,
            layers,
            copy: {
              today: ka.cycle.jumpToday,
              selected: ka.cycle.selectedDay,
              loggedPeriod: loggedBleedLabel || ka.cycle.legendPeriod,
              classifiedPeriod: layers.ownerClassifiedPeriod ? ka.cycle.postpartumClassifiedA11y : '',
              spotting: ka.cycle.legendSpotting,
              predictedPeriod: ka.cycle.legendPeriodPredicted,
              fertile: ka.cycle.legendFertile,
              ovulation: ka.cycle.legendOvulation,
              symptoms: ka.cycle.legendLogged,
            },
          });
          const a11yExtra =
            showPredicted && showFertility
              ? fertilityA11yBits(mark)
                  .filter((bit) => bit !== ka.cycle.legendFertile && bit !== ka.cycle.legendOvulation)
                  .join(', ')
              : '';

          return (
            <Pressable
              key={cell.key}
              disabled={blocked}
              onPress={() => {
                if (blocked) return;
                onSelect(cell.key);
              }}
              accessibilityRole="button"
              accessibilityLabel={a11yExtra ? `${a11y}, ${a11yExtra}` : a11y}
              accessibilityState={{ selected: isSelected, disabled: blocked }}
              style={{
                width: '14.2857%',
                height: 56,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: blocked ? 0.28 : 1,
              }}
            >
              <Animated.View
                entering={isSelected && !reduceMotion ? FadeIn.duration(160) : undefined}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: visual.ring === 'none' ? 0 : 1.5,
                  borderColor: ringColor,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: innerBg,
                    borderWidth: visual.showPredictedDash ? 1.5 : layers.ownerClassifiedPeriod ? 2 : 0,
                    borderColor: visual.showPredictedDash
                      ? c.period
                      : layers.ownerClassifiedPeriod
                        ? c.white
                        : 'transparent',
                    borderStyle: visual.showPredictedDash ? 'dashed' : 'solid',
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: textColor,
                      fontWeight: isToday || isSelected ? '700' : '600',
                      fontSize: 14,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {visual.showPredictedPrefix ? `${PREDICTED_NUMERAL_PREFIX}${cell.day}` : cell.day}
                  </Text>
                </View>
              </Animated.View>

              <View style={{ height: 8, marginTop: 1, alignItems: 'center', justifyContent: 'center' }}>
                {visual.semanticIndicator === 'spottingDot' ? (
                  <View
                    style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.period }}
                  />
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
                  <View
                    style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.mutedSoft }}
                  />
                ) : null}
              </View>
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

export { todayKey, dateKey };
