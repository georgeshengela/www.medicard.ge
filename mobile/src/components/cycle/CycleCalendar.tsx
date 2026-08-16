import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { CycleDayMark } from '@/lib/api';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
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
};

export function CycleCalendar({ year, month, marks, selected, onSelect, onPrev, onNext }: Props) {
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
      style={{
        backgroundColor: c.card,
        borderRadius: 28,
        padding: 18,
        borderWidth: 1,
        borderColor: c.border,
        ...cycleShadow.card,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <NavBtn onPress={onPrev} c={c}>
          <ChevronLeft size={20} color={c.rose} strokeWidth={2.4} />
        </NavBtn>
        <Text style={{ color: c.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
          {MONTHS_KA[month]} {year}
        </Text>
        <NavBtn onPress={onNext} c={c}>
          <ChevronRight size={20} color={c.rose} strokeWidth={2.4} />
        </NavBtn>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
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
            return <View key={`e-${idx}`} style={{ width: '14.2857%', height: 48 }} />;
          }
          const mark = marks[cell.key] || {};
          const isSelected = selected === cell.key;
          const isToday = today === cell.key;

          let bg = 'transparent';
          let textColor = c.ink;
          if (mark.ovulation) {
            bg = c.ovulation;
            textColor = '#fff';
          } else if (mark.fertile) {
            bg = c.fertile;
            textColor = '#fff';
          } else if (mark.period) {
            bg = mark.predicted ? `${c.period}88` : c.period;
            textColor = '#fff';
          }

          return (
            <Pressable
              key={cell.key}
              onPress={() => onSelect(cell.key)}
              style={{
                width: '14.2857%',
                height: 48,
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
                  borderWidth: isSelected || isToday ? 2.5 : 0,
                  borderColor: isSelected ? c.rose : isToday ? c.todayRing : 'transparent',
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
              {mark.logged && !mark.period && !mark.fertile && !mark.ovulation ? (
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
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: c.roseSoft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export function cycleDayNumber(lastPeriodStart: string | null, today = todayKey()) {
  if (!lastPeriodStart) return null;
  const [ay, am, ad] = lastPeriodStart.split('-').map(Number);
  const [by, bm, bd] = today.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  const days = Math.round(ms / 86_400_000);
  if (days < 0) return null;
  return days + 1;
}

export { todayKey, dateKey };
