import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CycleCard } from '@/components/cycle/CycleUI';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, type CycleObservationTrend, type CycleObservationTrendsPayload } from '@/lib/api';
import {
  formatObservationTrendSummary,
  observationTrendA11y,
  observationTrendGroupLabel,
} from '@/lib/cycleObservationTrendCopy';
import { useCycleColors } from '@/theme/cycle';

const UI_LIMIT = 5;

export function CycleObservationTrends({
  refreshKey,
  showEmpty,
  excludePeriodAssociation,
}: {
  refreshKey: string;
  showEmpty?: boolean;
  excludePeriodAssociation?: boolean;
}) {
  const c = useCycleColors();
  const [payload, setPayload] = useState<CycleObservationTrendsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setFailed(false);
    api.cycle
      .observationTrends()
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setPayload(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load, refreshKey]);

  if (failed) return null;
  if (!payload) return null;

  const trends = (payload.trends || []).filter((trend) =>
    excludePeriodAssociation ? trend.summaryType !== 'PERIOD_EPISODE_RECURRENCE' : true,
  );
  if (!trends.length) {
    if (!showEmpty) return null;
    return (
      <CycleCard>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
          {ka.cycle.observationTrendsEmpty}
        </Text>
      </CycleCard>
    );
  }

  const visible = showAll ? trends : trends.slice(0, UI_LIMIT);

  return (
    <View style={{ gap: 10, marginBottom: 8 }}>
      {visible.map((trend) => (
        <TrendRow
          key={trend.key}
          trend={trend}
          open={expandedKey === trend.key}
          onToggle={() => setExpandedKey((cur) => (cur === trend.key ? null : trend.key))}
        />
      ))}
      {trends.length > UI_LIMIT ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showAll ? ka.cycle.observationTrendsSeeLess : ka.cycle.observationTrendsSeeMore}
          onPress={() => setShowAll((v) => !v)}
          style={{ paddingVertical: 10, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
            {showAll ? ka.cycle.observationTrendsSeeLess : ka.cycle.observationTrendsSeeMore}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TrendRow({
  trend,
  open,
  onToggle,
}: {
  trend: CycleObservationTrend;
  open: boolean;
  onToggle: () => void;
}) {
  const c = useCycleColors();
  const summary = formatObservationTrendSummary(trend);
  const group = observationTrendGroupLabel(trend.trendGroup);

  return (
    <CycleCard>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={observationTrendA11y(trend)}
        onPress={onToggle}
        style={{ minHeight: 44 }}
      >
        <Text
          style={{
            color: c.muted,
            fontSize: 11,
            fontFamily: 'NotoSansGeorgian_500Medium',
            marginBottom: 4,
          }}
        >
          {group}
        </Text>
        <Text style={{ color: c.ink, fontSize: 14, lineHeight: 21, fontFamily: 'NotoSansGeorgian_500Medium' }}>
          {summary}
        </Text>
        {trend.lastLoggedDate ? (
          <Text style={{ color: c.mutedSoft, fontSize: 12, marginTop: 6 }}>
            {ka.cycle.trendLastLogged(formatCycleDateKa(trend.lastLoggedDate))}
          </Text>
        ) : null}
      </Pressable>
      {open && trend.recentDates?.length ? (
        <View style={{ marginTop: 10, gap: 4 }}>
          {trend.recentDates.map((date) => (
            <Text key={date} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {formatCycleDateKa(date)}
            </Text>
          ))}
        </View>
      ) : null}
    </CycleCard>
  );
}
