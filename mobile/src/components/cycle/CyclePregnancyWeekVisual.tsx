import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { pregnancySizeAsset } from '@/lib/pregnancySizeAssets';
import { formatLengthCm, formatWeightGrams } from '@/lib/pregnancyWeekData.js';
import {
  pregnancyComparisonLine,
  pregnancyComparisonName,
} from '@/lib/pregnancyWeekCopy.js';
import { useCycleColors } from '@/theme/cycle';

export type WeekDevelopmentView = {
  week: number;
  kind?: string;
  comparisonKey?: string | null;
  lengthCm?: number | null;
  weightGrams?: number | null;
  measurementType?: 'CRL' | 'CHL' | null;
  illustrationKey?: string | null;
  beyondCatalog?: boolean;
} | null;

export function pregnancyLengthLabel(measurementType?: string | null) {
  if (measurementType === 'CRL') return ka.cycle.pregnancyLengthCrl;
  if (measurementType === 'CHL') return ka.cycle.pregnancyLengthChl;
  return ka.cycle.pregnancyLength;
}

export function pregnancyWeightText(grams?: number | null) {
  const formatted = formatWeightGrams(grams);
  if (!formatted) return null;
  if (formatted.unit === 'kg') return `${ka.cycle.pregnancyApprox} ${formatted.value} ${ka.cycle.pregnancyKg}`;
  return `${ka.cycle.pregnancyApprox} ${formatted.value} ${ka.cycle.pregnancyG}`;
}

export function pregnancyLengthText(cm?: number | null) {
  const value = formatLengthCm(cm);
  if (!value) return null;
  return `${ka.cycle.pregnancyApprox} ${value} ${ka.cycle.pregnancyCm}`;
}

export function PregnancySizeIllustration({
  comparisonKey,
  week,
  size = 168,
}: {
  comparisonKey?: string | null;
  week: number;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const source = failed ? pregnancySizeAsset('placeholder') : pregnancySizeAsset(comparisonKey || 'placeholder');
  const name = pregnancyComparisonName(comparisonKey);
  const label = name
    ? ka.cycle.pregnancySizeA11y(name, week)
    : ka.cycle.pregnancySizePlaceholderA11y;
  return (
    <Image
      source={source}
      accessibilityLabel={label}
      onError={() => setFailed(true)}
      resizeMode="contain"
      style={{ width: size, height: size, alignSelf: 'center' }}
    />
  );
}

export function PregnancyWeekMetrics({
  development,
  compact = false,
}: {
  development: WeekDevelopmentView;
  compact?: boolean;
}) {
  const c = useCycleColors();
  if (!development) return null;
  const length = pregnancyLengthText(development.lengthCm);
  const weight = pregnancyWeightText(development.weightGrams);
  const comparison = pregnancyComparisonLine(development.comparisonKey);
  const showArt = Boolean(development.comparisonKey) || development.kind === 'analogy';
  const informational = development.kind === 'informational';

  return (
    <View>
      {showArt ? (
        <PregnancySizeIllustration
          comparisonKey={development.comparisonKey}
          week={development.week}
          size={compact ? 112 : 188}
        />
      ) : null}
      {comparison ? (
        <Text
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: compact ? 15 : 17,
            lineHeight: compact ? 22 : 24,
            textAlign: 'center',
            marginTop: showArt ? 8 : 0,
          }}
        >
          {comparison}
        </Text>
      ) : informational ? (
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
          {ka.cycle.pregnancyWeekInformational}
        </Text>
      ) : null}
      {development.week === 19 && !length ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>
          {ka.cycle.pregnancyWeek19Length}
        </Text>
      ) : null}
      {length || weight ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
            marginTop: 12,
          }}
        >
          {length ? (
            <View style={{ alignItems: 'center', minWidth: 140, maxWidth: '100%', paddingHorizontal: 8 }}>
              <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, textAlign: 'center' }}>
                {pregnancyLengthLabel(development.measurementType)}
              </Text>
              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: compact ? 16 : 18,
                  lineHeight: 24,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                {length}
              </Text>
            </View>
          ) : null}
          {weight ? (
            <View style={{ alignItems: 'center', minWidth: 140, maxWidth: '100%', paddingHorizontal: 8 }}>
              <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, textAlign: 'center' }}>{ka.cycle.pregnancyWeight}</Text>
              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: compact ? 16 : 18,
                  lineHeight: 24,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                {weight}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function PregnancyWeekOpenCta({ onPress }: { onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ka.cycle.pregnancyWeekCta}
      style={{
        minHeight: 44,
        marginTop: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.cardSoft,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
        {ka.cycle.pregnancyWeekCta}
      </Text>
    </Pressable>
  );
}
