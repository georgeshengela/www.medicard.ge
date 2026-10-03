import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import type { CycleBundle, CycleLog } from '@/lib/api';
import { isCycleTestResult, prioritizeTtcActions } from '@/lib/cycleFertility';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { MUCUS_OPTIONS } from '@/constants/cycle';
import { showFertilityUi } from '@/lib/cycleContraception';
import { ttcQueryPending } from '@/lib/cycleTtcQuery';
import { ttcSignalFromBundle } from '@/lib/cycleTtcSignals';
import { CycleTtcSignalLine, CycleTtcSignalSheet } from '@/components/cycle/CycleTtcSignalLine';
import { ka } from '@/i18n/ka';
import {
  FERTILITY_STATUS,
  fertilityGateFromBundle,
  forecastPresentationAllowed,
  isPostpartumReturnLearning,
} from '@/lib/cycleForecastEligibility';
import { ovulationBandLine, pastTemperatureOvulationLine, wideWindowLabel } from '@/lib/cycleForecastCopy';
import { isBbtFromHealth } from '@/lib/cycleObservationRegistry';
import { healthBbtSourceLabel } from '@/lib/cycleTemperatureImport';
import { addDaysKey, OVULATION_BAND_HALF_DAYS } from '@/lib/home/homeCycle';
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
  // Ovulation as a 3-day band, never one date (brief §8.2 item 5); a server without the band → centre ± 1.
  const ovulationRange =
    bundle.predictions?.ovulationRange ??
    (ovulation ? { start: addDaysKey(ovulation, -OVULATION_BAND_HALF_DAYS), end: addDaysKey(ovulation, OVULATION_BAND_HALF_DAYS) } : null);
  const gate = fertilityGateFromBundle(bundle);
  const wide = gate.status === FERTILITY_STATUS.WIDE && gate.window === 'wide';
  const actions = useMemo(() => prioritizeTtcActions(log ?? undefined, mark), [log, mark]);
  const fertilityUi = showFertilityUi(bundle);
  const forecastOk = forecastPresentationAllowed(bundle);
  const learning = isPostpartumReturnLearning(bundle);
  const softened = bundle.predictions?.confidence === 'low' || Boolean(bundle.profile.isIrregular);
  // Her temperature showed ovulation in the last completed cycle (train 1.0.0.20 servers only).
  const pastLine = pastTemperatureOvulationLine(bundle.predictions?.fertility?.pastOvulations);
  // One hedged line from her own BBT / OPK / mucus (brief §9 wave 2 item 4). On-device only; the /cycle
  // stack renders only after `requireCycleUnlock`, so the cycle is never locked here.
  const signal = useMemo(() => ttcSignalFromBundle(bundle, date, { locked: false }), [bundle, date]);
  const [explainOpen, setExplainOpen] = useState(false);
  const observed: string[] = [];
  if (isCycleTestResult(log?.ovulationTest)) {
    observed.push(ka.cycle.loggedOpk(ka.cycle.testResult[log.ovulationTest]));
  }
  if (log?.bbt != null) {
    const line = ka.cycle.loggedBbt(String(log.bbt));
    // A BBT read from Apple Health / Health Connect says so; her typed value needs no label.
    observed.push(isBbtFromHealth(log.observations) ? `${line} · ${healthBbtSourceLabel(Platform.OS)}` : line);
  }
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
        {fertilityUi && forecastOk && window && wide ? `\n${wideWindowLabel()}` : ''}
        {fertilityUi && forecastOk && ovulationRange ? `\n${ovulationBandLine(ovulationRange, gate.ovulationSource)}` : ''}
        {fertilityUi && forecastOk && pastLine ? `\n${pastLine}` : ''}
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
      {signal ? (
        <View style={{ marginTop: 10 }}>
          <CycleTtcSignalLine signal={signal} onPress={() => setExplainOpen(true)} />
        </View>
      ) : null}
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
      <CycleTtcSignalSheet kind={signal?.kind ?? null} visible={explainOpen} onClose={() => setExplainOpen(false)} />
    </View>
  );
}
