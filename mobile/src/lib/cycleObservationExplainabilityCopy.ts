import type {
  CycleObservationComparisonExplainability,
  CycleObservationExplainability,
  CycleObservationRateExplainability,
} from '@/lib/api';
import { ka } from '@/i18n/ka';

export type ObservationExplainTopic =
  | 'MEANING'
  | 'RATE_UNAVAILABLE'
  | 'COMPARISON_UNAVAILABLE'
  | 'DIRECTION_UNAVAILABLE'
  | 'HIGHER'
  | 'LOWER';

export function observationExplainCopy(
  topic: ObservationExplainTopic,
  reason?: string | null,
  extras?: { direction?: 'HIGHER' | 'LOWER' | null },
): { title: string; body: string } {
  if (topic === 'RATE_UNAVAILABLE') {
    return {
      title: ka.cycle.explainRateUnavailableTitle,
      body: `${ka.cycle.explainRateUnavailableBody}\n\n${ka.cycle.explainUnansweredDays}\n\n${ka.cycle.explainRecordedOnly}`,
    };
  }
  if (topic === 'COMPARISON_UNAVAILABLE') {
    return {
      title: ka.cycle.explainComparisonUnavailableTitle,
      body: `${ka.cycle.explainComparisonUnavailableBody}\n\n${ka.cycle.explainUnansweredDays}\n\n${ka.cycle.explainRecordedOnly}`,
    };
  }
  if (topic === 'DIRECTION_UNAVAILABLE') {
    const body =
      reason === 'COVERAGE_NOT_COMPARABLE'
        ? ka.cycle.explainDirectionCoverageBody
        : ka.cycle.explainDirectionUnavailableBody;
    return {
      title: ka.cycle.explainDirectionUnavailableTitle,
      body: `${body}\n\n${ka.cycle.explainRecordedOnly}`,
    };
  }
  if (topic === 'HIGHER') {
    return {
      title: ka.cycle.explainWhatItMeans,
      body: `${ka.cycle.explainHigherBody}\n\n${ka.cycle.explainMeaningBody}\n\n${ka.cycle.explainRateShownBody}\n\n${ka.cycle.explainRecordedOnly}`,
    };
  }
  if (topic === 'LOWER') {
    return {
      title: ka.cycle.explainWhatItMeans,
      body: `${ka.cycle.explainLowerBody}\n\n${ka.cycle.explainMeaningBody}\n\n${ka.cycle.explainRateShownBody}\n\n${ka.cycle.explainRecordedOnly}`,
    };
  }
  const parts = [
    ka.cycle.explainMeaningBody,
    ka.cycle.explainRateShownBody,
    ka.cycle.explainUnansweredDays,
    ka.cycle.explainPresentDay,
    ka.cycle.explainAbsentDay,
  ];
  if (extras?.direction === 'HIGHER') parts.push(ka.cycle.explainHigherBody);
  if (extras?.direction === 'LOWER') parts.push(ka.cycle.explainLowerBody);
  if (extras?.direction === null) parts.push(ka.cycle.explainDirectionUnavailableBody);
  parts.push(ka.cycle.explainRecordedOnly);
  return {
    title: ka.cycle.explainWhatItMeans,
    body: parts.join('\n\n'),
  };
}

export function meaningTopicFromState(explainability?: CycleObservationExplainability | null): ObservationExplainTopic {
  const comparison = explainability?.comparison;
  if (comparison?.directionAvailable) return 'MEANING';
  if (comparison?.numbersAvailable && !comparison.directionAvailable) return 'DIRECTION_UNAVAILABLE';
  return 'MEANING';
}

export function rateExplainability(explainability?: CycleObservationExplainability | null): CycleObservationRateExplainability | null {
  return explainability?.rate ?? null;
}

export function comparisonExplainability(
  explainability?: CycleObservationExplainability | null,
): CycleObservationComparisonExplainability | null {
  return explainability?.comparison ?? null;
}
