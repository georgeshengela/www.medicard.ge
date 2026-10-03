import React from 'react';
import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { CyclePressable } from './CyclePressable';
import type { CycleBundle } from '@/lib/api';
import { ka } from '@/i18n/ka';
import { cycleVerdictsReady, FERTILITY_MIN_CYCLES } from '@/lib/cycleForecastEligibility';
import { CycleLearningBadge } from './CycleLearningBadge';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/** Typical adult ranges shown as reference, never as a diagnosis (ACOG: cycle 21–35, bleeding 2–7). */
const TYPICAL = { cycle: [21, 35], period: [2, 7], variation: 7 } as const;

type Tone = 'typical' | 'longer' | 'shorter' | 'variable' | 'unknown' | 'learning';

/** Flo's "My cycles": the three numbers people check, right under the ring, with their typical range. */
export function CycleStatsCard({ bundle, onOpen }: { bundle: CycleBundle; onOpen: () => void }) {
  const c = useCycleColors();
  const avg = bundle.averages;
  const cycle = avg?.usedCycleLength ?? null;
  const period = avg?.usedPeriodLength ?? null;
  const lengths = (bundle.trends?.cycleLengths ?? []).map((x) => x.length).filter((n) => Number.isFinite(n)).slice(-6);
  const variation = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;
  const inferred = avg?.source === 'inferred' && (avg?.cycleCount ?? 0) >= 2;
  // Verdicts („✓ ტიპური“ …) only from 3 completed cycles; before that the numbers + „ვსწავლობთ · N/3“.
  const done = avg?.cycleCount ?? 0;
  const verdicts = cycleVerdictsReady(done);

  const rangeTone = (v: number | null, [lo, hi]: readonly [number, number]): Tone =>
    v == null ? 'unknown' : !verdicts ? 'learning' : v < lo ? 'shorter' : v > hi ? 'longer' : 'typical';

  const tiles: { label: string; value: string; tone: Tone; hint: string }[] = [
    { label: ka.cycle.statsCycle, value: cycle != null ? String(cycle) : '—', tone: rangeTone(cycle, TYPICAL.cycle), hint: ka.cycle.statsTypicalRange(21, 35) },
    { label: ka.cycle.statsPeriod, value: period != null ? String(period) : '—', tone: rangeTone(period, TYPICAL.period), hint: ka.cycle.statsTypicalRange(2, 7) },
    {
      label: ka.cycle.statsVariation,
      value: variation != null ? String(variation) : '—',
      tone: variation == null ? 'unknown' : !verdicts ? 'learning' : variation <= TYPICAL.variation ? 'typical' : 'variable',
      hint: ka.cycle.statsVariationHint,
    },
  ];

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
      <HomeSectionTitle title={ka.cycle.statsTitle} />
      <CyclePressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${ka.cycle.statsTitle}. ${tiles.map((t) => `${t.label} ${t.value} ${ka.cycle.statsDayUnit}`).join(', ')}`}
        style={{ backgroundColor: c.card, borderRadius: 22, padding: 16, marginTop: 12 }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {tiles.map((t) => (
            <View key={t.label} style={{ flex: 1, minWidth: 0, backgroundColor: c.cardSoft, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: c.muted, fontSize: 11, lineHeight: 15, fontFamily: 'NotoSansGeorgian_500Medium' }}>{t.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
                <Text style={{ color: c.ink, fontSize: 24, lineHeight: 30, fontFamily: 'NotoSansGeorgian_700Bold', fontVariant: ['tabular-nums'] }}>{t.value}</Text>
                {t.value !== '—' ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, fontFamily: 'NotoSansGeorgian_500Medium' }}>{ka.cycle.statsDayUnit}</Text> : null}
              </View>
              <ToneChip tone={t.tone} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 }}>
          {verdicts ? (
            <Text style={{ flex: 1, color: c.mutedSoft, fontSize: 12, lineHeight: 17 }}>
              {inferred ? ka.cycle.statsBasedOn(avg?.cycleCount ?? 0) : ka.cycle.statsFromSettings}
            </Text>
          ) : (
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <CycleLearningBadge done={done} required={FERTILITY_MIN_CYCLES} align="flex-start" compact />
            </View>
          )}
          <ChevronRight size={16} color={c.mutedSoft} />
        </View>
      </CyclePressable>
    </View>
  );
}

function ToneChip({ tone }: { tone: Tone }) {
  const c = useCycleColors();
  if (tone === 'unknown') {
    return <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 15, marginTop: 6 }}>{ka.cycle.statsNeedMore}</Text>;
  }
  // Before 3 completed cycles: the number without a verdict; the badge under the tiles says why.
  if (tone === 'learning') return null;
  const typical = tone === 'typical';
  const color = typical ? c.success : c.luteal;
  const label =
    tone === 'typical' ? ka.cycle.statsTypical : tone === 'longer' ? ka.cycle.statsLonger : tone === 'shorter' ? ka.cycle.statsShorter : ka.cycle.statsVariable;
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: cycleHexAlpha(color, 0.12) }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
      <Text numberOfLines={1} style={{ color, fontSize: 10, lineHeight: 14, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
    </View>
  );
}
