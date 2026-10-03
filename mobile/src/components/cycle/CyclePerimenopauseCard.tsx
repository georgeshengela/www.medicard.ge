import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React from 'react';
import { Text, View } from 'react-native';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleBundle, CyclePerimenopausePayload } from '@/lib/api';
import { tx } from '@/i18n/locale';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { periForecastView, periNextPeriodLabel, type PeriForecastView } from '@/lib/cyclePerimenopauseForecast';
import { shortDateRange } from '@/lib/cycleForecastCopy';
import { daysBetweenKeys } from '@/lib/home/homeCycle';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

type Props = {
  peri: CyclePerimenopausePayload | null | undefined;
  /** `bundle.predictions` — the window (`nextPeriodRange`) the forecast block words. */
  predictions?: Pick<CycleBundle['predictions'], 'nextPeriodStart' | 'nextPeriodRange'> | null;
  /** Cycle-civil today and the last period start (for the window track). */
  today: string;
  lastPeriodStart?: string | null;
  onLog?: () => void;
};

function variabilityCopy(peri: CyclePerimenopausePayload) {
  const v = peri.variabilitySummary;
  if (v.intervalCount >= 2 && v.shortestDays != null && v.longestDays != null) {
    return ka.cycle.periVariabilityRange(v.shortestDays, v.longestDays);
  }
  if (v.intervalCount === 1 && v.recentIntervalDays != null) {
    return ka.cycle.periVariabilityOne(v.recentIntervalDays);
  }
  return ka.cycle.periVariabilityNeedMore;
}

/**
 * Perimenopause hero (W3-4, brief §9 „მერე“ item 7): the next period only as a window — „სავარაუდოდ
 * 3–12 ოქტ“ with the same before / open / passed states as every other surface — or an honest „no date
 * yet“, a calm long-gap line, or the 12-month doctor note. Then the facts she logged. Not a diagnosis.
 */
export function CyclePerimenopauseCard({ peri, predictions, today, lastPeriodStart, onLog }: Props) {
  const c = useCycleColors();
  const view = periForecastView({ forecast: peri?.forecast, predictions, today });
  const last = peri?.lastRecordedBleeding?.date
    ? ka.cycle.periLastBleeding(formatCycleDateKa(peri.lastRecordedBleeding.date))
    : ka.cycle.periNoBleeding;
  const episodeCount = peri?.recentBleedingEpisodes.length ?? 0;
  const lastFlow = peri?.lastRecordedBleeding?.flow ? cycleChipLabel(peri.lastRecordedBleeding.flow) : null;
  const observation = peri?.recentObservations[0];
  // A live window: „შემდეგი მენსტრუაცია · სავარაუდოდ“ above, the dates big (they never wrap mid-range).
  const liveWindow = view.kind === 'range' && view.state !== 'late' && view.from && view.to;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${ka.cycle.periModeTitle}. ${periNextPeriodLabel()}: ${view.title}${view.detail ? `. ${view.detail}` : ''}`}
      style={{ borderRadius: 22, backgroundColor: c.card, padding: 18 }}
    >
      <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16 }}>
        {liveWindow ? `${periNextPeriodLabel()} · ${tx('სავარაუდოდ', 'likely')}` : periNextPeriodLabel()}
      </Text>
      <Text
        style={{
          color: liveWindow ? c.period : c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: liveWindow ? 28 : 18,
          lineHeight: liveWindow ? 36 : 25,
          marginTop: 4,
          fontVariant: ['tabular-nums'],
        }}
      >
        {liveWindow ? shortDateRange(view.from!, view.to!) : view.title}
      </Text>
      {view.detail ? (
        <Text style={{ color: c.ink, fontSize: 14, lineHeight: 21, marginTop: 4 }}>{view.detail}</Text>
      ) : null}
      {view.kind === 'range' && view.from && view.to && lastPeriodStart ? (
        <WindowTrack view={view} today={today} lastPeriodStart={lastPeriodStart} />
      ) : null}
      {view.basis ? (
        <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 8 }}>{view.basis}</Text>
      ) : null}

      <View style={{ height: 1, backgroundColor: c.border, marginVertical: 16 }} />

      <Fact title={ka.cycle.periRecentBleeding}>
        {[last, lastFlow, episodeCount > 0 ? ka.cycle.periEpisodeCount(episodeCount) : null].filter(Boolean).join(' · ')}
      </Fact>
      <Fact title={ka.cycle.periVariability}>{peri ? variabilityCopy(peri) : ka.cycle.periVariabilityNeedMore}</Fact>
      <Fact title={ka.cycle.periBodyChanges}>
        {observation
          ? `${formatCycleDateKa(observation.date)} · ${[
              ...observation.symptoms.map((key) => cycleChipLabel(key)),
              ...observation.moods.map((key) => cycleChipLabel(key)),
            ]
              .filter(Boolean)
              .join(' · ')}`
          : ka.cycle.periBodyChangesEmpty}
      </Fact>

      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{ka.cycle.periNotDiagnosis}</Text>

      {onLog ? (
        <Pressable
          onPress={onLog}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.periQuickLog}
          style={{
            marginTop: 16,
            minHeight: 48,
            borderRadius: 16,
            backgroundColor: c.cta,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.onPrimary, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
            {ka.cycle.periQuickLog}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useCycleColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18 }}>{title}</Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{children}</Text>
    </View>
  );
}

/**
 * Day 1 of this cycle → a few days past the window: the window as a dashed rose band (expected period
 * grammar), today as an ink tick. Decorative — the words above carry the meaning.
 */
function WindowTrack({ view, today, lastPeriodStart }: { view: PeriForecastView; today: string; lastPeriodStart: string }) {
  const c = useCycleColors();
  const total = Math.max(1, daysBetweenKeys(lastPeriodStart, view.to!) + 4);
  const pos = (key: string) => Math.max(0, Math.min(1, daysBetweenKeys(lastPeriodStart, key) / total));
  const from = pos(view.from!);
  const to = pos(view.to!) + 1 / total;
  const now = pos(today);
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ marginTop: 14 }}>
      <View style={{ height: 14, justifyContent: 'center' }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.gaugeTrack }} />
        <View
          style={{
            position: 'absolute',
            left: `${from * 100}%`,
            width: `${Math.max(0.02, to - from) * 100}%`,
            height: 14,
            borderRadius: 7,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: c.period,
            backgroundColor: cycleHexAlpha(c.period, 0.14),
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: `${now * 100}%`,
            marginLeft: -1.5,
            width: 3,
            height: 20,
            top: -3,
            borderRadius: 2,
            backgroundColor: c.ink,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 3, height: 12, borderRadius: 2, backgroundColor: c.ink }} />
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 15 }}>{ka.cycle.heroToday}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, height: 10, borderRadius: 5, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.period, backgroundColor: cycleHexAlpha(c.period, 0.14) }} />
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 15 }}>{tx('სავარაუდო ფანჯარა', 'Estimated window')}</Text>
        </View>
      </View>
    </View>
  );
}
