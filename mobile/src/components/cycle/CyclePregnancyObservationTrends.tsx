import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import {
  CycleExposureComparisonDetail,
  exposureComparisonA11ySuffix,
} from '@/components/cycle/CycleExposureComparisonDetail';
import { CycleExposureRateDetail, exposureRateA11ySuffix } from '@/components/cycle/CycleExposureRateDetail';
import { CycleObservationExplainLinks } from '@/components/cycle/CycleObservationExplainLinks';
import { CycleObservationExplainSheet } from '@/components/cycle/CycleObservationExplainSheet';
import { ka } from '@/i18n/ka';
import type { CyclePregnancyObservationTrend, CyclePregnancyObservationTrendsPayload } from '@/lib/api';
import type { ObservationExplainTopic } from '@/lib/cycleObservationExplainabilityCopy';
import {
  formatPregnancyTrendSummary,
  pregnancyTrendA11y,
  pregnancyTrendFamilyLabel,
} from '@/lib/pregnancyObservationTrendCopy';
import { useCycleColors } from '@/theme/cycle';

const UI_LIMIT = 4;

export function CyclePregnancyObservationTrends({
  payload,
  pending,
  failed,
}: {
  payload?: CyclePregnancyObservationTrendsPayload | null;
  pending?: boolean;
  failed?: boolean;
}) {
  const c = useCycleColors();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [explain, setExplain] = useState<{ topic: ObservationExplainTopic; reason?: string | null } | null>(
    null,
  );

  if (failed) return null;
  if (pending && !payload) {
    return (
      <View style={{ marginTop: 14 }}>
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
          {ka.cycle.pregnancyTrendsTitle}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 6 }}>{ka.common.loading}</Text>
      </View>
    );
  }
  if (!payload) return null;

  const trends = payload.trends || [];
  const visible = showAll ? trends : trends.slice(0, UI_LIMIT);

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
        {ka.cycle.pregnancyTrendsTitle}
      </Text>
      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
        {ka.cycle.pregnancyTrendsWindow}
      </Text>
      {!trends.length ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          {ka.cycle.pregnancyTrendsEmpty}
        </Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          {visible.map((trend) => (
            <TrendRow
              key={trend.key}
              trend={trend}
              open={expandedKey === trend.key}
              onToggle={() => setExpandedKey((cur) => (cur === trend.key ? null : trend.key))}
              onExplain={(topic, reason) => setExplain({ topic, reason })}
            />
          ))}
          {trends.length > UI_LIMIT ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showAll ? ka.cycle.pregnancyTrendSeeLess : ka.cycle.pregnancyTrendSeeMore}
              onPress={() => setShowAll((v) => !v)}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
                {showAll ? ka.cycle.pregnancyTrendSeeLess : ka.cycle.pregnancyTrendSeeMore}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <CycleObservationExplainSheet
        visible={Boolean(explain)}
        topic={explain?.topic ?? null}
        reason={explain?.reason}
        onClose={() => setExplain(null)}
      />
    </View>
  );
}

function TrendRow({
  trend,
  open,
  onToggle,
  onExplain,
}: {
  trend: CyclePregnancyObservationTrend;
  open: boolean;
  onToggle: () => void;
  onExplain: (topic: ObservationExplainTopic, reason?: string | null) => void;
}) {
  const c = useCycleColors();
  const summary = formatPregnancyTrendSummary(trend);
  const severityBits = (['mild', 'moderate', 'severe'] as const).filter(
    (id) => trend.severityCounts?.[id],
  );

  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${pregnancyTrendA11y(trend, open)}${open ? `${exposureRateA11ySuffix(trend.exposure)}${exposureComparisonA11ySuffix(trend.comparison)}` : ''}`}
        onPress={onToggle}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'NotoSansGeorgian_500Medium' }}>
          {pregnancyTrendFamilyLabel(trend.family)}
        </Text>
        <Text style={{ color: c.ink, fontSize: 14, lineHeight: 21, marginTop: 2 }}>
          {summary}
        </Text>
        {trend.lastLoggedDate ? (
          <Text style={{ color: c.mutedSoft, fontSize: 12, marginTop: 4 }}>
            {ka.cycle.pregnancyTrendLast(formatCycleDateKa(trend.lastLoggedDate))}
          </Text>
        ) : null}
      </Pressable>
      {open ? (
        <View style={{ marginTop: 6, gap: 4 }}>
          <CycleExposureRateDetail exposure={trend.exposure} />
          <CycleExposureComparisonDetail comparison={trend.comparison} />
          <CycleObservationExplainLinks
            exposure={trend.exposure}
            comparison={trend.comparison}
            explainability={trend.explainability}
            onExplain={onExplain}
          />
          {severityBits.map((id) => (
            <Text key={id} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {ka.cycle.painSeverity[id]} — {trend.severityCounts?.[id]}
            </Text>
          ))}
          {(trend.recentDates || []).map((date) => (
            <Text key={date} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {formatCycleDateKa(date)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
