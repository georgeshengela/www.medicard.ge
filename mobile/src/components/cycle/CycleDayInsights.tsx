import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Droplets,
  Heart,
  Sparkles,
  Sun,
  Moon,
  NotebookPen,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { CycleBundle, CycleDayMark } from '@/lib/api';
import { buildDayPredictions } from '@/lib/cyclePhase';
import { cycleToday, phaseFromBundle } from '@/lib/cycleCanonical';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { showFertilityUi, showPhaseAsBiological } from '@/lib/cycleContraception';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { CycleInsightsPanel } from '@/components/cycle/CycleInsights';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

function insightTones(c: ReturnType<typeof useCycleColors>) {
  return {
    period: { bg: c.roseSoft, accent: c.period, Icon: Droplets },
    fertile: { bg: c.lavenderSoft, accent: c.fertile, Icon: Heart },
    ovulation: { bg: c.lavenderSoft, accent: c.ovulation, Icon: Sparkles },
    calm: { bg: c.lavenderSoft, accent: c.lavender, Icon: Moon },
    energy: { bg: c.roseSoft, accent: c.blushDeep, Icon: Sun },
    care: { bg: c.roseSoft, accent: c.rose, Icon: Heart },
    mood: { bg: c.cardSoft, accent: c.blushDeep, Icon: Sparkles },
    log: { bg: c.cardSoft, accent: c.rose, Icon: NotebookPen },
  } as const;
}

type Props = {
  date: string;
  bundle: CycleBundle;
  mark?: CycleDayMark;
  pending?: boolean;
  stale?: boolean;
};

export function CycleDayInsights({ date, bundle, mark, pending, stale }: Props) {
  const c = useCycleColors();
  const router = useRouter();
  const today = cycleToday(bundle, todayKey());
  const isToday = date === today;

  const phase = useMemo(() => phaseFromBundle(bundle, date), [bundle, date]);

  const log = useMemo(
    () => bundle.logs.find((l) => l.date === date) ?? null,
    [bundle.logs, date],
  );

  const cards = useMemo(() => {
    const built = buildDayPredictions({
      date,
      today,
      mark,
      phase,
      mode: bundle.profile.mode,
      log,
      nextPeriodStart: bundle.predictions?.nextPeriodStart,
      ovulationDate: showFertilityUi(bundle) ? bundle.predictions?.ovulationDate : null,
      confidence: bundle.predictions?.confidence,
      isIrregular: bundle.profile.isIrregular,
      conditions: bundle.profile.conditions,
    });
    if (showPhaseAsBiological(bundle)) return built;
    return built.filter(
      (card) =>
        card.tone !== 'fertile' &&
        card.tone !== 'ovulation' &&
        card.id !== 'follicular' &&
        card.id !== 'luteal' &&
        card.id !== 'phase',
    );
  }, [date, today, mark, phase, bundle]);

  const tones = insightTones(c);

  return (
    <View key={date} style={{ marginBottom: 16 }}>
      <View
          style={{
            borderRadius: 16,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
          }}
        >
          <Text
            style={{
              color: c.muted,
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 11,
            }}
          >
            {isToday ? ka.cycle.todayInsight : ka.cycle.dayInsight}
          </Text>
          <Text
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 20,
              marginTop: 4,
              letterSpacing: -0.3,
            }}
          >
            {formatCycleDateKa(date)}
          </Text>
          {phase.day != null ? (
            <Text
              style={{
                color: c.rose,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 13,
                marginTop: 6,
              }}
            >
              {ka.cycle.cycleDay} {phase.day} ·{' '}
              {displayPhaseLabel(phase.phase, phase.phaseKa, { loggedPeriod: isBleedFlow(log?.flow) })}
            </Text>
          ) : null}
          {pending ? (
            <Text
              style={{
                color: c.brand,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {ka.cycle.pendingSync}
            </Text>
          ) : null}
        </View>
        <View style={{ height: 12, width: '100%' }} />

      <View style={{ paddingBottom: isToday ? 12 : 0 }}>
        {(['logged', 'estimated'] as const).map((kind) => {
          const group = cards.filter((card) => card.kind === kind);
          if (!group.length) return null;
          return (
            <View key={kind} style={{ marginBottom: 12 }}>
              <Text
                style={{
                  color: c.muted,
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 11,
                  marginBottom: 8,
                  letterSpacing: 0.3,
                }}
              >
                {kind === 'logged' ? ka.cycle.loggedByYou : ka.cycle.estimatedSection}
              </Text>
              {group.map((card, idx) => {
          const tone = tones[card.tone as keyof typeof tones] || tones.calm;
          const Icon = tone.Icon;
          return (
            <View
              key={`${date}-${card.id}`}
              style={{ paddingBottom: idx < group.length - 1 ? 10 : 0, width: '100%' }}
            >
            <Pressable
                onPress={() => {
                  if (card.id === 'log_today' || card.id === 'logged') {
                    router.push({ pathname: '/cycle/log', params: { date } } as never);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={card.title}
                style={{
                  backgroundColor: c.card,
                  borderRadius: 16,
                  overflow: 'hidden',
                  padding: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: tone.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Icon size={18} color={tone.accent} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 14,
                      lineHeight: 18,
                    }}
                  >
                    {card.title}
                  </Text>
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }}
                  >
                    {card.body}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
              })}
            </View>
          );
        })}
      </View>

      {isToday ? (
        <CycleInsightsPanel
          seed={
            (bundle.profile.aiInsights as never) ||
            bundle.localInsights ||
            null
          }
          phase={phase}
          mode={bundle.profile.mode}
          conditions={bundle.profile.conditions}
          log={log}
          confidence={bundle.predictions?.confidence}
          isIrregular={bundle.profile.isIrregular}
          offline={Boolean(stale || pending)}
        />
      ) : null}
    </View>
  );
}
