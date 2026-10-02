import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { Baby, CalendarHeart, Check, Droplet, Flower2, Lock, Plus, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import type { MedicalSourceId } from '@/constants/medicalSources';
import { CyclePeriodToast } from '@/components/cycle/CyclePeriodToast';
import { CycleQuickLogSheet } from '@/components/cycle/CycleQuickLogSheet';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleBundle } from '@/lib/api';
import type { CycleView } from '@/lib/cycleOffline';
import { cycleToday, phaseFromBundle, usedCycleLength } from '@/lib/cycleCanonical';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { bleedingIsUncertain, showFertilityUi, showOvulationUi } from '@/lib/cycleContraception';
import { forecastPresentationAllowed, suppressCycleLengthChrome } from '@/lib/cycleForecastEligibility';
import { cycleLoggedBleedLabel } from '@/lib/cycleHistoryCopy';
import { needsCycleOnboarding } from '@/lib/cycleExperience';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { formatYmd } from '@/lib/format';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import {
  cycleCenter,
  cycleHeroActions,
  cycleHeroVariant,
  cycleRingModel,
  cycleWeekStrip,
  daysBetweenKeys,
  fertileDaysInCycle,
  recordedPeriodDaysInCycle,
  startLeads,
  type CycleCenter,
  type CycleHeroActionId,
  type RingArc,
  type RingPhaseKind,
  type StripDay,
} from '@/lib/home/homeCycle';
import { useThemeColors, useIsDark } from '@/theme/colors';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import {
  registerHomeCycleToastHost,
  useHomeCycleActions,
  useHomeCycleToastEntry,
  useHomeCycleToastHosted,
} from './useHomeCycleActions';

/** Shared cycle data from the Home root (`useCycleView` mounted once there). */
export type HomeCycleData = {
  view: CycleView | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
};

export type HomeCycleHeroProps = {
  cycle: HomeCycleData;
  /** Face ID / PIN cycle lock; `null` = not read yet → fixed-height placeholder, never cycle data. */
  locked: boolean | null;
  userId: string | null | undefined;
  /** Right under the header (22 pt instead of the section gap). */
  first?: boolean;
};

const STRIP_H = 13 + 4 + 38 + 5;

/**
 * „ციკლი დღეს“ — the women's Home hero: a static phase ring, honest status, one-tap actions
 * (same library calls as the cycle screen) and the −3…+3 day strip in the cycle colour grammar.
 * Every gate (lock, mode, forecast, fertility, contraception) mirrors `/cycle`; sex, BBT and test
 * marks never appear here.
 */
