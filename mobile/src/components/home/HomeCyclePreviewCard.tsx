import React, { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { CalendarHeart } from 'lucide-react-native';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { WEEKDAYS_KA } from '@/constants/cycle';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { useIsDark } from '@/theme/colors';
import type { CycleBundle, CycleDayMark } from '@/lib/api';
import { loadCycleView } from '@/lib/cycleOffline';
import { isCyclePrivacyLockEnabled } from '@/lib/cycleReminderPrefs';
import { addDaysToKey, daysBetween, parseDateKey } from '@/lib/cyclePhase';
import { cycleToday, phaseFromBundle, usedCycleLength } from '@/lib/cycleCanonical';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { useAuth } from '@/store/AuthContext';

const ROSE = '#E11D48';
const ROSE_SOFT = '#FFF1F2';
const ROSE_BORDER = '#FECDD3';
const ROSE_CTA = '#E11D48';
const RING = 88;
const STROKE = 8;

const PHASE_COLOR: Record<string, string> = {
  period: '#E11D48',
  fertile: '#C026D3',
  ovulation: '#A21CAF',
  follicular: '#14B8A6',
  luteal: '#FB7185',
  unknown: '#9CA3AF',
};

type Props = {
  onPress: () => void;
};

function weekdayShort(key: string) {
  const { y, m, d } = parseDateKey(key);
  const idx = (new Date(y, m, d).getDay() + 6) % 7;
  return WEEKDAYS_KA[idx]?.slice(0, 2) ?? '';
}

function MiniRing({
  progress,
  color,
  center,
  caption,
}: {
  progress: number;
  color: string;
  center: string;
  caption: string;
}) {
  const FIGMA_CHAT = useFigmaChat();
  const r = (RING - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={FIGMA_CHAT.border}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - clamped)}
          rotation="-90"
          origin={`${RING / 2}, ${RING / 2}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 22,
            lineHeight: 26,
            color: FIGMA_CHAT.textPrimary,
            letterSpacing: -0.4,
          }}
        >
          {center}
        </Text>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_500Medium',
            fontSize: 10,
            lineHeight: 13,
            color: FIGMA_CHAT.textSecondary,
          }}
        >
          {caption}
        </Text>
      </View>
    </View>
  );
}

function WeekDots({ today, marks }: { today: string; marks: Record<string, CycleDayMark> }) {
  const FIGMA_CHAT = useFigmaChat();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i - 3)), [today]);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((key) => {
        const mark = marks[key];
        const isToday = key === today;
        const fill = mark?.period ? ROSE : mark?.ovulation ? '#A21CAF' : mark?.fertile ? '#E879F9' : FIGMA_CHAT.border;
        const { d } = parseDateKey(key);

        return (
          <View key={key} style={{ alignItems: 'center', width: 36, gap: 4 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: 10,
                lineHeight: 13,
                color: isToday ? ROSE : FIGMA_CHAT.textSecondary,
              }}
            >
              {weekdayShort(key)}
            </Text>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: mark?.period || mark?.ovulation || mark?.fertile ? `${fill}22` : FIGMA_CHAT.white,
                borderWidth: isToday ? 2 : 1,
                borderColor: isToday ? ROSE : fill,
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 11,
                  color: mark?.period ? ROSE : FIGMA_CHAT.textPrimary,
                }}
              >
                {d}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function HomeCyclePreviewCard({ onPress }: Props) {
  const { user } = useAuth();
  const FIGMA_CHAT = useFigmaChat();
  const dark = useIsDark();
  const roseFill = dark ? '#4c0519' : ROSE_SOFT;
  const roseLine = dark ? '#9f1239' : ROSE_BORDER;
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [offline, setOffline] = useState(false);
  const [privacyLocked, setPrivacyLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const today = cycleToday(bundle, todayKey());

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!user?.id) {
        setReady(true);
        return () => {
          alive = false;
        };
      }
      void isCyclePrivacyLockEnabled()
        .then((locked) => {
          if (!alive) return locked;
          setPrivacyLocked(locked);
          if (locked) {
            setBundle(null);
            setOffline(false);
            return true;
          }
          return false;
        })
        .then((locked) => {
          if (!alive || locked) return null;
          return loadCycleView(user.id);
        })
        .then((view) => {
          if (!alive || !view) return;
          setBundle(view.display);
          setOffline(view.reachable === false);
        })
        .catch(() => {
          if (alive) setBundle(null);
        })
        .finally(() => {
          if (alive) setReady(true);
        });
      return () => {
        alive = false;
      };
    }, [user?.id]),
  );

  const cycleLen = bundle ? usedCycleLength(bundle) : 28;
  const lastPeriod = bundle?.profile.lastPeriodStart ?? null;
  const pregnancy = bundle?.profile.mode === 'PREGNANCY' ? bundle.pregnancy : null;
  const setupNeeded = ready && Boolean(bundle) && !lastPeriod && !pregnancy;

  const phase = bundle ? phaseFromBundle(bundle, today) : { day: null, phase: 'unknown' as const, phaseKa: '' };

  const nextLine = useMemo(() => {
    const start = bundle?.predictions?.nextPeriodStart;
    if (!start) return null;
    const n = daysBetween(today, start);
    if (n <= 0) return ka.home.cycleNextToday;
    if (n === 1) return ka.home.cycleNextTomorrow;
    return ka.home.cycleNextIn(n);
  }, [bundle?.predictions?.nextPeriodStart, today]);

  const phaseColor = PHASE_COLOR[phase.phase] ?? ROSE;
  const progress = pregnancy?.age
    ? Math.min(1, pregnancy.age.dayOfPregnancy / 280)
    : phase.day && cycleLen
      ? phase.day / cycleLen
      : 0;

  const title = ka.modules.cycle.title;
  const cta = setupNeeded ? ka.home.cycleSetupCta : ka.home.cycleCta;

  return (
    <View>
      <View style={{ paddingVertical: 8 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 16,
            lineHeight: 22,
            color: FIGMA_CHAT.textPrimary,
          }}
        >
          {title}
        </Text>
      </View>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} activeOpacity={0.92} onPress={onPress}>
        <View
          pointerEvents="none"
          style={{
            backgroundColor: FIGMA_CHAT.cardBg,
            borderWidth: 1,
            borderColor: FIGMA_CHAT.border,
            borderRadius: 24,
            padding: 16,
            gap: 16,
            overflow: 'hidden',
            ...FIGMA_CHAT.shadowXs,
          }}
        >
          {setupNeeded || (ready && !bundle) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  backgroundColor: roseFill,
                  borderWidth: 1,
                  borderColor: roseLine,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarHeart size={24} color={ROSE} strokeWidth={2} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA_CHAT.textPrimary,
                }}
              >
                {privacyLocked ? ka.cycle.privacyLockTitle : ka.home.cycleSetupBody}
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <MiniRing
                  progress={progress}
                  color={pregnancy ? '#C026D3' : phaseColor}
                  center={pregnancy?.age ? String(pregnancy.age.week) : phase.day != null ? String(phase.day) : '—'}
                  caption={pregnancy ? ka.cycle.week : ka.cycle.day}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 16,
                      lineHeight: 22,
                      color: FIGMA_CHAT.textPrimary,
                    }}
                    numberOfLines={2}
                  >
                    {pregnancy?.age
                      ? ka.home.cyclePregnantLine(pregnancy.age.week, pregnancy.age.trimester)
                      : phase.day != null
                        ? displayPhaseLabel(phase.phase, phase.phaseKa, {
                            loggedPeriod: isBleedFlow(bundle?.logs.find((l) => l.date === today)?.flow),
                          })
                        : ka.modules.cycle.subtitle}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: 13,
                      lineHeight: 18,
                      color: FIGMA_CHAT.textSecondary,
                    }}
                  >
                    {offline
                      ? ka.cycle.offlineBanner
                      : pregnancy?.dueDate
                      ? ka.home.cycleDueIn(daysBetween(today, pregnancy.dueDate))
                      : phase.day != null
                        ? ka.home.cycleDayOf(phase.day, cycleLen)
                        : ka.modules.cycle.subtitle}
                  </Text>
                  {pregnancy ? null : nextLine ? (
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_600SemiBold',
                        fontSize: 13,
                        lineHeight: 18,
                        color: ROSE_CTA,
                      }}
                    >
                      {nextLine}
                    </Text>
                  ) : null}
                </View>
              </View>

              {pregnancy || !bundle ? null : <WeekDots today={today} marks={bundle.predictions.calendar ?? {}} />}
            </>
          )}

          <View style={{ height: 1, backgroundColor: FIGMA_CHAT.border }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                lineHeight: 20,
                color: ROSE_CTA,
              }}
            >
              {cta}
            </Text>
            <CalendarHeart size={20} color={ROSE_CTA} strokeWidth={2} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}
