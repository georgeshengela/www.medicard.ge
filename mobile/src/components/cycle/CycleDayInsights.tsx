import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Droplets,
  Heart,
  Sparkles,
  Sun,
  Moon,
  NotebookPen,
  type LucideIcon,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { CycleBundle, CycleDayMark } from '@/lib/api';
import { buildDayPredictions, detectCyclePhaseForDate } from '@/lib/cyclePhase';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { CycleInsightsPanel } from '@/components/cycle/CycleInsights';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

const TONE: Record<
  string,
  { bg: string; accent: string; Icon: LucideIcon }
> = {
  period: { bg: '#FCE4EC', accent: '#E91E63', Icon: Droplets },
  fertile: { bg: '#F3E5F5', accent: '#AB47BC', Icon: Heart },
  ovulation: { bg: '#EDE7F6', accent: '#8E24AA', Icon: Sparkles },
  calm: { bg: '#F3E5F5', accent: '#AB47BC', Icon: Moon },
  energy: { bg: '#FCE4EC', accent: '#EC407A', Icon: Sun },
  care: { bg: '#F8BBD0', accent: '#C2185B', Icon: Heart },
  mood: { bg: '#FFF0F5', accent: '#D81B60', Icon: Sparkles },
  log: { bg: '#FFF0F5', accent: '#E91E63', Icon: NotebookPen },
};

type Props = {
  date: string;
  bundle: CycleBundle;
  mark?: CycleDayMark;
};

export function CycleDayInsights({ date, bundle, mark }: Props) {
  const c = useCycleColors();
  const router = useRouter();
  const today = todayKey();
  const isToday = date === today;

  const phase = useMemo(
    () =>
      detectCyclePhaseForDate({
        lastPeriodStart: bundle.profile.lastPeriodStart,
        targetDate: date,
        avgCycleLength: bundle.profile.avgCycleLength,
        avgPeriodLength: bundle.profile.avgPeriodLength,
      }),
    [bundle.profile, date],
  );

  const log = useMemo(
    () => bundle.logs.find((l) => l.date === date) ?? null,
    [bundle.logs, date],
  );

  const cards = useMemo(
    () =>
      buildDayPredictions({
        date,
        today,
        mark,
        phase,
        mode: bundle.profile.mode,
        log,
        nextPeriodStart: bundle.predictions.nextPeriodStart,
        ovulationDate: bundle.predictions.ovulationDate,
      }),
    [date, today, mark, phase, bundle],
  );

  return (
    <View key={date} style={{ marginBottom: 8 }}>
      <LinearGradient
          colors={[c.heroFrom, c.heroTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 16,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 12,
            ...cycleShadow.soft,
          }}
        >
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
            {isToday ? ka.cycle.todayInsight : ka.cycle.dayInsight}
          </Text>
          <Text
            style={{
              color: c.ink,
              fontSize: 20,
              fontWeight: '800',
              marginTop: 4,
              letterSpacing: -0.3,
            }}
          >
            {formatCycleDateKa(date)}
          </Text>
          {phase.day != null ? (
            <Text style={{ color: c.rose, fontSize: 13, fontWeight: '700', marginTop: 6 }}>
              {ka.cycle.cycleDay} {phase.day} · {phase.phaseKa}
            </Text>
          ) : null}
        </LinearGradient>

      <View style={{ gap: 10, marginBottom: isToday ? 12 : 0 }}>
        {cards.map((card) => {
          const tone = TONE[card.tone] || TONE.calm;
          const Icon = tone.Icon;
          return (
            <Pressable
              key={`${date}-${card.id}`}
                onPress={() => {
                  if (card.id === 'log_today' || card.id === 'logged') {
                    router.push({ pathname: '/cycle/log', params: { date } } as never);
                  }
                }}
                style={{
                  backgroundColor: c.card,
                  borderRadius: 20,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  ...cycleShadow.card,
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
                  <Text style={{ color: c.ink, fontWeight: '800', fontSize: 14, lineHeight: 18 }}>
                    {card.title}
                  </Text>
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }}
                  >
                    {card.body}
                  </Text>
                </View>
              </Pressable>
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
        />
      ) : null}
    </View>
  );
}