export function HomeCycleHero({ cycle, locked, userId, first }: HomeCycleHeroProps) {
  const router = useRouter();
  const theme = useThemeColors();
  const c = useCycleColors();
  const accent = useHomeAccent();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const ringSize = compact ? 104 : 132;
  const heroMinHeight = HUB.cardPad * 2 + ringSize + 16 + 48 + 16 + STRIP_H;

  const view = locked === false ? cycle.view : null;
  const bundle: CycleBundle | null = view?.display ?? null;
  const today = cycleToday(bundle, todayKey());
  const actions = useHomeCycleActions({ userId, today, view, retry: cycle.retry });
  const toastHosted = useHomeCycleToastHosted();
  const cycleOn = isFeatureOn('cycle', useFeatureState());

  const caps = cycleModeCapabilities(bundle?.profile.mode);
  const variant = cycleHeroVariant({
    locked,
    hasView: Boolean(bundle),
    failed: cycle.failed,
    setupNeeded: Boolean(bundle) && needsCycleOnboarding(bundle?.profile.mode, bundle?.profile.lastPeriodStart ?? null),
    pregnancy: caps.showPregnancyOverview,
    postpartum: caps.showPostpartumOverview,
    peri: caps.showPerimenopauseTracking,
  });

  // The women's layout already falls back to standard while the module is paused; never show it anyway.
  if (!cycleOn) return null;

  const openCycle = () => router.push('/cycle' as never);
  const top = first ? 22 : HUB.sectionGap;
  const card = [s.card, { backgroundColor: theme.surface }];

  let body: React.ReactNode = null;
  let sourceIds: MedicalSourceId[] | null = null;

  if (variant === 'lockUnknown') {
    body = <View style={[card, { height: heroMinHeight }]} />;
  } else if (variant === 'loading') {
    body = <HeroSkeleton ringSize={ringSize} minHeight={heroMinHeight} />;
  } else if (variant === 'locked') {
    body = (
      <View style={card}>
        <View style={s.row}>
          <View style={[s.tile, { backgroundColor: accent.tint }]}>
            <Lock size={21} color={accent.ink} strokeWidth={1.8} />
          </View>
          <View style={s.column}>
            <Text style={[hubText.cardTitle, { color: theme.text100 }]}>{ka.cycle.privacyLockTitle}</Text>
            <Text style={[hubText.body, { color: theme.text200 }]}>
              {tx('ციკლის დეტალები მთავარ გვერდზე დამალულია.', 'Your cycle details are hidden on Home.')}
            </Text>
          </View>
        </View>
        <HeroButton label={tx('გახსნა', 'Unlock')} filled onPress={openCycle} />
      </View>
    );
  } else if (variant === 'failed') {
    body = (
      <View style={card}>
        <Text accessibilityRole="alert" style={[hubText.body, { color: theme.text100 }]}>
          {tx('ციკლის მონაცემები ახლა ვერ ჩაიტვირთა.', "Couldn't load your cycle right now.")}
        </Text>
        <HeroButton label={ka.common.retry} icon={RotateCcw} onPress={cycle.retry} />
      </View>
    );
  } else if (bundle && variant === 'setup') {
    body = (
      <View style={card}>
        <View style={s.row}>
          <View style={[s.bigTile, { backgroundColor: accent.soft }]}>
            <CalendarHeart size={30} color={accent.ink} strokeWidth={1.8} />
          </View>
          <View style={s.column}>
            <Text style={[s.title, { color: c.ink }]}>{tx('დაიწყე ციკლის თვალყური', 'Start tracking your cycle')}</Text>
            <Text style={[hubText.body, { color: theme.text200 }]}>{ka.home.cycleSetupBody}</Text>
          </View>
        </View>
        <HeroButton label={tx('ბოლო მენსტრუაციის მითითება', 'Add your last period')} icon={CalendarHeart} filled onPress={openCycle} />
      </View>
    );
  } else if (bundle && variant === 'pregnancy') {
    const pregnancy = bundle.pregnancy;
    const age = pregnancy?.reviewRequired ? null : (pregnancy?.age ?? null);
    const detail = pregnancy?.reviewRequired
      ? ka.cycle.pregnancyReviewRequired
      : age
        ? ka.home.cyclePregnantLine(age.week, age.trimester)
        : null;
    const due = !pregnancy?.reviewRequired && pregnancy?.dueDate ? `${ka.cycle.dueDate} · ${formatYmd(pregnancy.dueDate)}` : null;
    const openWeek = () =>
      router.push((age ? `/cycle/week/${age.week}` : '/cycle/pregnancy/timeline') as never);
    sourceIds = ['pregnancyDueDate', 'pregnancyWeeks'];
    body = (
      <View style={card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[ka.cycle.pregnancyModeTitle, detail, due].filter(Boolean).join('. ')}
          onPress={openCycle}
          style={s.row}
        >
          <HomeCycleRing
            size={ringSize}
            progress={age ? Math.min(1, age.dayOfPregnancy / 280) : 0}
            progressColor={c.gaugeProgress}
            center={{ top: null, value: age ? String(age.week) : '—', bottom: ka.cycle.week }}
          />
          <StatusColumn
            title={ka.cycle.pregnancyModeTitle}
            detail={detail}
            badge={due}
            offline={view?.reachable === false}
          />
        </Pressable>
        <View style={s.buttons}>
          <HeroButton label={ka.cycle.storyLogTitle} icon={Plus} filled flex={1.7} onPress={() => actions.openLog()} />
          <HeroButton label={tx('კვირის გზამკვლევი', "This week's guide")} icon={Baby} flex={1} onPress={openWeek} />
        </View>
      </View>
    );
  } else if (bundle && (variant === 'postpartum' || variant === 'peri')) {
    const peri = variant === 'peri';
    const elapsed = bundle.postpartum?.elapsed;
    const lastBleed = bundle.perimenopause?.lastRecordedBleeding?.date;
    const title = peri ? ka.cycle.homePeriLabel : ka.cycle.homePostpartumLabel;
    const detail = peri
      ? lastBleed
        ? ka.cycle.periLastBleeding(formatCycleDateKa(lastBleed))
        : ka.cycle.periNoBleeding
      : elapsed
        ? ka.cycle.postpartumElapsed(elapsed.week, elapsed.day)
        : ka.cycle.postpartumNoReference;
    const Icon = peri ? Flower2 : Baby;
    sourceIds = ['menstrualCycle'];
    body = (
      <View style={card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={openCycle} style={s.row}>
          <View style={[s.bigTile, { backgroundColor: accent.soft }]}>
            <Icon size={30} color={accent.ink} strokeWidth={1.8} />
          </View>
          <StatusColumn title={title} detail={detail} offline={view?.reachable === false} />
        </Pressable>
        <HeroButton label={ka.cycle.storyLogTitle} icon={Plus} filled onPress={() => actions.openLog()} />
        {peri ? (
          <WeekStrip
            days={cycleWeekStrip({
              today,
              calendar: bundle.predictions?.calendar,
              bleedLogs: bundle.logs,
              showFertility: false,
              showOvulation: false,
              showPredicted: false,
            })}
            compact={compact}
            bleedLabel={cycleLoggedBleedLabel(bundle.profile.mode, ka.cycle)}
          />
        ) : null}
      </View>
    );
  } else if (bundle && variant === 'cycle') {
    sourceIds = ['menstrualCycle'];
    body = (
      <ClassicCycleCard
        bundle={bundle}
        today={today}
        offline={view?.reachable === false}
        ringSize={ringSize}
        compact={compact}
        dayOne={actions.toastDate === today}
        busy={actions.busy}
        onStart={actions.startPeriod}
        onEnd={actions.endPeriod}
        onLog={() => actions.openLog()}
        onOpen={openCycle}
        error={actions.error}
      />
    );
  }

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: top }}>
      <HomeSectionHeading
        title={tx('ციკლი დღეს', 'Your cycle today')}
        linkLabel={tx('კალენდარი', 'Calendar')}
        onLink={openCycle}
      />
      {body}
      {sourceIds ? <MedicalSourcesLink sourceIds={sourceIds} /> : null}
      {variant !== 'cycle' && actions.error ? (
        <Text accessibilityRole="alert" style={[hubText.caption, { color: theme.danger, marginTop: 6 }]}>
          {actions.error}
        </Text>
      ) : null}
      {actions.sheet.visible && userId && locked === false ? (
        <CycleQuickLogSheet
          visible
          date={actions.sheet.date}
          isPeriodStart={actions.sheet.periodStart}
          onClose={actions.closeSheet}
          onSaved={actions.onSheetSaved}
          onOpenFull={actions.openFullLog}
        />
      ) : null}
      {actions.toastDate && !toastHosted ? (
        <CyclePeriodToast
          bottomInset={0}
          onAddFlow={() => actions.addFlow(actions.toastDate as string)}
          onUndo={() => actions.undoStart(actions.toastDate as string)}
        />
      ) : null}
    </View>
  );
}

