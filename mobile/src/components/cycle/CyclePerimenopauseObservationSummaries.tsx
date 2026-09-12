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
import type {
  CyclePerimenopauseObservationSummariesPayload,
  CyclePerimenopauseObservationSummary,
} from '@/lib/api';
import type { ObservationExplainTopic } from '@/lib/cycleObservationExplainabilityCopy';
import {
  formatPeriSummary,
  periSummaryA11y,
  periSummaryFamilyLabel,
} from '@/lib/periObservationSummaryCopy';
import { useCycleColors } from '@/theme/cycle';

const UI_LIMIT = 4;

export function CyclePerimenopauseObservationSummaries({
  payload,
}: {
  payload?: CyclePerimenopauseObservationSummariesPayload | null;
}) {
  const c = useCycleColors();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [explain, setExplain] = useState<{ topic: ObservationExplainTopic; reason?: string | null } | null>(
    null,
  );

  if (!payload) return null;

  const rows = payload.summaries || [];
  const visible = showAll ? rows : rows.slice(0, UI_LIMIT);

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: 16,
      }}
    >
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
        {ka.cycle.periTrendsTitle}
      </Text>
      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
        {ka.cycle.periTrendsWindow}
      </Text>
      {!rows.length ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          {ka.cycle.periTrendsEmpty}
        </Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          {visible.map((row) => (
            <SummaryRow
              key={row.key}
              row={row}
              open={expandedKey === row.key}
              onToggle={() => setExpandedKey((cur) => (cur === row.key ? null : row.key))}
              onExplain={(topic, reason) => setExplain({ topic, reason })}
            />
          ))}
          {rows.length > UI_LIMIT ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showAll ? ka.cycle.periTrendSeeLess : ka.cycle.periTrendSeeMore}
              onPress={() => setShowAll((v) => !v)}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
                {showAll ? ka.cycle.periTrendSeeLess : ka.cycle.periTrendSeeMore}
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

function SummaryRow({
  row,
  open,
  onToggle,
  onExplain,
}: {
  row: CyclePerimenopauseObservationSummary;
  open: boolean;
  onToggle: () => void;
  onExplain: (topic: ObservationExplainTopic, reason?: string | null) => void;
}) {
  const c = useCycleColors();
  const summary = formatPeriSummary(row);
  const severityBits = (['mild', 'moderate', 'severe'] as const).filter(
    (id) => row.severityCounts?.[id],
  );

  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${periSummaryA11y(row, open)}${open ? `${exposureRateA11ySuffix(row.exposure)}${exposureComparisonA11ySuffix(row.comparison)}` : ''}`}
        onPress={onToggle}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'NotoSansGeorgian_500Medium' }}>
          {periSummaryFamilyLabel(row.family)}
        </Text>
        <Text style={{ color: c.ink, fontSize: 14, lineHeight: 21, marginTop: 2 }}>{summary}</Text>
        {row.lastLoggedDate ? (
          <Text style={{ color: c.mutedSoft, fontSize: 12, marginTop: 4 }}>
            {ka.cycle.periTrendLast(formatCycleDateKa(row.lastLoggedDate))}
          </Text>
        ) : null}
      </Pressable>
      {open ? (
        <View style={{ marginTop: 6, gap: 4 }}>
          <CycleExposureRateDetail exposure={row.exposure} />
          <CycleExposureComparisonDetail comparison={row.comparison} />
          <CycleObservationExplainLinks
            exposure={row.exposure}
            comparison={row.comparison}
            explainability={row.explainability}
            onExplain={onExplain}
          />
          {severityBits.map((id) => (
            <Text key={id} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {ka.cycle.painSeverity[id]} — {row.severityCounts?.[id]}
            </Text>
          ))}
          {(row.recentDates || []).map((date) => (
            <Text key={date} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {formatCycleDateKa(date)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
