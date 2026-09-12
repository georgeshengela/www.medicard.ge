import React from 'react';
import { Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import type { CycleObservationExposure } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

export function formatExposureRate(exposure?: CycleObservationExposure | null): string | null {
  if (!exposure?.rateDisplayEligible) return null;
  if (exposure.presentDays < 2 || exposure.assessedDays < 1) return null;
  return ka.cycle.exposureRateDetail(exposure.presentDays, exposure.assessedDays, exposure.ratePercent);
}

export function exposureRateA11ySuffix(exposure?: CycleObservationExposure | null): string {
  const text = formatExposureRate(exposure);
  if (!text || !exposure) return '';
  return `, ${ka.cycle.exposureRateA11y(exposure.presentDays, exposure.assessedDays, exposure.ratePercent)}`;
}

export function CycleExposureRateDetail({
  exposure,
}: {
  exposure?: CycleObservationExposure | null;
}) {
  const c = useCycleColors();
  const text = formatExposureRate(exposure);
  if (!text) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text
        style={{
          color: c.ink,
          fontSize: 13,
          lineHeight: 19,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
        }}
        accessibilityLabel={ka.cycle.exposureRateA11y(
          exposure!.presentDays,
          exposure!.assessedDays,
          exposure!.ratePercent,
        )}
      >
        {text}
      </Text>
      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
        {ka.cycle.exposureRateHint}
      </Text>
    </View>
  );
}