/**
 * Renders the „მენსტრუაცია დაფიქსირდა“ toast above the tab bar. Mount it once on Home as a sibling
 * AFTER the ScrollView (outside it), so it stays put while the page scrolls.
 */
export function HomeCycleToastHost() {
  const entry = useHomeCycleToastEntry();
  const inset = useTabBarInset(0);
  useEffect(() => registerHomeCycleToastHost(), []);
  if (!entry) return null;
  return <CyclePeriodToast bottomInset={inset} onAddFlow={entry.onAddFlow} onUndo={entry.onUndo} />;
}

// ---------- classic cycle card (TRACK_PERIOD / TRY_TO_CONCEIVE) ----------

function ClassicCycleCard({
  bundle,
  today,
  offline,
  ringSize,
  compact,
  dayOne,
  busy,
  onStart,
  onEnd,
  onLog,
  onOpen,
  error,
}: {
  bundle: CycleBundle;
  today: string;
  offline: boolean;
  ringSize: number;
  compact: boolean;
  dayOne: boolean;
  busy: boolean;
  onStart: () => void;
  onEnd: () => void;
  onLog: () => void;
  onOpen: () => void;
  error: string | null;
}) {
  const theme = useThemeColors();
  const c = useCycleColors();
  const caps = cycleModeCapabilities(bundle.profile.mode);
  const phase = phaseFromBundle(bundle, today);
  const cycleLen = usedCycleLength(bundle);
  const length = Math.round(cycleLen) || 28;
  const todayLog = bundle.logs.find((l) => l.date === today);
  const onPeriod = isBleedFlow(todayLog?.flow);
  const uncertainBleed = bleedingIsUncertain(bundle);
  const hideLengthChrome = suppressCycleLengthChrome(bundle);
  const hidePredicted = !forecastPresentationAllowed(bundle);
  const fertilityVisible = showFertilityUi(bundle);
  const next = bundle.predictions?.nextPeriodStart ?? null;
  const predictedToday = Boolean(bundle.predictions?.calendar?.[today]?.period && bundle.predictions.calendar[today].predicted);
  const forecastOn = Boolean(next) && caps.showNextPeriodForecast && !hidePredicted;
  const inDays = next ? daysBetweenKeys(today, next) : null;
  const day = hideLengthChrome ? null : phase.day;

  const ring = cycleRingModel({
    day,
    cycleLength: cycleLen,
    periodLength: bundle.averages?.usedPeriodLength ?? bundle.profile?.avgPeriodLength ?? 5,
    recordedPeriodDays: hideLengthChrome
      ? []
      : recordedPeriodDaysInCycle({
          today,
          day,
          cycleLength: cycleLen,
          bleedDates: bundle.logs.filter((l) => isBleedFlow(l.flow)).map((l) => l.date),
        }),
    fertileDays: fertileDaysInCycle({
      today,
      day,
      cycleLength: cycleLen,
      window: fertilityVisible && !hidePredicted ? bundle.predictions?.fertileWindow : null,
    }),
    hideLengthChrome,
    capDeg: ringGeometry(ringSize).capDeg,
  });

  const center = cycleCenter({ hideLengthChrome, hidePredicted, onPeriod, predictedToday, forecastOn, inDays, day, cycleLength: cycleLen });
  const centerText = centerCopy(center, uncertainBleed);

  const title = hideLengthChrome
    ? ka.cycle.postpartumReturnGathering
    : phase.day != null
      ? displayPhaseLabel(phase.phase, phase.phaseKa, { loggedPeriod: onPeriod })
      : ka.cycle.statusLearning;
  const detail = hideLengthChrome
    ? ka.cycle.postpartumReturnLearning
    : phase.day != null
      ? phase.day > length
        ? ka.cycle.heroUsualLength(length)
        : ka.cycle.heroCycleDayOf(phase.day, length)
      : null;
  const late = forecastOn && inDays != null && inDays < 0 && caps.showLatePeriod;
  const badge = forecastOn && next && !onPeriod
    ? late
      ? { text: ka.cycle.lateCalmTitle, calm: true }
      : inDays != null && inDays >= 0
        ? { text: `${ka.cycle.heroLikely} · ${formatYmd(next)}`, calm: false }
        : null
    : null;

  const leads = startLeads({ onPeriod, forecastOn, predictedToday, inDays });
  const isDayOne = dayOne || bundle.profile.lastPeriodStart === today || (onPeriod && phase.day === 1);
  const plan = cycleHeroActions({ onPeriod, dayOne: isDayOne, leadsWithStart: leads });
  const startLabel = uncertainBleed ? ka.cycle.heroBleedingStarted : ka.cycle.heroPeriodStarted;
  const button = (id: CycleHeroActionId, filled: boolean) => {
    // The tonal button carries no icon, so the filled one keeps its label on one line at 390 pt.
    const common = { filled, flex: filled ? 1.9 : 1, disabled: busy } as const;
    if (id === 'start') return <HeroButton key={id} {...common} label={startLabel} icon={filled ? Droplet : undefined} onPress={onStart} />;
    if (id === 'end') return <HeroButton key={id} {...common} label={ka.cycle.periodEndCta} icon={filled ? Check : undefined} onPress={onEnd} />;
    if (id === 'logFlow') return <HeroButton key={id} {...common} label={ka.cycle.logTodayFlow} icon={filled ? Droplet : undefined} onPress={onLog} />;
    return (
      <HeroButton
        key={id}
        {...common}
        label={filled ? ka.cycle.logTodayCta : tx('აღრიცხვა', 'Log')}
        a11y={ka.cycle.logTodayCta}
        icon={filled ? Plus : undefined}
        onPress={onLog}
      />
    );
  };

  const strip = cycleWeekStrip({
    today,
    calendar: bundle.predictions?.calendar,
    bleedLogs: bundle.logs,
    showFertility: fertilityVisible,
    showOvulation: showOvulationUi(bundle),
    showPredicted: caps.showFertileEstimates && !hidePredicted,
  });

  const summary = [
    title,
    detail,
    [centerText.top, centerText.value, centerText.bottom].filter(Boolean).join(' '),
    badge?.text,
    caps.showTtcOverview ? ka.cycle.homeTtcLabel : null,
    offline ? ka.cycle.offlineBanner : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={[s.card, { backgroundColor: theme.surface }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={summary} onPress={onOpen} style={s.row}>
        <HomeCycleRing size={ringSize} arcs={ring.arcs} todayDeg={ring.todayDeg} center={centerText} />
        <StatusColumn
          title={title}
          detail={detail}
          badge={badge?.text ?? null}
          badgeCalm={badge?.calm}
          note={caps.showTtcOverview ? ka.cycle.homeTtcLabel : null}
          offline={offline}
        />
      </Pressable>
      <View style={s.buttons}>
        {button(plan.primary, true)}
        {plan.secondary ? button(plan.secondary, false) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[hubText.caption, { color: theme.danger, marginTop: -6 }]}>
          {error}
        </Text>
      ) : null}
      <WeekStrip days={strip} compact={compact} bleedLabel={cycleLoggedBleedLabel(bundle.profile.mode, ka.cycle)} />
    </View>
  );
}

