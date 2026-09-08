import React from 'react';
import { Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { useCycleColors } from '@/theme/cycle';

/**
 * PredictionBadge — the only way predicted dates render (§11).
 * Always carries the "სავარაუდო" estimate wording in the same visual unit.
 */
export function PredictionBadge({ date }: { date: string }) {
  const c = useCycleColors();
  return (
    <View
      accessible
      accessibilityLabel={`${ka.cycle.estimatedSection}, ${formatCycleDateKa(date)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.border,
        borderStyle: 'dashed',
        backgroundColor: c.cardSoft,
        paddingHorizontal: 12,
        paddingVertical: 7,
        gap: 6,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: c.period,
          backgroundColor: 'transparent',
        }}
      />
      <Text
        numberOfLines={1}
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          lineHeight: 16,
        }}
      >
        {ka.cycle.estimatedSection} · {formatCycleDateKa(date)}
      </Text>
    </View>
  );
}

/**
 * ConfidenceHint — quiet neutral pill (§12). Server confidence only,
 * never a warning color, never a danger icon.
 */
export function ConfidenceHint({ label }: { label: string }) {
  const c = useCycleColors();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        borderRadius: 999,
        backgroundColor: c.cardSoft,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: 12,
        paddingVertical: 7,
        maxWidth: '100%',
      }}
    >
      <Text
        style={{
          color: c.muted,
          fontFamily: 'NotoSansGeorgian_500Medium',
          fontSize: 12,
          lineHeight: 16,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
