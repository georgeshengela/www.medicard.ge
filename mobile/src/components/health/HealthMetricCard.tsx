import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Activity,
  ChevronRight,
  Droplets,
  Heart,
  HeartPulse,
  Moon,
  Scale,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';
import { METRIC_COLORS, useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { ka } from '@/i18n/ka';
import { formatMetricValue } from '@/lib/healthMetrics.shared';
import { HealthMetricSparkline, metricChartKind } from '@/components/health/HealthMetricSparkline';
import type { HealthMetricSnapshot } from '@/types/healthMetrics';

const ICONS = {
  weight: Scale,
  bloodPressure: Activity,
  heartRate: HeartPulse,
  sleep: Moon,
  nutrition: Utensils,
  hydration: Droplets,
} as const;

type Props = {
  metric: HealthMetricSnapshot;
  compact?: boolean;
  mini?: boolean;
  onPress?: () => void;
};

export type NightingaleMetricCardProps = {
  Icon: LucideIcon;
  color: string;
  title: string;
  updatedLabel: string;
  valueText: string;
  unit?: string | null;
  status: string;
  weekValues: (number | null)[];
  kind?: 'line' | 'bar' | 'step' | 'dots';
  compact?: boolean;
  onPress?: () => void;
};

/** Nightingale Health Metric Card — Figma 8848:112910 */
export function NightingaleMetricCard({
  Icon,
  color,
  title,
  updatedLabel,
  valueText,
  unit,
  status,
  weekValues,
  kind = 'line',
  compact = false,
  onPress,
}: NightingaleMetricCardProps) {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = compact ? 36 : 56;

  const body = (
    <View
      style={{
        backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
        borderRadius: FIGMA_HEALTH_METRICS.cardRadius,
        borderWidth: 1,
        borderColor: FIGMA_HEALTH_METRICS.border,
        padding: compact ? 10 : 16,
        gap: compact ? 8 : 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon size={20} color={color} strokeWidth={2.2} />
          <Text
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              lineHeight: 20,
              color: FIGMA_HEALTH_METRICS.textPrimary,
            }}
          >
            {title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              color: FIGMA_HEALTH_METRICS.textSecondary,
            }}
          >
            {updatedLabel}
          </Text>
          {onPress ? <ChevronRight size={20} color={FIGMA_HEALTH_METRICS.textSecondary} strokeWidth={2} /> : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: compact ? 18 : 24,
                lineHeight: compact ? 22 : 32,
                color: FIGMA_HEALTH_METRICS.textPrimary,
                letterSpacing: -0.25,
              }}
            >
              {valueText}
            </Text>
            {unit ? (
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_500Medium',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA_HEALTH_METRICS.textPrimary,
                  paddingBottom: 2,
                }}
              >
                {unit}
              </Text>
            ) : null}
          </View>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              lineHeight: 16,
              color: FIGMA_HEALTH_METRICS.textSecondary,
            }}
          >
            {status}
          </Text>
        </View>
        <View
          pointerEvents="none"
          style={{ flex: 1, height: chartHeight, minWidth: 72, alignSelf: 'stretch' }}
          onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
        >
          {chartWidth > 0 ? (
            <HealthMetricSparkline
              values={weekValues}
              color={color}
              kind={kind}
              width={chartWidth}
              height={chartHeight}
            />
          ) : null}
        </View>
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}

export function HealthMetricCard({ metric, compact = false, mini = false, onPress }: Props) {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  const Icon = ICONS[metric.key];
  const color = METRIC_COLORS[metric.key];
  const title = ka.healthMetrics.metrics[metric.key];

  if (mini) {
    const body = (
      <View
        style={{
          minWidth: 96,
          backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: FIGMA_HEALTH_METRICS.border,
          paddingHorizontal: 10,
          paddingVertical: 8,
          gap: 4,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon size={13} color={color} strokeWidth={2.2} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 10,
              color: FIGMA_HEALTH_METRICS.textSecondary,
            }}
          >
            {title}
          </Text>
        </View>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: FIGMA_HEALTH_METRICS.textPrimary }}>
          {formatMetricValue(metric)}
          {metric.value != null ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10 }}> {metric.unit}</Text>
          ) : null}
        </Text>
      </View>
    );
    if (!onPress) return body;
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        {body}
      </Pressable>
    );
  }

  return (
    <NightingaleMetricCard
      Icon={Icon}
      color={color}
      title={title}
      updatedLabel={metric.updatedLabel}
      valueText={formatMetricValue(metric)}
      unit={metric.value != null ? metric.unit : null}
      status={metric.statusKa}
      weekValues={metric.weekValues}
      kind={metricChartKind(metric.key)}
      compact={compact}
      onPress={onPress}
    />
  );
}

/** Teal insights banner — Figma 8848:112661 */
export function HealthMetricsInsightsBanner({ onPress }: { onPress?: () => void }) {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: FIGMA_HEALTH_METRICS.brandQuaternary,
        borderRadius: FIGMA_HEALTH_METRICS.cardRadius,
        borderWidth: 1,
        borderColor: FIGMA_HEALTH_METRICS.brand,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
      }}
    >
      <View style={{ flex: 1, gap: 8 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 16,
            lineHeight: 22,
            color: FIGMA_HEALTH_METRICS.textPrimary,
          }}
        >
          {ka.healthMetrics.insightsTitle}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              color: FIGMA_HEALTH_METRICS.brand,
            }}
          >
            {ka.healthMetrics.learnMore}
          </Text>
          <ChevronRight size={18} color={FIGMA_HEALTH_METRICS.brand} strokeWidth={2.2} />
        </View>
      </View>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: FIGMA_HEALTH_METRICS.brand,
        }}
      >
        <Heart size={32} color={FIGMA_HEALTH_METRICS.brand} fill={`${FIGMA_HEALTH_METRICS.brand}22`} strokeWidth={2} />
      </View>
    </Pressable>
  );
}