type CenterText = { top: string | null; value: string; bottom: string | null; tone?: 'period' };

function centerCopy(center: CycleCenter, uncertainBleed: boolean): CenterText {
  switch (center.kind) {
    case 'periodDay':
      return {
        top: uncertainBleed ? ka.cycle.heroBleedingDay : ka.cycle.heroPeriodDay,
        value: center.day != null ? String(center.day) : '—',
        bottom: null,
        tone: 'period',
      };
    case 'periodToday':
      return { top: ka.cycle.heroLikely, value: ka.cycle.heroToday, bottom: ka.cycle.legendPeriodPredicted, tone: 'period' };
    case 'countdown':
      return {
        // Short words: the captions sit where the ring is narrow. „სავარაუდოდ“ + the date stay in the
        // dashed badge beside the ring, so the estimate is still named as one.
        top: uncertainBleed ? tx('სისხლდენა', 'Bleeding in') : tx('მენსტრუაცია', 'Period in'),
        value: String(center.days),
        bottom: tx('დღეში', center.days === 1 ? 'day' : 'days'),
      };
    case 'late':
      return { top: ka.cycle.cycleDay, value: String(center.day), bottom: ka.cycle.heroLateBy(center.lateBy) };
    case 'cycleDay':
      return {
        top: ka.cycle.cycleDay,
        value: center.day != null ? String(center.day) : '—',
        bottom: center.day != null && center.length ? ka.cycle.outOf(center.length) : null,
      };
    default:
      return { top: null, value: '—', bottom: null };
  }
}

