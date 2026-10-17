import React from 'react';
import { Text, View } from 'react-native';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { ka } from '@/i18n/ka';
import { formatLiters } from '@/lib/hydration';

type Props = {
  /** Day totals in ml, Monday first (`useHydration().weekTotals`). */
  values: number[];
  goalMl: number;
  /** Index of today in `values`; later days are still ahead and draw no bar. */
  todayIndex: number;
};

const PLOT_H = 168;
/** Room above the tallest bar for its value label. */
const HEADROOM = 18;

/**
 * „1კ“ on the water screen: this week's real day totals as bars, Monday to Sunday, with the daily goal
 * as a line. It used to draw two fixed Figma violins whatever was logged (2026-10-13 audit).
 * A bar at or over the goal is solid, a shorter one paler; days still ahead show only the track.
 */
export function HydrationWeekChart({ values, goalMl, todayIndex }: Props) {
  const T = useFigmaHydration();
  const days = ka.hydration.weekdayMon.map((label, i) => ({
    label,
    ml: Math.max(0, Math.round(values[i] ?? 0)),
    ahead: i > todayIndex,
    today: i === todayIndex,
  }));

  if (days.every((day) => day.ml === 0)) {
    return (
      <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: T.textSecondary }}>
          {ka.hydration.noWeekData}
        </Text>
      </View>
    );
  }

  const top = Math.max(goalMl, ...days.map((day) => day.ml)) || 1;
  const barArea = PLOT_H - HEADROOM;
  const goalBottom = goalMl > 0 ? (goalMl / top) * barArea : null;

  return (
    <View>
      <View style={{ height: PLOT_H, flexDirection: 'row' }}>
        {goalBottom != null ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: goalBottom, height: 1, backgroundColor: T.borderStrong }} />
        ) : null}
        {days.map((day) => {
          const filled = !day.ahead && day.ml > 0;
          const met = goalMl > 0 && day.ml >= goalMl;
          return (
            <View
              key={day.label}
              accessible
              accessibilityLabel={day.ahead ? day.label : `${day.label}: ${formatLiters(day.ml)}`}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
            >
              {filled ? (
                <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 14, color: T.textSecondary }}>
                  {formatLiters(day.ml)}
                </Text>
              ) : null}
              <View
                style={{
                  width: '58%',
                  maxWidth: 28,
                  height: filled ? Math.max(6, (day.ml / top) * barArea) : 4,
                  borderRadius: 8,
                  backgroundColor: filled ? T.brand : T.border,
                  opacity: filled && !met ? 0.55 : 1,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {days.map((day) => (
          <Text
            key={day.label}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: day.today ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              lineHeight: 16,
              color: day.today ? T.textPrimary : T.textSecondary,
            }}
          >
            {day.label}
          </Text>
        ))}
      </View>
      {goalBottom != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <View style={{ width: 14, height: 1, backgroundColor: T.borderStrong }} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, color: T.textTertiary }}>
            {ka.hydration.target(formatLiters(goalMl))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
