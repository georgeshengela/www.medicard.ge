import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Baby, CalendarHeart, Check, Droplet, Flower2, Heart, Lock, Plus, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import type { MedicalSourceId } from '@/constants/medicalSources';
import { CyclePeriodToast } from '@/components/cycle/CyclePeriodToast';
import { CycleHeavyBleedingCard } from '@/components/cycle/CycleHeavyBleedingCard';
import { CycleQuickLogSheet } from '@/components/cycle/CycleQuickLogSheet';
import { CycleSexSheet } from '@/components/cycle/CycleSexSheet';
import { CycleExpectationLine } from '@/components/cycle/CycleExpectationLine';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleBundle } from '@/lib/api';
import type { CycleView } from '@/lib/cycleOffline';
import { cycleToday, phaseFromBundle, usedCycleLength } from '@/lib/cycleCanonical';
import { expectationLine, expectationsFromBundle } from '@/lib/cycleExpectations';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { showHeavyBleedingCard } from '@/lib/cycleHeavyBleeding';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { POSTPARTUM_OVULATION_NOTE } from '@/lib/cycleTone';
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
  cycleWeekStrip,
  daysBetweenKeys,
  fertileDaysInCycle,
  startLeads,
  weekdayIndex,
  type CycleCenter,
  type CycleHeroActionId,
  type StripDay,
} from '@/lib/home/homeCycle';
import { useThemeColors, useIsDark } from '@/theme/colors';
import { useCycleColors } from '@/theme/cycle';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import {
  registerHomeCycleToastHost,
  useHomeCycleActions,
  type HomeCycleToast as HomeCycleToastEntry,
  useHomeCycleToastEntry,
  useHomeCycleToastHosted,
} from './useHomeCycleActions';
import { LinearGradient } from 'expo-linear-gradient';

/** Shared cycle data from the Home root (`useCycleView` mounted once there). */
export type HomeCycleData = {
  view: CycleView | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
};

const STRIP_H = 13 + 4 + 38 + 5;

export type HomeCycleHeroProps = {
  cycle: HomeCycleData;
  /** Face ID / PIN cycle lock; `null` = not read yet → fixed-height placeholder, never cycle data. */
  locked: boolean | null;
  userId: string | null | undefined;
  /** Right under the header (22 pt instead of the section gap). */
  first?: boolean;
};


/**
 * „ციკლი დღეს“ — the women's Home hero in Flo's proven shape (owner 2026-10-03, after the real
 * Flo/Clue screens): the week strip on top, then one big answer on a soft glow in today's phase
 * colour („მენსტრუაციამდე · 3 დღე · სავარაუდოდ სამ, 6 ოქტ“), the phase under it, and the cycle
 * screen's one-tap actions: period start / end, the day's log and „♥ სექსი“. No ring here — the
 * dial lives on /cycle.
 * Every gate (lock, mode, forecast, fertility, contraception) mirrors `/cycle`. BBT and test marks
 * never appear here; sex is only the one-tap button (owner 2026-10-03), shown while the cycle is unlocked.
 */
