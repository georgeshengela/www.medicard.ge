import React from 'react';
import { Text, View } from 'react-native';
import { CycleOvulationSparkle } from '@/components/cycle/CycleOvulationSparkle';
import { ka } from '@/i18n/ka';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/**
 * Compact calendar legend (§5) — the glyphs are the *same* shapes the day
 * cells use, so nothing has to be memorized: fill = logged, dash = estimate.
 */
export function CycleCalendarLegend({
  showFertility = true,
  showPredicted = true,
}: {
  showFertility?: boolean;
  showPredicted?: boolean;
}) {
  const c = useCycleColors();

  const items: { key: string; glyph: React.ReactNode; label: string }[] = [
    {
      key: 'logged',
      glyph: (
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.period }} />
      ),
      label: ka.cycle.legendPeriod,
    },
  ];

  if (showPredicted) {
    items.push({
      key: 'predicted',
      glyph: (
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: c.period,
            backgroundColor: cycleHexAlpha(c.period, 0.08),
          }}
        />
      ),
      label: ka.cycle.legendPeriodPredicted,
    });
  }

  if (showPredicted && showFertility) {
    items.push(
      {
        key: 'fertile',
        glyph: (
          <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.fertile }}
              />
            ))}
          </View>
        ),
        label: ka.cycle.legendFertile,
      },
      {
        key: 'ovulation',
        glyph: <CycleOvulationSparkle color={c.ovulation} size={10} />,
        label: ka.cycle.legendOvulation,
      },
    );
  }

  items.push({
    key: 'symptoms',
    glyph: <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.mutedSoft }} />,
    label: ka.cycle.legendLogged,
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 8,
        columnGap: 14,
        paddingHorizontal: 4,
      }}
    >
      {items.map((item) => (
        <View
          key={item.key}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 }}
        >
          <View style={{ width: 16, alignItems: 'center' }}>{item.glyph}</View>
          <Text
            style={{
              color: c.muted,
              fontSize: 11,
              lineHeight: 15,
              fontFamily: 'NotoSansGeorgian_500Medium',
            }}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
