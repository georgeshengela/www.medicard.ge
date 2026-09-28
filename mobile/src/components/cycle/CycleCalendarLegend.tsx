import React from 'react';
import { Text, View } from 'react-native';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

/**
 * Compact calendar legend (§5) — the glyphs are the *same* shapes the day
 * cells use (tiny days with a number), so nothing has to be memorized: fill = logged,
 * dashed = estimated period, soft blue = estimated fertile, blue ring = estimated ovulation.
 */
export function CycleCalendarLegend({
  showFertility = true,
  showPredicted = true,
  loggedBleedLabel,
  showOwnerClassified = false,
}: {
  showFertility?: boolean;
  showPredicted?: boolean;
  loggedBleedLabel?: string;
  showOwnerClassified?: boolean;
}) {
  const c = useCycleColors();

  const mini = (opts: { fill?: string; ink: string; border?: string; dashed?: boolean }) => (
    <MiniDay {...opts} />
  );
  const items: { key: string; glyph: React.ReactNode; label: string }[] = [
    { key: 'logged', glyph: mini({ fill: c.period, ink: c.onPeriod }), label: loggedBleedLabel || ka.cycle.legendPeriod },
  ];
  if (showOwnerClassified) {
    items.push({ key: 'classified', glyph: mini({ fill: c.period, ink: c.onPeriod, border: c.white }), label: ka.cycle.postpartumLegendClassified });
  }
  if (showPredicted) {
    items.push({ key: 'predicted', glyph: mini({ ink: c.period, border: c.period, dashed: true }), label: ka.cycle.legendPeriodPredicted });
  }
  if (showPredicted && showFertility) {
    items.push(
      { key: 'fertile', glyph: mini({ fill: c.fertilitySoft, ink: c.fertile }), label: ka.cycle.legendFertile },
      { key: 'ovulation', glyph: mini({ fill: c.fertilitySoft, ink: c.fertile, border: c.fertile }), label: ka.cycle.legendOvulation },
    );
  }
  items.push({
    key: 'symptoms',
    glyph: (
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: c.ink, fontSize: 10, lineHeight: 12, fontFamily: 'NotoSansGeorgian_700Bold' }}>7</Text>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.mutedSoft, marginTop: 1 }} />
      </View>
    ),
    label: ka.cycle.legendLogged,
  });

  return (
    <View style={{ gap: 6 }}>
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 12,
        backgroundColor: c.card,
        borderRadius: 22,
        paddingVertical: 14,
        paddingHorizontal: 14,
      }}
    >
      {items.map((item) => (
        <View
          key={item.key}
          style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24, paddingRight: 6 }}
        >
          <View style={{ width: 24, alignItems: 'center' }}>{item.glyph}</View>
          <Text
            style={{
              color: c.muted,
              fontSize: 12,
              lineHeight: 16,
              flexShrink: 1,
              fontFamily: 'NotoSansGeorgian_500Medium',
            }}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
      {showPredicted || showFertility ? <MedicalSourcesLink sourceIds={['menstrualCycle']} /> : null}
    </View>
  );
}

/** A tiny calendar day — the legend shows exactly what the cells look like. */
function MiniDay({ fill, ink, border, dashed }: { fill?: string; ink: string; border?: string; dashed?: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fill ?? 'transparent',
        borderWidth: border ? 1.5 : 0,
        borderColor: border ?? 'transparent',
        borderStyle: dashed ? 'dashed' : 'solid',
      }}
    >
      <Text style={{ color: ink, fontSize: 10, lineHeight: 12, fontFamily: 'NotoSansGeorgian_700Bold' }}>7</Text>
    </View>
  );
}
