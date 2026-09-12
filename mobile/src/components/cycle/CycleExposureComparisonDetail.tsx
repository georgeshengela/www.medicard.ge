import React from 'react';
import { Text, View } from 'react-native';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleObservationExposureComparison } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

function directionCopy(direction: CycleObservationExposureComparison['direction']) {
  if (direction === 'HIGHER') return ka.cycle.exposureComparisonHigher;
  if (direction === 'LOWER') return ka.cycle.exposureComparisonLower;
  return null;
}

export function exposureComparisonA11ySuffix(comparison?: CycleObservationExposureComparison | null): string {
  if (!comparison) return '';
  const earlier = ka.cycle.exposureComparisonA11yWindow(
    ka.cycle.exposureComparisonEarlier,
    comparison.earlier.presentDays,
    comparison.earlier.assessedDays,
    comparison.earlier.ratePercent ?? 0,
  );
  const recent = ka.cycle.exposureComparisonA11yWindow(
    ka.cycle.exposureComparisonRecent,
    comparison.recent.presentDays,
    comparison.recent.assessedDays,
    comparison.recent.ratePercent ?? 0,
  );
  const direction = directionCopy(comparison.direction);
  return direction ? `, ${earlier}, ${recent}, ${direction}` : `, ${earlier}, ${recent}`;
}

function WindowRow({
  label,
  presentDays,
  assessedDays,
  ratePercent,
  from,
  to,
}: {
  label: string;
  presentDays: number;
  assessedDays: number;
  ratePercent: number | null;
  from: string | null;
  to: string | null;
}) {
  const c = useCycleColors();
  const range =
    from && to ? ka.cycle.exposureComparisonRange(formatCycleDateKa(from), formatCycleDateKa(to)) : null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'NotoSansGeorgian_500Medium' }}>{label}</Text>
      <Text style={{ color: c.ink, fontSize: 13, lineHeight: 19 }}>
        {ka.cycle.exposureComparisonWindow(presentDays, assessedDays, ratePercent ?? 0)}
      </Text>
      {range ? (
        <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17 }}>{range}</Text>
      ) : null}
    </View>
  );
}

export function CycleExposureComparisonDetail({
  comparison,
}: {
  comparison?: CycleObservationExposureComparison | null;
}) {
  const c = useCycleColors();
  if (!comparison) return null;
  const direction = directionCopy(comparison.direction);
  return (
    <View style={{ marginBottom: 4, gap: 8 }}>
      <WindowRow
        label={ka.cycle.exposureComparisonEarlier}
        presentDays={comparison.earlier.presentDays}
        assessedDays={comparison.earlier.assessedDays}
        ratePercent={comparison.earlier.ratePercent}
        from={comparison.earlier.from}
        to={comparison.earlier.to}
      />
      <WindowRow
        label={ka.cycle.exposureComparisonRecent}
        presentDays={comparison.recent.presentDays}
        assessedDays={comparison.recent.assessedDays}
        ratePercent={comparison.recent.ratePercent}
        from={comparison.recent.from}
        to={comparison.recent.to}
      />
      {direction ? (
        <Text
          style={{
            color: c.ink,
            fontSize: 13,
            lineHeight: 19,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
          }}
        >
          {direction}
        </Text>
      ) : null}
      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 18 }}>
        {ka.cycle.exposureComparisonHint}
      </Text>
    </View>
  );
}
