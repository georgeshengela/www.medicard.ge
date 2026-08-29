import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { UnitSegment, type UnitOption } from '@/components/assessment/UnitSegment';
import { useAssessment } from '@/constants/assessmentLayout';

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  labelForValue?: (value: number) => string;
  hint?: string;
};

/** Figma 9217:164657 — 128pt value, 30pt label, 1–5 tab. */
export function SegmentScale({
  value,
  min = 1,
  max = 5,
  onChange,
  labelForValue,
  hint,
}: Props) {
  const ASSESSMENT = useAssessment();
  const options = useMemo<UnitOption[]>(
    () => Array.from({ length: max - min + 1 }, (_, i) => {
      const n = String(min + i);
      return { value: n, label: n };
    }),
    [min, max],
  );

  return (
    <View style={{ width: '100%', alignItems: 'center', paddingVertical: 24, gap: 32 }}>
      <View style={{ width: '100%', alignItems: 'center', gap: 12 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 128,
            lineHeight: 136,
            letterSpacing: -4,
            color: ASSESSMENT.textPrimary,
            textAlign: 'center',
          }}
        >
          {value}
        </Text>
        {labelForValue ? (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 30,
              lineHeight: 38,
              letterSpacing: -0.25,
              color: ASSESSMENT.textSecondary,
              textAlign: 'center',
            }}
          >
            {labelForValue(value)}
          </Text>
        ) : null}
      </View>

      <View style={{ width: '100%', alignItems: 'center', gap: 24 }}>
        <UnitSegment
          value={String(value)}
          options={options}
          onChange={(next) => {
            const parsed = Number(next);
            if (parsed === value) return;
            pickerSelectionTick();
            onChange(parsed);
          }}
        />
        {hint ? (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 22,
              color: ASSESSMENT.textSecondary,
              textAlign: 'center',
            }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
