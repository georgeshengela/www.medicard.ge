import React, { useEffect, useMemo } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { Bone } from '@/components/ui/Skeleton';
import { QUEST_ART } from '@/constants/appArt';
import { useHomeStepsWeek } from '@/hooks/useHomeActive';
import type { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { barHeight, buildStepsWeek, groupThousands, kmText, type StepsWeek } from '@/lib/home/activeHome';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING = 132;
const RING_NARROW = 112;
const STROKE = 12;
const BARS_H = 64;
const FILL_MS = 900;
const STEPS_ROUTE = '/health-metrics/steps';

/** Home remounts on every tab return: the ring fills once per app session, then just shows. */
let ringFilledThisSession = false;

type Props = {
  /** Home root's `useStepsMetrics('1d')` — never a second instance here. */
  steps: ReturnType<typeof useStepsMetrics>;
  /** The first block under the header (22 pt instead of the 28 pt section gap). */
  first?: boolean;
};

/**
 * „დღევანდელი მოძრაობა“ — today's steps against the goal and the last seven days.
 * Home never asks for Health permission: the empty state only links to the steps screen.
 */
export function HomeMoveHero({ steps, first = false }: Props) {
  const features = useFeatureState();
  if (!isFeatureOn('steps', features)) return null;
  return <MoveHero steps={steps} first={first} />;
}

function MoveHero({ steps, first }: { steps: Props['steps']; first: boolean }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const narrow = useWindowDimensions().width < 360;
  const bundle = steps.bundle;
  const week = useHomeStepsWeek(bundle?.fetchedAt ?? null);

  const total = bundle?.todayTotal ?? 0;
  const goal = bundle?.goal ?? 0;
  const loading = !bundle && steps.loading;
  const empty = !loading && (!bundle || !bundle.connected);
  const progress = goal > 0 ? Math.min(1, total / goal) : 0;
  const remaining = Math.max(0, goal - total);
  const km = bundle?.insights.distanceKm ?? 0;

  const data = useMemo(
    () => buildStepsWeek({ rows: week.rows ?? {}, todayTotal: total, goal, now: new Date() }),
    [week.rows, total, goal],
  );

  const open = () => router.push(STEPS_ROUTE as never);
  const ringSize = narrow ? RING_NARROW : RING;
  const summary = empty
    ? tx('ნაბიჯები: მონაცემი ჯერ არ არის', 'Steps: no data yet')
    : tx(
        `დღეს ${groupThousands(total)} ნაბიჯი, მიზანი ${groupThousands(goal)}${remaining > 0 ? `, დარჩა ${groupThousands(remaining)}` : ', მიზანი შესრულდა'}`,
        `${groupThousands(total)} steps today, goal ${groupThousands(goal)}${remaining > 0 ? `, ${groupThousands(remaining)} to go` : ', goal reached'}`,
      );

  const ringBlock = (
    <View style={s.top}>
      <StepsRing size={ringSize} progress={empty ? 0 : progress} ready={Boolean(bundle)} track={accent.soft} color={accent.ink}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.ringValue, { color: c.text100 }]}>
          {loading ? '…' : groupThousands(empty ? 0 : total)}
        </Text>
        <Text style={[hubText.small, { color: c.text200 }]}>{tx('ნაბიჯი', 'steps')}</Text>
      </StepsRing>

      <View style={s.side}>
        {loading ? (
          <View style={{ gap: 8 }}>
            <Bone width="60%" height={12} />
            <Bone width="85%" height={20} radius={8} />
            <Bone width="70%" height={12} />
          </View>
        ) : empty ? (
          <>
            <Text style={[s.sideStrong, { color: c.text100 }]}>{tx('ნაბიჯები აქ გამოჩნდება', 'Your steps will show here')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={connectLabel()}
              onPress={open}
              hitSlop={8}
              style={s.connect}
            >
              <Text style={[hubText.link, { color: accent.ink }]}>{connectLabel()}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
              {tx(`მიზანი ${groupThousands(goal)}`, `Goal ${groupThousands(goal)}`)}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.sideStrong, { color: c.text100 }]}>
              {remaining > 0
                ? tx(`დარჩა ${groupThousands(remaining)}`, `${groupThousands(remaining)} to go`)
                : tx('მიზანი შესრულდა', 'Goal reached')}
            </Text>
            {km > 0 ? (
              <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
                {tx(`≈ ${kmText(km)} კმ · სავარაუდოდ`, `≈ ${kmText(km)} km · estimated`)}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {/* Decorative; left out where the copy needs the room (narrow phones, empty / loading). */}
      {narrow || empty || loading ? null : (
        <Image
          source={QUEST_ART.movement}
          accessible={false}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={s.art}
        />
      )}
    </View>
  );

  const card = (
    <>
      {ringBlock}
      <WeekBars week={data} goal={goal} empty={empty || loading} />
    </>
  );

  return (
    <View style={[s.section, { marginTop: first ? 22 : HUB.sectionGap }]}>
      <HomeSectionHeading title={tx('დღევანდელი მოძრაობა', "Today's movement")} linkLabel={tx('ნაბიჯები', 'Steps')} onLink={open} />
      {empty ? (
        // The connect button is the action here; the card itself is not a second button around it.
        <View style={[s.card, { backgroundColor: c.surface }]}>{card}</View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={summary} accessibilityHint={tx('ნაბიჯების გვერდი', 'Opens steps')} onPress={open} style={[s.card, { backgroundColor: c.surface }]}>
          {card}
        </Pressable>
      )}
      <MedicalSourcesLink sourceIds={['dailySteps']} />
    </View>
  );
}

function connectLabel() {
  return Platform.OS === 'ios'
    ? tx('დააკავშირე Apple Health', 'Connect Apple Health')
    : tx('დააკავშირე Health Connect', 'Connect Health Connect');
}

function StepsRing({
  size,
  progress,
  ready,
  track,
  color,
  children,
}: {
  size: number;
  progress: number;
  ready: boolean;
  track: string;
  color: string;
  children: React.ReactNode;
}) {
  // Reanimated's reduced-motion read is synchronous; usePrefersReducedMotion starts at `true`
  // until the async OS answer arrives, which would skip the one fill on the first mount.
  const reduceMotion = useReducedMotion();
  const r = RING / 2 - STROKE / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const shown = useSharedValue(ringFilledThisSession || reduceMotion ? progress : 0);

  useEffect(() => {
    if (!ready) return;
    if (ringFilledThisSession || reduceMotion) {
      shown.value = progress;
      return;
    }
    ringFilledThisSession = true;
    shown.value = withTiming(progress, { duration: FILL_MS, easing: Easing.out(Easing.cubic) });
  }, [progress, ready, reduceMotion, shown]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - shown.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${RING} ${RING}`} accessible={false}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
        {/* At 0 a round cap would still paint a dot at 12 o'clock. */}
        {progress > 0 ? (
          <AnimatedCircle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        ) : null}
      </Svg>
      <View style={s.ringCenter} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

function WeekBars({ week, goal, empty }: { week: StepsWeek; goal: number; empty: boolean }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const goalTop = goal > 0 ? BARS_H - Math.round((goal / week.scaleMax) * BARS_H) : null;
  const noHistory = week.pastDays === 0;
  const label = week.bars
    .map((bar) => `${bar.label} ${bar.value == null ? tx('მონაცემი არ არის', 'no data') : groupThousands(bar.value)}`)
    .join(', ');

  return (
    <View style={{ gap: 8 }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={tx(`ბოლო 7 დღე: ${label}`, `Last 7 days: ${label}`)}
        style={s.bars}
      >
        {week.bars.map((bar) => {
          const h = empty ? 0 : barHeight(bar.value, week.scaleMax, BARS_H);
          return (
            <View key={bar.key} style={s.barCol}>
              <View style={s.barSlot}>
                {h > 0 ? (
                  <View style={[s.bar, { height: h, backgroundColor: bar.isToday ? accent.ink : `${accent.ink}40` }]} />
                ) : (
                  // No synced value for that day: a stub, never a zero.
                  <View style={[s.bar, { height: 4, borderRadius: 2, backgroundColor: c.bg200 }]} />
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  s.barLabel,
                  { color: bar.isToday ? c.text100 : c.text200, fontFamily: bar.isToday ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium' },
                ]}
              >
                {bar.label}
              </Text>
            </View>
          );
        })}
        {goalTop != null && !empty ? (
          <View pointerEvents="none" style={[s.goalLine, { top: goalTop }]}>
            <DashedLine color={c.text300} />
          </View>
        ) : null}
      </View>
      <View style={s.captionRow}>
        <Text numberOfLines={2} style={[s.caption, { color: c.text200, flexShrink: 1 }]}>
          {empty || noHistory
            ? tx('კვირის რიტმი პირველი დღეების შემდეგ გამოჩნდება', 'Your weekly rhythm shows after the first days')
            : week.average != null
              ? tx(`${week.pastDays} დღის საშუალო ${groupThousands(week.average)}`, `${week.pastDays}-day average ${groupThousands(week.average)}`)
              : ''}
        </Text>
        {goal > 0 && !empty ? (
          <View style={s.legend}>
            <View style={{ width: 12, height: 1 }}>
              <DashedLine color={c.text300} />
            </View>
            <Text numberOfLines={1} style={[s.caption, { color: c.text200 }]}>
              {tx(`მიზანი ${groupThousands(goal)}`, `Goal ${groupThousands(goal)}`)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** RN's dashed borders are unreliable on iOS when only one side has a width — draw it instead. */
function DashedLine({ color }: { color: string }) {
  return (
    <Svg width="100%" height={1} accessible={false}>
      <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={color} strokeWidth={1} strokeDasharray="3 3" />
    </Svg>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 18 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  side: { flex: 1, minWidth: 0, gap: 4 },
  sideStrong: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25 },
  connect: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  art: { position: 'absolute', right: -4, top: -8, width: 58, height: 58 },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  ringValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  bars: { flexDirection: 'row', gap: 8, position: 'relative' },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barSlot: { height: BARS_H, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 22, borderRadius: 6 },
  barLabel: { fontSize: 10, lineHeight: 14 },
  goalLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  caption: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 16 },
});
