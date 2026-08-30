import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { HydrationDayCheck, HydrationDayEmpty, HydrationDayMiss } from '@/components/hydration/HydrationIcons';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { ka } from '@/i18n/ka';
import { dayTotalMl } from '@/lib/hydration';
import type { HydrationLog } from '@/types/hydration';

type Cell = { ymd: string; inMonth: boolean };

function weekRows(cells: Cell[]): Cell[][] {
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Figma 8851:187189 — date + 32px check / miss / empty. */
export function HydrationMonthCalendar({
  cells,
  today,
  logs,
  goalMl,
}: {
  cells: Cell[];
  today: string;
  logs: HydrationLog[];
  goalMl: number;
}) {
  const T = useFigmaHydration();
  const rows = useMemo(() => weekRows(cells), [cells]);

  return (
    <View style={{ paddingHorizontal: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row' }}>
        {ka.hydration.weekdaySun.map((d) => (
          <Text
            key={d}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              lineHeight: 20,
              color: T.textPrimary,
              paddingBottom: 2,
            }}
          >
            {d}
          </Text>
        ))}
      </View>
      <View style={{ gap: 12 }}>
        {rows.map((week) => (
          <View key={week[0]?.ymd} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {week.map((cell) => {
              const total = dayTotalMl(logs, cell.ymd);
              const met = cell.inMonth && total >= goalMl && goalMl > 0;
              const missed = cell.inMonth && cell.ymd < today && !met;
              const isToday = cell.ymd === today;
              const day = Number(cell.ymd.slice(8));
              const dateColor = isToday ? T.brand : cell.inMonth ? T.textPrimary : T.borderStrong;
              return (
                <View
                  key={cell.ymd}
                  style={{
                    minWidth: 44,
                    flex: 1,
                    alignItems: 'center',
                    padding: 8,
                    gap: 4,
                    borderRadius: 8,
                    backgroundColor: isToday ? T.brandQuaternary : 'transparent',
                    borderWidth: isToday ? 1 : 0,
                    borderColor: T.brand,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_500Medium',
                      fontSize: 14,
                      lineHeight: 20,
                      color: dateColor,
                      textAlign: 'center',
                    }}
                  >
                    {day}
                  </Text>
                  {met ? (
                    <HydrationDayCheck />
                  ) : missed ? (
                    <HydrationDayMiss />
                  ) : (
                    <HydrationDayEmpty color={cell.inMonth ? T.textSecondary : T.borderStrong} />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
