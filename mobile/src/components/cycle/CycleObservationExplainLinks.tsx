import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import type { CycleObservationExplainability, CycleObservationExposure, CycleObservationExposureComparison } from '@/lib/api';
import type { ObservationExplainTopic } from '@/lib/cycleObservationExplainabilityCopy';
import { useCycleColors } from '@/theme/cycle';

function Link({
  label,
  a11y,
  onPress,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  const c = useCycleColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ color: c.brand, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
    </Pressable>
  );
}

export function CycleObservationExplainLinks({
  exposure,
  comparison,
  explainability,
  onExplain,
}: {
  exposure?: CycleObservationExposure | null;
  comparison?: CycleObservationExposureComparison | null;
  explainability?: CycleObservationExplainability | null;
  onExplain: (topic: ObservationExplainTopic, reason?: string | null) => void;
}) {
  const hasRate = Boolean(exposure?.rateDisplayEligible);
  const hasComparison = Boolean(comparison);
  const rateUnavailable = Boolean(explainability?.rate && !explainability.rate.available);
  const comparisonUnavailable = Boolean(
    explainability?.comparison && !explainability.comparison.numbersAvailable,
  );
  const numbersNoDirection = Boolean(hasComparison && !comparison?.direction);
  const direction = comparison?.direction;

  if (!hasRate && !hasComparison && !rateUnavailable && !comparisonUnavailable) return null;

  return (
    <View style={{ marginTop: 2, marginBottom: 4, gap: 0 }}>
      {hasRate || hasComparison || numbersNoDirection ? (
        <Link
          label={ka.cycle.explainWhatItMeans}
          a11y={ka.cycle.explainA11y}
          onPress={() => {
            if (direction === 'HIGHER') onExplain('HIGHER');
            else if (direction === 'LOWER') onExplain('LOWER');
            else if (numbersNoDirection) {
              onExplain('DIRECTION_UNAVAILABLE', explainability?.comparison?.directionReason);
            } else {
              onExplain('MEANING');
            }
          }}
        />
      ) : (
        <Link
          label={ka.cycle.explainWhatItMeans}
          a11y={ka.cycle.explainA11y}
          onPress={() => onExplain('MEANING')}
        />
      )}
      {rateUnavailable ? (
        <Link
          label={ka.cycle.explainWhyNoRate}
          a11y={ka.cycle.explainWhyNoRateA11y}
          onPress={() => onExplain('RATE_UNAVAILABLE', explainability?.rate?.reason)}
        />
      ) : null}
      {comparisonUnavailable ? (
        <Link
          label={ka.cycle.explainWhyNoComparison}
          a11y={ka.cycle.explainWhyNoComparisonA11y}
          onPress={() => onExplain('COMPARISON_UNAVAILABLE', explainability?.comparison?.numbersReason)}
        />
      ) : null}
    </View>
  );
}
