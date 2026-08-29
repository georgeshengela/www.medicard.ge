import React from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { FIGMA_HEALTH_METRICS, useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { useIsDark } from '@/theme/colors';

type Props = {
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  value: boolean;
  disabled?: boolean;
  loading?: boolean;
  isLast?: boolean;
  onValueChange: (next: boolean) => void;
};

export function PermissionToggleRow({
  icon: Icon,
  iconColor = FIGMA_HEALTH_METRICS.brand,
  label,
  value,
  disabled,
  loading,
  isLast,
  onValueChange,
}: Props) {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  const dark = useIsDark();
  const trackOff = dark ? '#374151' : '#E5E7EB';
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          paddingLeft: 14,
          paddingRight: 10,
          paddingVertical: 8,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: `${iconColor}14`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={iconColor} strokeWidth={2.1} />
        </View>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginLeft: 12,
            marginRight: 8,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 15,
            color: disabled ? FIGMA_HEALTH_METRICS.textSecondary : FIGMA_HEALTH_METRICS.textPrimary,
          }}
        >
          {label}
        </Text>

        {loading ? (
          <View style={{ width: 51, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={FIGMA_HEALTH_METRICS.brand} />
          </View>
        ) : (
          <Switch
            value={value}
            disabled={disabled}
            onValueChange={onValueChange}
            trackColor={{
              false: trackOff,
              true: `${FIGMA_HEALTH_METRICS.brand}99`,
            }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={trackOff}
          />
        )}
      </View>
      {!isLast ? <View style={{ height: 1, backgroundColor: FIGMA_HEALTH_METRICS.border, marginLeft: 60 }} /> : null}
    </>
  );
}

export function PermissionGroup({ children }: { children: React.ReactNode }) {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  return (
    <View
      style={{
        backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: FIGMA_HEALTH_METRICS.border,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

export function PermissionSectionLabel({ title }: { title: string }) {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  return (
    <Text
      style={{
        fontFamily: 'NotoSansGeorgian_600SemiBold',
        fontSize: 12,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: FIGMA_HEALTH_METRICS.textSecondary,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {title}
    </Text>
  );
}
