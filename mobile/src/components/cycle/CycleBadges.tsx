import React from 'react';
import { Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { useCycleColors } from '@/theme/cycle';

/**
 * PredictionBadge — the only way predicted dates render (§11).
 * Always carries the "სავარაუდო" estimate wording in the same visual unit.
 * `until` turns it into a date range („სავარაუდო · 6 – 10 ოქტომბერი“) for variable cycles, which never get one date.
 */
export function PredictionBadge({ date, until }: { date: string; until?: string | null }) {
  const c = useCycleColors();
  const text = until && until !== date ? rangeDates(date, until) : formatCycleDateKa(date);
  return (
    <View
      accessible
      accessibilityLabel={`${ka.cycle.estimatedSection}, ${text}`}
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
        maxWidth: '100%',
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
        style={{
          flexShrink: 1,
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          lineHeight: 16,
        }}
      >
        {ka.cycle.estimatedSection} · {text}
      </Text>
    </View>
  );
}

/** „6 – 10 ოქტომბერი 2026“ when both dates share a month, else both in full. */
function rangeDates(from: string, to: string): string {
  const a = formatCycleDateKa(from);
  const b = formatCycleDateKa(to);
  const [dayA, ...restA] = a.split(' ');
  const [, ...restB] = b.split(' ');
  return restA.join(' ') === restB.join(' ') ? `${dayA} – ${b}` : `${a} – ${b}`;
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
        borderRadius: 12,
        backgroundColor: 'transparent',
        paddingHorizontal: 12,
        paddingVertical: 4,
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