export function HomeCycleHero({ cycle, locked, userId, first }: HomeCycleHeroProps) {
  const router = useRouter();
  const theme = useThemeColors();
  const c = useCycleColors();
  const accent = useHomeAccent();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const heroMinHeight = HUB.cardPad * 2 + STRIP_H + 16 + 150 + 12 + 60 + 16 + 50 + 10 + 46;

  const view = locked === false ? cycle.view : null;
  const bundle: CycleBundle | null = view?.display ?? null;
  const today = cycleToday(bundle, todayKey());
  const actions = useHomeCycleActions({ userId, today, view, retry: cycle.retry });
  const toastHosted = useHomeCycleToastHosted();
  const toastEntry = useHomeCycleToastEntry();
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
    body = <HeroSkeleton minHeight={heroMinHeight} />;
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
          style={s.stage}
        >
          <GlowAnswer tone={c.gaugeProgress} caption={ka.cycle.pregnancyModeTitle} value={age ? String(age.week) : '—'} unit={age ? ka.cycle.week : null} sub={due} />
          <StatusStack title={ka.cycle.pregnancyModeTitle} dot={c.gaugeProgress} detail={detail} offline={view?.reachable === false} />
        </Pressable>
        <View style={s.buttons}>
          <HeroButton label={ka.cycle.storyLogTitle} icon={Plus} filled flex={1.5} onPress={() => actions.openLog()} />
          <HeroButton label={tx('კვირის გზამკვლევი', "This week's guide")} flex={1} onPress={openWeek} />
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
        {!peri ? (
          // Brief §9 item 16: fertility can return before the first bleed — a plain fact, not advice.
          <Text style={[hubText.body, { color: theme.text100 }]}>{tx(POSTPARTUM_OVULATION_NOTE.ka, POSTPARTUM_OVULATION_NOTE.en)}</Text>
        ) : null}
        <HeroButton label={ka.cycle.storyLogTitle} icon={Plus} filled onPress={() => actions.openLog()} />
        {peri ? (
          <WeekTray
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
            onPress={openCycle}
          />
        ) : null}
      </View>
    );
  } else if (bundle && variant === 'cycle') {
    // The heavy-bleeding inset card has no link of its own on Home: ACOG joins the hero's one „წყაროები“.
    sourceIds = showHeavyBleedingCard(bundle.logs, today) ? ['menstrualCycle', 'heavyMenstrualBleeding'] : ['menstrualCycle'];
    body = (
      <ClassicCycleCard
        bundle={bundle}
        today={today}
        offline={view?.reachable === false}
        dayOne={actions.toastDate === today}
        busy={actions.busy}
        sexBusy={actions.sexBusy}
        onStart={actions.startPeriod}
        onEnd={actions.endPeriod}
        onLog={() => actions.openLog()}
        onSex={actions.logSex}
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
      {sourceIds ? <MedicalSourcesLink sourceIds={sourceIds} align="center" tint={theme.text200} /> : null}
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
      {userId && locked === false ? (
        <CycleSexSheet visible={actions.sexSheet} date={today} onClose={actions.closeSexSheet} onSaved={actions.onSheetSaved} />
      ) : null}
      {toastEntry && !toastHosted ? <HomeCycleToast entry={toastEntry} bottomInset={0} /> : null}
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
  return <HomeCycleToast entry={entry} bottomInset={inset} />;
}

/** „მენსტრუაცია დაფიქსირდა“ (flow / undo) or „სექსი აღირიცხა“ (details / undo) — the cycle screen's toasts. */
function HomeCycleToast({ entry, bottomInset }: { entry: HomeCycleToastEntry; bottomInset: number }) {
  if (entry.kind === 'sex') {
    return (
      <CyclePeriodToast
        bottomInset={bottomInset}
        title={ka.cycle.sexLoggedToast}
        hint={ka.cycle.sexLoggedToastHint}
        primaryLabel={ka.cycle.sexLoggedDetails}
        PrimaryIcon={Heart}
        onAddFlow={entry.onAddFlow}
        onUndo={entry.onUndo}
      />
    );
  }
  return <CyclePeriodToast bottomInset={bottomInset} title={entry.title} onAddFlow={entry.onAddFlow} onUndo={entry.onUndo} />;
}

// ---------- classic cycle card (TRACK_PERIOD / TRY_TO_CONCEIVE) ----------

function ClassicCycleCard({
  bundle,
  today,
  offline,
  dayOne,
  busy,
  sexBusy,
  onStart,
  onEnd,
  onLog,
  onSex,
  onOpen,
  error,
}: {
  bundle: CycleBundle;
  today: string;
  offline: boolean;
  dayOne: boolean;
  busy: boolean;
  sexBusy: boolean;
  onStart: () => void;
  onEnd: () => void;
  onLog: () => void;
  onSex: () => void;
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

  const center = cycleCenter({ hideLengthChrome, hidePredicted, onPeriod, predictedToday, forecastOn, inDays, day, cycleLength: cycleLen });
  const centerText = centerCopy(center, uncertainBleed);
  // Today's colour: bleeding wins; otherwise the phase the cycle screen names.
  const todayColor = onPeriod
    ? c.period
    : phase.phase === 'fertile' || phase.phase === 'ovulation'
      ? c.fertileFill
      : phase.phase === 'luteal'
        ? c.luteal
        : phase.phase === 'follicular'
          ? c.follicularFill
          : c.mutedSoft;

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
  // Dashed = an estimate (the calendar's grammar): the expected start with its weekday.
  const badge = forecastOn && next && !onPeriod
    ? late
      ? { text: ka.cycle.lateCalmTitle, calm: true }
      : inDays != null && inDays > 0
        ? { text: `${ka.cycle.heroLikely} · ${WEEKDAYS_KA[weekdayIndex(next)]}, ${formatYmd(next)}`, calm: false }
        : null
    : null;

  const leads = startLeads({ onPeriod, forecastOn, predictedToday, inDays });
  const isDayOne = dayOne || bundle.profile.lastPeriodStart === today || (onPeriod && phase.day === 1);
  const plan = cycleHeroActions({ onPeriod, dayOne: isDayOne, leadsWithStart: leads });
  const startLabel = uncertainBleed ? ka.cycle.heroBleedingStarted : ka.cycle.heroPeriodStarted;
  const sexLogged = todayLog?.sexualActivity === true;
  // Her own pattern, read on the device (brief §9 item 11): one quiet „სავარაუდოა“ line, never a diagnosis.
  const expectation = hideLengthChrome ? null : expectationLine(expectationsFromBundle(bundle, today), todayLog);
  const button = (id: CycleHeroActionId, filled: boolean) => {
    const common = { filled, disabled: busy, flex: filled ? undefined : 1 } as const;
    if (id === 'start') return <HeroButton key={id} {...common} label={startLabel} icon={Droplet} onPress={onStart} />;
    if (id === 'end') return <HeroButton key={id} {...common} label={ka.cycle.periodEndCta} icon={filled ? Check : undefined} onPress={onEnd} />;
    if (id === 'logFlow') return <HeroButton key={id} {...common} label={ka.cycle.logTodayFlow} icon={Droplet} onPress={onLog} />;
    return <HeroButton key={id} {...common} label={ka.cycle.logTodayCta} icon={Plus} onPress={onLog} />;
  };

  const summary = [
    title,
    detail,
    [centerText.top, centerText.value, centerText.bottom].filter(Boolean).join(' '),
    badge?.text,
    caps.showTtcOverview ? ka.cycle.homeTtcLabel : null,
    expectation,
    offline ? ka.cycle.offlineBanner : null,
  ]
    .filter(Boolean)
    .join('. ');

  const strip = cycleWeekStrip({
    today,
    calendar: bundle.predictions?.calendar,
    bleedLogs: bundle.logs,
    showFertility: fertilityVisible,
    showOvulation: showOvulationUi(bundle),
    showPredicted: caps.showFertileEstimates && !hidePredicted,
  });
  // The big answer: countdown → „3 დღე“ with the date under it; otherwise the centre copy as is.
  const unit = center.kind === 'countdown' ? tx('დღე', center.days === 1 ? 'day' : 'days') : null;
  const sub =
    center.kind === 'countdown'
      ? badge && !badge.calm && next
        ? `${ka.cycle.heroLikely} · ${WEEKDAYS_KA[weekdayIndex(next)]}, ${formatYmd(next)}`
        : ka.cycle.heroLikely
      : centerText.bottom;

  return (
    <View style={[s.card, { backgroundColor: theme.surface }]}>
      <WeekTray days={strip} compact={false} bleedLabel={cycleLoggedBleedLabel(bundle.profile.mode, ka.cycle)} onPress={onOpen} />
      <Pressable accessibilityRole="button" accessibilityLabel={summary} onPress={onOpen} style={s.stage}>
        <GlowAnswer tone={todayColor} caption={centerText.top} value={centerText.value} unit={unit} sub={sub} valueTone={centerText.tone === 'period' ? c.period : c.ink} />
        <StatusStack
          title={title}
          dot={todayColor}
          detail={detail}
          badge={badge?.calm ? badge.text : null}
          badgeCalm
          note={caps.showTtcOverview ? ka.cycle.homeTtcLabel : null}
          offline={offline}
        />
        {expectation ? (
          <View style={s.expectation}>
            <CycleExpectationLine text={expectation} color={theme.text200} />
          </View>
        ) : null}
      </Pressable>
      {/* The cycle screen's pattern: the leading action full width, then the other one beside „♥ სექსი“. */}
      <View style={s.actions}>
        {button(plan.primary, true)}
        <View style={s.buttons}>
          {plan.secondary ? button(plan.secondary, false) : null}
          <SexButton logged={sexLogged} disabled={sexBusy} wide={!plan.secondary} onPress={onSex} />
        </View>
      </View>
      {/* Brief §9 item 15: calm card below the actions only while the current bleeding run is heavy (≥ 3 heavy days) or long (> 7 days). */}
      {showHeavyBleedingCard(bundle.logs, today) ? <CycleHeavyBleedingCard variant="inset" showSources={false} /> : null}
      {error ? (
        <Text accessibilityRole="alert" style={[hubText.caption, { color: theme.danger, marginTop: -6 }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type CenterText = { top: string | null; value: string; bottom: string | null; tone?: 'period' };

/** „6 ოქტომბერი“ → „6 ოქტ“ (the disc has little room). */
function shortDate(ymd: string): string {
  const [day, ...month] = formatYmd(ymd).split(' ');
  return `${day} ${month.join(' ').slice(0, 3)}`;
}

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
      // The same words as the cycle screen's dial: „მენსტრუაციამდე · 3 · დღე · სავარაუდოდ“.
      return {
        top: uncertainBleed ? ka.cycle.heroUntilBleeding : ka.cycle.heroUntilPeriod,
        value: String(center.days),
        bottom: ka.cycle.heroDaysEstimated,
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

/** Flo's hero: a soft glow in today's colour, one caption, one big number with its word, one line under it. */
function GlowAnswer({
  tone,
  caption,
  value,
  unit,
  sub,
  valueTone,
}: {
  tone: string;
  caption: string | null;
  value: string;
  unit: string | null;
  sub: string | null;
  valueTone?: string;
}) {
  const theme = useThemeColors();
  const dark = useIsDark();
  const c = useCycleColors();
  const big = value.length > 2 ? 40 : 60;
  return (
    <View style={s.glowWrap}>
      <LinearGradient
        pointerEvents="none"
        colors={[`${tone}${dark ? '3D' : '2E'}`, `${tone}${dark ? '14' : '0A'}`, `${theme.surface}00`]}
        locations={[0, 0.6, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={s.glow}
      />
      {caption ? <Text style={[s.glowCaption, { color: c.muted }]}>{caption}</Text> : null}
      <View style={s.glowValueRow}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[s.glowValue, { color: valueTone ?? c.ink, fontSize: big, lineHeight: Math.round(big * 1.12) }]}
        >
          {value}
        </Text>
        {unit ? <Text style={[s.glowUnit, { color: valueTone ?? c.ink }]}>{unit}</Text> : null}
      </View>
      {sub ? (
        <Text numberOfLines={2} style={[s.glowSub, { color: c.muted }]}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Under the answer, centred: the phase in a pill with today's colour, the day line, the estimate badge. */
function StatusStack({
  title,
  dot,
  detail,
  badge = null,
  badgeCalm = false,
  note = null,
  offline = false,
}: {
  title: string;
  dot: string;
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
    <View style={s.stack}>
      <View style={[s.phasePill, { backgroundColor: c.cardSoft }]}>
        <View style={[s.phaseDot, { backgroundColor: dot }]} />
        <Text numberOfLines={2} style={[s.phaseText, { color: c.ink }]}>
          {title}
        </Text>
      </View>
      {detail ? <Text style={[hubText.body, { color: theme.text200, textAlign: 'center' }]}>{detail}</Text> : null}
      {note ? <Text style={[hubText.caption, { color: theme.text200, textAlign: 'center' }]}>{note}</Text> : null}
      {badge ? (
        <View style={[s.badge, { borderColor: badgeCalm ? c.controlBorder : c.accentBorder }]}>
          <Text numberOfLines={2} style={[s.badgeText, { color: badgeCalm ? c.muted : dark ? c.brand : c.ctaPressed }]}>
            {badge}
          </Text>
        </View>
      ) : null}
      {offline ? <Text style={[hubText.small, { color: theme.text300, textAlign: 'center' }]}>{ka.cycle.offlineBanner}</Text> : null}
    </View>
  );
}

/** Left-aligned status beside an icon tile (postpartum, perimenopause). */
function StatusColumn({ title, detail, offline = false }: { title: string; detail: string | null; offline?: boolean }) {
  const theme = useThemeColors();
  const c = useCycleColors();
  return (
    <View style={s.column}>
      <Text numberOfLines={3} style={[s.title, { color: c.ink }]}>
        {title}
      </Text>
      {detail ? <Text style={[hubText.body, { color: theme.text200 }]}>{detail}</Text> : null}
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
  const c = useCycleColors();
  const fg = filled ? accent.onCta : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        filled ? s.button : s.buttonTonal,
        { backgroundColor: filled ? accent.cta : c.cardSoft, opacity: disabled ? 0.6 : 1 },
        flex != null ? { flex } : null,
      ]}
    >
      {Icon ? <Icon size={17} color={fg} strokeWidth={2.2} /> : null}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[s.buttonText, filled ? null : s.buttonTextTonal, { color: fg }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** „♥ სექსი“ — one tap logs it for today; logged, it shows a tick and opens the private details sheet. */
function SexButton({ logged, disabled, wide, onPress }: { logged: boolean; disabled: boolean; wide: boolean; onPress: () => void }) {
  const c = useCycleColors();
  const fg = logged ? c.onPeriod : c.period;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={logged ? ka.cycle.sexLoggedA11y : ka.cycle.sexLogA11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.buttonTonal,
        { backgroundColor: logged ? c.period : c.periodSoft, opacity: disabled ? 0.6 : 1, paddingHorizontal: 16 },
        wide ? { flex: 1 } : null,
      ]}
    >
      {logged ? <Check size={15} color={fg} strokeWidth={3} /> : <Heart size={16} color={fg} strokeWidth={2.4} fill={fg} />}
      <Text numberOfLines={1} style={[s.buttonText, s.buttonTextTonal, { color: fg }]}>
        {ka.cycle.sexShort}
      </Text>
    </Pressable>
  );
}

type LegendKind = 'logged' | 'predicted' | 'fertile' | 'ovulation';

/**
 * The week in a soft tray: −3…+3 days, marks in the cycle grammar and — because a mark must explain
 * itself — one legend line for exactly the marks this week shows. Tapping opens the calendar.
 */
function WeekTray({
  days,
  compact,
  bleedLabel,
  onPress,
}: {
  days: StripDay[];
  compact: boolean;
  bleedLabel: string;
  onPress: () => void;
}) {
  const c = useCycleColors();
  const circle = compact ? 30 : 34;
  const outer = circle + 6;
  const legend: { kind: LegendKind; label: string }[] = [];
  if (days.some((d) => d.loggedPeriod)) legend.push({ kind: 'logged', label: bleedLabel });
  if (days.some((d) => d.predictedPeriod)) legend.push({ kind: 'predicted', label: ka.cycle.legendPeriodPredicted });
  if (days.some((d) => d.fertile && !d.ovulation)) legend.push({ kind: 'fertile', label: ka.cycle.legendFertile });
  if (days.some((d) => d.ovulation)) legend.push({ kind: 'ovulation', label: ka.cycle.legendOvulation });
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
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={[s.tray, { backgroundColor: c.cardSoft }]}>
      <View style={s.strip}>
        {days.map((d) => {
          const marked = d.loggedPeriod || d.predictedPeriod || d.fertile || d.ovulation;
          const fill = d.loggedPeriod ? c.period : d.fertile || d.ovulation ? c.fertilitySoft : d.today ? c.card : 'transparent';
          const ink = d.loggedPeriod ? c.onPeriod : d.predictedPeriod ? c.period : d.fertile || d.ovulation ? c.fertile : d.today ? c.ink : c.muted;
          const border = d.predictedPeriod
            ? { borderWidth: 1.5, borderColor: c.period, borderStyle: 'dashed' as const }
            : d.ovulation
              ? { borderWidth: 1.5, borderColor: c.fertile }
              : d.today && !marked
                ? { borderWidth: 2, borderColor: c.todayRing }
                : { borderWidth: 0 };
          return (
            <View key={d.key} style={s.stripDay}>
              <Text
                numberOfLines={1}
                style={[
                  s.weekday,
                  { color: d.today ? c.ink : c.mutedSoft, fontFamily: d.today ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium' },
                ]}
              >
                {d.today ? ka.cycle.jumpToday : WEEKDAYS_KA[d.weekday]}
              </Text>
              <View
                style={[
                  s.stripRing,
                  { width: outer, height: outer, borderRadius: outer / 2 },
                  d.today && marked ? { borderWidth: 2, borderColor: c.todayRing } : null,
                ]}
              >
                <View style={[s.stripCircle, { width: circle, height: circle, borderRadius: circle / 2, backgroundColor: fill }, border]}>
                  <Text
                    style={[
                      s.stripNumber,
                      { color: ink, fontFamily: d.today || marked ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium' },
                    ]}
                  >
                    {d.dayOfMonth}
                  </Text>
                </View>
              </View>
              <View style={[s.spotDot, { backgroundColor: d.spotting ? c.period : 'transparent' }]} />
            </View>
          );
        })}
      </View>
      {legend.length ? (
        <View style={s.legend}>
          {legend.map((item) => (
            <View key={item.kind} style={s.legendItem}>
              <View
                style={[
                  s.legendMark,
                  item.kind === 'logged'
                    ? { backgroundColor: c.period }
                    : item.kind === 'predicted'
                      ? { borderWidth: 1.5, borderColor: c.period, borderStyle: 'dashed' }
                      : item.kind === 'fertile'
                        ? { backgroundColor: c.fertileFill }
                        : { backgroundColor: c.fertilitySoft, borderWidth: 1.5, borderColor: c.fertile },
                ]}
              />
              <Text numberOfLines={1} style={[s.legendText, { color: c.muted }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function HeroSkeleton({ minHeight }: { minHeight: number }) {
  const theme = useThemeColors();
  const bone = theme.bg200;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={ka.common.loading}
      style={[s.card, { backgroundColor: theme.surface, minHeight }]}
    >
      <View style={{ height: STRIP_H + 24, borderRadius: 18, backgroundColor: bone }} />
      <View style={[s.stage, { gap: 12 }]}>
        <View style={{ height: 14, width: 120, borderRadius: 7, backgroundColor: bone, marginTop: 14 }} />
        <View style={{ height: 56, width: 150, borderRadius: 16, backgroundColor: bone }} />
        <View style={{ height: 12, width: 170, borderRadius: 6, backgroundColor: bone }} />
        <View style={{ height: 30, width: 200, borderRadius: 15, backgroundColor: bone, marginTop: 8 }} />
      </View>
      <View style={s.actions}>
        <View style={{ height: 50, borderRadius: 25, backgroundColor: bone }} />
        <View style={s.buttons}>
          <View style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: bone }} />
          <View style={{ width: 104, height: 46, borderRadius: 23, backgroundColor: bone }} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 16 },
  stage: { alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  glowWrap: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 22, paddingBottom: 8, gap: 2, overflow: 'hidden', borderRadius: 18 },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 200 },
  glowCaption: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20 },
  glowValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  glowValue: { fontFamily: 'NotoSansGeorgian_700Bold', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  glowUnit: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 24, lineHeight: 30 },
  glowSub: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 280 },
  stack: { alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  expectation: { alignSelf: 'stretch', marginTop: 10, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  column: { flex: 1, minWidth: 0, gap: 6 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  bigTile: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 23 },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  phaseDot: { width: 9, height: 9, borderRadius: 5 },
  phaseText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, flexShrink: 1, textAlign: 'center' },
  badge: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
  badgeText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  actions: { gap: 10 },
  buttons: { flexDirection: 'row', gap: 10 },
  buttonTonal: {
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  button: {
    minHeight: 50,
    borderRadius: 25,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 19, textAlign: 'center', flexShrink: 1 },
  buttonTextTonal: { fontSize: 13, lineHeight: 18 },
  tray: { borderRadius: 18, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 12, gap: 8 },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  stripDay: { flex: 1, maxWidth: 46, alignItems: 'center', gap: 4 },
  weekday: { fontSize: 10, lineHeight: 13 },
  stripRing: { alignItems: 'center', justifyContent: 'center' },
  stripCircle: { alignItems: 'center', justifyContent: 'center' },
  stripNumber: { fontSize: 13, fontVariant: ['tabular-nums'] },
  spotDot: { width: 4, height: 4, borderRadius: 2, marginTop: -3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendMark: { width: 11, height: 11, borderRadius: 6 },
  legendText: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 16 },
});
