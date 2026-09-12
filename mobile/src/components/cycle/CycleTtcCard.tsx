import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { CycleBundle, CycleLog } from '@/lib/api';
import { isCycleTestResult, prioritizeTtcActions } from '@/lib/cycleFertility';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { MUCUS_OPTIONS } from '@/constants/cycle';
import { showFertilityUi } from '@/lib/cycleContraception';
import { ttcQueryPending } from '@/lib/cycleTtcQuery';
import { ka } from '@/i18n/ka';
import { forecastPresentationAllowed, isPostpartumReturnLearning } from '@/lib/cycleForecastEligibility';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
  date: string;
  log?: CycleLog | null;
  ttcStatus?: string;
  ttcErrorKind?: string | null;
  onRetryTtc?: () => void;
  onAction: (key: 'opk' | 'bbt' | 'mucus' | 'pregnancy' | 'full') => void;
};

export function CycleTtcCard({
  bundle,
  date,
  log,
  ttcStatus = 'idle',
  ttcErrorKind,
  onRetryTtc,
  onAction,
}: Props) {
  const c = useCycleColors();
  const mark = bundle.predictions?.calendar?.[date];
  const window = bundle.predictions?.fertileWindow;
  const ovulation = bundle.predictions?.ovulationDate;
  const actions = useMemo(() => prioritizeTtcActions(log ?? undefined, mark), [log, mark]);
  const fertilityUi = showFertilityUi(bundle);
  const forecastOk = forecastPresentationAllowed(bundle);
  const learning = isPostpartumReturnLearning(bundle);
  const softened = bundle.predictions?.confidence === 'low' || Boolean(bundle.profile.isIrregular);
  const observed: string[] = [];
  if (isCycleTestResult(log?.ovulationTest)) {
    observed.push(ka.cycle.loggedOpk(ka.cycle.testResult[log.ovulationTest]));
  }
  if (log?.bbt != null) observed.push(ka.cycle.loggedBbt(String(log.bbt)));
  if (log?.cervicalMucus) {
    observed.push(
      ka.cycle.loggedMucus(MUCUS_OPTIONS.find((opt) => opt.id === log.cervicalMucus)?.label ?? log.cervicalMucus),
    );
  }
  if (isCycleTestResult(log?.pregnancyTest)) {
    observed.push(ka.cycle.loggedPreg(ka.cycle.testResult[log.pregnancyTest]));
  }

  const labels: Record<(typeof actions)[number], string> = {
    opk: ka.cycle.ttcLogOpk,
    bbt: ka.cycle.ttcLogBbt,
    mucus: ka.cycle.ttcLogMucus,
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
          marginBottom: 8,
        }}
      >
        {ka.cycle.ttcHomeTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
        {ka.cycle.ttcHonestyLine}
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
      <Text
        style={{ color: c.ink, fontSize: 13, lineHeight: 18, marginBottom: 12 }}
        accessibilityLabel={`${ka.cycle.estimated}: ${
          learning
            ? ka.cycle.postpartumReturnLearning
            : !fertilityUi
              ? ka.cycle.contraceptionTtcLimited
              : window && forecastOk
                ? `${ka.cycle.estimatedFertileTitle} ${formatCycleDateKa(window.start)} – ${formatCycleDateKa(window.end)}`
                : ka.cycle.estimatedFertileTitle
        }`}
      >
        {learning
          ? ka.cycle.postpartumReturnLearning
          : !fertilityUi
            ? ka.cycle.contraceptionTtcLimited
            : window && forecastOk
              ? `${ka.cycle.estimatedFertileTitle}: ${formatCycleDateKa(window.start)} – ${formatCycleDateKa(window.end)}`
              : ka.cycle.estimatedFertileTitle}
        {fertilityUi && forecastOk && ovulation ? `\n${ka.cycle.estimatedOvulationTitle}: ${formatCycleDateKa(ovulation)}` : ''}
        {softened && fertilityUi && forecastOk ? `\n${ka.cycle.ttcLowConfidence}` : ''}
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
          <Text
            key={line}
            style={{ color: c.ink, fontSize: 13, lineHeight: 18, marginBottom: 4 }}
            accessibilityLabel={`${ka.cycle.logged}: ${line}`}
          >
            {line}
          </Text>
        ))
      ) : ttcQueryPending(ttcStatus) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 }}>
          <ActivityIndicator size="small" color={c.brand} />
          <Text style={{ color: c.muted, fontSize: 13 }}>{ka.cycle.ttcLoading}</Text>
        </View>
      ) : ttcStatus === 'error' ? (
        <Pressable
          onPress={() => onRetryTtc?.()}
          accessibilityRole="button"
          accessibilityLabel={ka.common.retry}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
            {ttcErrorKind === 'network' ? ka.common.networkError : ka.cycle.ttcLoadError}
          </Text>
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, marginTop: 4 }}>
            {ka.common.retry}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>{ka.cycle.ttcHistoryEmpty}</Text>
      )}
      {log?.pregnancyTest === 'positive' ? (
        <Text style={{ color: c.ink, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
          {ka.cycle.positivePregBody}
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
              minHeight: 44,
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