// ---------- pieces ----------

/** Stroke, marker and radius of the static ring; `capDeg` keeps round caps of neighbouring arcs apart. */
function ringGeometry(size: number) {
  const stroke = size >= 120 ? 10 : 8;
  const marker = stroke * 0.8;
  const r = size / 2 - marker - 3;
  return { stroke, marker, r, capDeg: ((stroke / 2 + 1.5) / r) * (180 / Math.PI) };
}

function polar(cx: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cx + r * Math.sin(a) };
}

function arcPath(cx: number, r: number, from: number, to: number) {
  const end = Math.min(to, from + 359.9);
  const p0 = polar(cx, r, from);
  const p1 = polar(cx, r, end);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${end - from > 180 ? 1 : 0} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

/** Static ring: phase arcs (lived = full colour, ahead = faded), today's marker, one number inside. */
function HomeCycleRing({
  size,
  arcs = [],
  todayDeg = null,
  progress,
  progressColor,
  center,
}: {
  size: number;
  arcs?: RingArc[];
  todayDeg?: number | null;
  /** Single-arc mode (pregnancy weeks). */
  progress?: number;
  progressColor?: string;
  center: CenterText;
}) {
  const theme = useThemeColors();
  const c = useCycleColors();
  const { stroke, marker, r } = ringGeometry(size);
  const cx = size / 2;
  const phaseColor: Record<RingPhaseKind, string> = {
    period: c.period,
    follicular: c.follicularFill,
    fertile: c.fertileFill,
    luteal: c.luteal,
  };
  const today = todayDeg != null ? polar(cx, r, todayDeg) : null;
  const inner = (r - stroke / 2) * 2 * 0.86;
  const valueSize = Math.round(size * 0.26);

  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cx} r={r} stroke={c.gaugeTrack} strokeWidth={stroke} fill="none" />
        {arcs.map((arc) => (
          <React.Fragment key={arc.kind}>
            <Path
              d={arcPath(cx, r, arc.from, arc.to)}
              stroke={cycleHexAlpha(phaseColor[arc.kind], 0.3)}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
            />
            {arc.livedTo != null ? (
              <Path
                d={arcPath(cx, r, arc.from, arc.livedTo)}
                stroke={phaseColor[arc.kind]}
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
          </React.Fragment>
        ))}
        {progress != null && progress > 0 ? (
          <Path
            d={arcPath(cx, r, 0, Math.max(1, progress * 360))}
            stroke={progressColor ?? c.gaugeProgress}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
        {today ? (
          <Circle cx={today.x} cy={today.y} r={marker} fill={theme.surface} stroke={c.todayRing} strokeWidth={2.5} />
        ) : null}
      </Svg>
      <View pointerEvents="none" style={s.ringCenter}>
        {center.top ? (
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.ringCaption, { color: c.muted, maxWidth: inner }]}>
            {center.top}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            maxWidth: inner,
            color: center.tone === 'period' ? c.period : c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: valueSize,
            lineHeight: Math.round(valueSize * 1.18),
            letterSpacing: -0.5,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}
        >
          {center.value}
        </Text>
        {center.bottom ? (
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.ringCaption, { color: c.muted, maxWidth: inner }]}>
            {center.bottom}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StatusColumn({
  title,
  detail,
  badge = null,
  badgeCalm = false,
  note = null,
  offline = false,
}: {
  title: string;
  detail: string | null;
  badge?: string | null;
  badgeCalm?: boolean;
  note?: string | null;
  offline?: boolean;
}) {
  const theme = useThemeColors();
  const dark = useIsDark();
  const c = useCycleColors();
  return (
    <View style={s.column}>
      <Text numberOfLines={3} style={[s.title, { color: c.ink }]}>
        {title}
      </Text>
      {detail ? <Text style={[hubText.body, { color: theme.text200 }]}>{detail}</Text> : null}
      {note ? <Text style={[hubText.caption, { color: theme.text200 }]}>{note}</Text> : null}
      {badge ? (
        <View style={[s.badge, { borderColor: badgeCalm ? c.border : c.accentBorder }]}>
          <Text numberOfLines={2} style={[s.badgeText, { color: badgeCalm ? c.muted : dark ? c.brand : c.ctaPressed }]}>
            {badge}
          </Text>
        </View>
      ) : null}
      {offline ? <Text style={[hubText.small, { color: theme.text300 }]}>{ka.cycle.offlineBanner}</Text> : null}
    </View>
  );
}

function HeroButton({
  label,
  a11y,
  icon: Icon,
  filled = false,
  flex,
  disabled = false,
  onPress,
}: {
  label: string;
  a11y?: string;
  icon?: LucideIcon;
  filled?: boolean;
  flex?: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  const accent = useHomeAccent();
  const fg = filled ? accent.onCta : accent.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        { backgroundColor: filled ? accent.cta : accent.soft, opacity: disabled ? 0.6 : 1 },
        flex != null ? { flex } : null,
      ]}
    >
      {Icon ? <Icon size={17} color={fg} strokeWidth={2.2} /> : null}
      <Text numberOfLines={2} style={[s.buttonText, { color: fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function WeekStrip({ days, compact, bleedLabel }: { days: StripDay[]; compact: boolean; bleedLabel: string }) {
  const c = useCycleColors();
  const circle = compact ? 28 : 32;
  const outer = circle + 6;
  const a11y = days
    .map((d) =>
      [
        d.today ? ka.cycle.jumpToday : WEEKDAYS_KA[d.weekday],
        String(d.dayOfMonth),
        d.loggedPeriod ? bleedLabel : null,
        d.spotting ? ka.cycle.legendSpotting : null,
        d.predictedPeriod ? ka.cycle.legendPeriodPredicted : null,
        d.fertile ? ka.cycle.legendFertile : null,
        d.ovulation ? ka.cycle.legendOvulation : null,
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join(', ');

  return (
    <View accessible accessibilityLabel={a11y} style={s.strip}>
      {days.map((d) => {
        const marked = d.loggedPeriod || d.predictedPeriod || d.fertile || d.ovulation;
        const fill = d.loggedPeriod ? c.period : d.fertile || d.ovulation ? c.fertilitySoft : 'transparent';
        const ink = d.loggedPeriod ? c.onPeriod : d.predictedPeriod ? c.period : d.fertile || d.ovulation ? c.fertile : c.ink;
        const border = d.predictedPeriod
          ? { borderWidth: 1.5, borderColor: c.period, borderStyle: 'dashed' as const }
          : d.ovulation
            ? { borderWidth: 1.5, borderColor: c.fertile }
            : d.loggedPeriod || d.fertile
              ? { borderWidth: 0 }
              : d.today
                ? { borderWidth: 2, borderColor: c.todayRing }
                : { borderWidth: 1, borderColor: c.border };
        return (
          <View key={d.key} style={s.stripDay}>
            <Text
              style={[
                s.weekday,
                { color: d.today ? c.todayRing : c.muted, fontFamily: d.today ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium' },
              ]}
            >
              {WEEKDAYS_KA[d.weekday]}
            </Text>
            <View
              style={[
                s.stripRing,
                { width: outer, height: outer, borderRadius: outer / 2 },
                d.today && marked ? { borderWidth: 2, borderColor: c.todayRing } : null,
              ]}
            >
              <View style={[s.stripCircle, { width: circle, height: circle, borderRadius: circle / 2, backgroundColor: fill }, border]}>
                <Text style={[s.stripNumber, { color: ink }]}>{d.dayOfMonth}</Text>
              </View>
            </View>
            <View style={[s.spotDot, { backgroundColor: d.spotting ? c.period : 'transparent' }]} />
          </View>
        );
      })}
    </View>
  );
}

function HeroSkeleton({ ringSize, minHeight }: { ringSize: number; minHeight: number }) {
  const theme = useThemeColors();
  const bone = theme.bg200;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={ka.common.loading}
      style={[s.card, { backgroundColor: theme.surface, minHeight }]}
    >
      <View style={s.row}>
        <View style={{ width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 10, borderColor: bone }} />
        <View style={[s.column, { gap: 10 }]}>
          <View style={{ height: 16, width: '85%', borderRadius: 8, backgroundColor: bone }} />
          <View style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: bone }} />
          <View style={{ height: 22, width: '55%', borderRadius: 10, backgroundColor: bone }} />
        </View>
      </View>
      <View style={s.buttons}>
        <View style={{ flex: 1.7, height: 48, borderRadius: 16, backgroundColor: bone }} />
        <View style={{ flex: 1, height: 48, borderRadius: 16, backgroundColor: bone }} />
      </View>
      <View style={[s.strip, { height: STRIP_H }]}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={[s.stripDay, { justifyContent: 'flex-end', paddingBottom: 8 }]}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bone }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  column: { flex: 1, minWidth: 0, gap: 6 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  bigTile: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 23 },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, lineHeight: 16 },
  buttons: { flexDirection: 'row', gap: 10 },
  button: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  buttonText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 17, textAlign: 'center', flexShrink: 1 },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringCaption: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10, lineHeight: 13, textAlign: 'center' },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  stripDay: { flex: 1, maxWidth: 44, alignItems: 'center', gap: 4 },
  weekday: { fontSize: 10, lineHeight: 13 },
  stripRing: { alignItems: 'center', justifyContent: 'center' },
  stripCircle: { alignItems: 'center', justifyContent: 'center' },
  stripNumber: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, fontVariant: ['tabular-nums'] },
  spotDot: { width: 4, height: 4, borderRadius: 2, marginTop: -3 },
});
