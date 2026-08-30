import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { CycleBundle, CycleLog } from '@/lib/api';
import { isCycleTestResult, prioritizeTtcActions } from '@/lib/cycleFertility';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
  date: string;
  log?: CycleLog | null;
  onAction: (key: 'opk' | 'bbt' | 'mucus' | 'sex' | 'pregnancy' | 'full') => void;
};

export function CycleTtcCard({ bundle, date, log, onAction }: Props) {
  const c = useCycleColors();
  const mark = bundle.predictions?.calendar?.[date];
  const window = bundle.predictions?.fertileWindow;
  const ovulation = bundle.predictions?.ovulationDate;
  const actions = useMemo(() => prioritizeTtcActions(log ?? undefined, mark), [log, mark]);

  const observed: string[] = [];
  if (isCycleTestResult(log?.ovulationTest)) {
    observed.push(ka.cycle.ttcOpkToday(ka.cycle.testResult[log.ovulationTest]));
  }
  if (log?.bbt != null) observed.push(ka.cycle.ttcBbtToday(String(log.bbt)));
  if (log?.cervicalMucus) observed.push(ka.cycle.loggedMucus(log.cervicalMucus));
  if (log?.sexualActivity) observed.push(ka.cycle.loggedSex);
  if (isCycleTestResult(log?.pregnancyTest)) {
    observed.push(ka.cycle.loggedPreg(ka.cycle.testResult[log.pregnancyTest]));
  }

  const labels: Record<(typeof actions)[number], string> = {
    opk: ka.cycle.ttcLogOpk,
    bbt: ka.cycle.ttcLogBbt,
    mucus: ka.cycle.ttcLogMucus,
    sex: ka.cycle.ttcLogSex,
    pregnancy: ka.cycle.ttcLogPreg,
  };

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 16,
          marginBottom: 12,
        }}
      >
        {ka.cycle.ttcHomeTitle}
      </Text>

      <Text
        style={{
          color: c.muted,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 11,
          marginBottom: 6,
        }}
      >
        {ka.cycle.ttcEstimateLabel}
      </Text>
      <Text style={{ color: c.ink, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
        {window
          ? `${ka.cycle.estimatedFertileTitle}: ${formatCycleDateKa(window.start)} – ${formatCycleDateKa(window.end)}`
          : ka.cycle.estimatedFertileTitle}
        {ovulation ? `\n${ka.cycle.estimatedOvulationTitle}: ${formatCycleDateKa(ovulation)}` : ''}
      </Text>

      <Text
        style={{
          color: c.muted,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 11,
          marginBottom: 6,
        }}
      >
        {ka.cycle.ttcObservedLabel}
      </Text>
      {observed.length ? (
        observed.map((line) => (
          <Text key={line} style={{ color: c.ink, fontSize: 13, lineHeight: 18, marginBottom: 4 }}>
            {line}
          </Text>
        ))
      ) : (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
          {ka.cycle.ttcEmptyOpk}
        </Text>
      )}
      {!log?.bbt ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 6 }}>
          {ka.cycle.ttcEmptyBbt}
        </Text>
      ) : null}
      {!isCycleTestResult(log?.pregnancyTest) ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
          {ka.cycle.ttcEmptyPreg}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {actions.map((key) => (
          <Pressable
            key={key}
            onPress={() => onAction(key)}
            accessibilityRole="button"
            accessibilityLabel={labels[key]}
            style={{
              minHeight: 40,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: c.cardSoft,
              borderWidth: 1,
              borderColor: c.border,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12 }}>
              {labels[key]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
