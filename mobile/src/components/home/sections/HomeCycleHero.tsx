import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Baby, CalendarHeart, Check, Droplet, Flower2, Heart, Lock, PencilLine, Plus, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import type { MedicalSourceId } from '@/constants/medicalSources';
import { CyclePeriodToast } from '@/components/cycle/CyclePeriodToast';
import { CycleHeavyBleedingCard } from '@/components/cycle/CycleHeavyBleedingCard';
import { CycleStillBleedingRow } from '@/components/cycle/CycleStillBleedingRow';
import { CycleQuickLogSheet } from '@/components/cycle/CycleQuickLogSheet';
import { CycleSexSheet } from '@/components/cycle/CycleSexSheet';
import { CycleExpectationLine } from '@/components/cycle/CycleExpectationLine';
import { CyclePhaseLegend } from '@/components/cycle/CyclePhaseLegend';
import type { CycleLegendKey } from '@/lib/cycleLegendItems';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleBundle } from '@/lib/api';
import type { CycleView } from '@/lib/cycleOffline';
import { cycleToday, phaseFromBundle, usedCycleLength } from '@/lib/cycleCanonical';
import { expectationLine, expectationsFromBundle } from '@/lib/cycleExpectations';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { showHeavyBleedingCard } from '@/lib/cycleHeavyBleeding';
import { heroPeriodState, heroPlanWhileAsking } from '@/lib/cyclePeriodStatus';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { POSTPARTUM_OVULATION_NOTE } from '@/lib/cycleTone';
import { bleedingIsUncertain, showFertilityUi, showOvulationUi } from '@/lib/cycleContraception';
import { forecastPresentationAllowed, suppressCycleLengthChrome } from '@/lib/cycleForecastEligibility';
import { cycleBundleCapabilities } from '@/lib/cycleModes';
import { trackingCopy } from '@/lib/cycleTrackingCopy';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { cycleLoggedBleedLabel } from '@/lib/cycleHistoryCopy';
import { needsCycleOnboarding } from '@/lib/cycleExperience';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { formatYmd } from '@/lib/format';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import {
  cycleCenter,
  cycleHeroActions,
  cycleHeroVariant,
  cyclePeriodWindow,
  cycleSpreadModel,
  cycleWeekStrip,
  daysBetweenKeys,
  fertileDaysInCycle,
  pastEstimateBadge,
  recordedPeriodDaysInCycle,
  addDaysKey,
  startLeads,
  trackingHeroActions,
  weekdayIndex,
  type CycleHeroActionId,
  type StripDay,
} from '@/lib/home/homeCycle';
import { CYCLES_VARY_NOTE, cycleCenterText, windowOpenTail } from '@/lib/cycleCenterCopy';
import { periodWindowLine } from '@/lib/cycleForecastCopy';
import { periForecastView, periNextPeriodLabel } from '@/lib/cyclePerimenopauseForecast';
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
import { cycleWaveModel } from '@/lib/home/cycleWave';
import { CycleWaveLoader, CycleWaveStage, type WaveAnswer, type WaveLeaf } from './CycleWaveStage';

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
    tracking: Boolean(bundle) && cycleBundleCapabilities(bundle).showTrackingOverview,
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
    // Perimenopause (W3-4): the next period only as a window (or the honest / calm line), then the last bleed.
    const periView = peri ? periForecastView({ forecast: bundle.perimenopause?.forecast, predictions: bundle.predictions, today }) : null;
    const periForecast = periView
      ? `${periNextPeriodLabel()}: ${periView.short}`
      : null;
    const detail = peri
      ? `${periForecast}\n${lastBleed ? ka.cycle.periLastBleeding(formatCycleDateKa(lastBleed)) : ka.cycle.periNoBleeding}`
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
  } else if (bundle && variant === 'tracking') {
    sourceIds = ['menstrualCycle'];
    body = (
      <TrackingCard
        bundle={bundle}
        today={today}
        offline={view?.reachable === false}
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
        onStillBleeding={actions.stillBleeding}
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
      {variant !== 'cycle' && variant !== 'tracking' && actions.error ? (
        <Text accessibilityRole="alert" style={[hubText.caption, { color: theme.danger, marginTop: 6 }]}>
          {actions.error}
        </Text>
      ) : null}
      {actions.sheet.visible && userId && locked === false ? (
        <CycleQuickLogSheet
          visible
          date={actions.sheet.date}
          isPeriodStart={actions.sheet.periodStart}
          funnelSource="home"
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

/** „მენსტრუაცია დაფიქსირდა“ (flow / undo), „მენსტრუაცია დასრულდა“ (log / undo) or „სექსი აღირიცხა“ (details / undo) — the cycle screen's toasts. */
function HomeCycleToast({ entry, bottomInset }: { entry: HomeCycleToastEntry; bottomInset: number }) {
  if (entry.kind === 'periodEnd') {
    return (
      <CyclePeriodToast
        bottomInset={bottomInset}
        title={ka.cycle.periodEndedToast}
        hint={entry.hint ?? ka.cycle.periodEndedToastHint}
        primaryLabel={ka.cycle.logTodayCta}
        PrimaryIcon={PencilLine}
        onAddFlow={entry.onAddFlow}
        onUndo={entry.onUndo}
      />
    );
  }
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
  onStillBleeding,
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
  onStillBleeding: () => void;
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
  const uncertainBleed = bleedingIsUncertain(bundle);
  const hideLengthChrome = suppressCycleLengthChrome(bundle);
  const hidePredicted = !forecastPresentationAllowed(bundle);
  // Period auto-end (brief §9 wave 2 item 3): an open period stays a period day until its usual length,
  // the day after it asks „ჯერ კიდევ გაქვს?“ once, then the hero is back to normal (no nagging).
  const periodState = heroPeriodState({
    status: bundle.periodStatus,
    statusToday: bundle.meta?.today,
    today,
    todayFlow: todayLog?.flow,
    enabled: caps.showClassicCycleOverview && !hideLengthChrome && !hidePredicted && !uncertainBleed,
  });
  const onPeriod = periodState.onPeriod;
  const fertilityVisible = showFertilityUi(bundle);
  const next = bundle.predictions?.nextPeriodStart ?? null;
  const predictedToday = Boolean(bundle.predictions?.calendar?.[today]?.period && bundle.predictions.calendar[today].predicted);
  const forecastOn = Boolean(next) && caps.showNextPeriodForecast && !hidePredicted;
  const inDays = next ? daysBetweenKeys(today, next) : null;
  const day = hideLengthChrome ? null : phase.day;

  // Variable cycles (brief §9 item 12): the server's window (`nextPeriodRange`), else one widened from her last cycles.
  const spread = cycleSpreadModel({
    isIrregular: bundle.profile.isIrregular,
    usedCycleLength: cycleLen,
    cycleLengths: bundle.trends?.cycleLengths,
    nextPeriodStart: next,
    serverRange: bundle.predictions?.nextPeriodRange ?? null,
  });
  const center = cycleCenter({ hideLengthChrome, hidePredicted, onPeriod, predictedToday, forecastOn, inDays, day, cycleLength: cycleLen, spread });
  // The dates under a window are always the server's whole range (never from the single estimate).
  const periodWindow = cyclePeriodWindow({ today, nextPeriodStart: next, spread });
  const centerText = cycleCenterText(center, uncertainBleed);
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
      ? displayPhaseLabel(onPeriod ? 'period' : phase.phase, phase.phaseKa, { loggedPeriod: periodState.loggedToday })
      : ka.cycle.statusLearning;
  const detail = hideLengthChrome
    ? ka.cycle.postpartumReturnLearning
    : phase.day != null
      ? phase.day > length
        ? ka.cycle.heroUsualLength(length)
        : ka.cycle.heroCycleDayOf(phase.day, length)
      : null;
  // Past the estimate — a variable cycle only after its whole window (the centre model already knows when).
  const late = forecastOn && caps.showLatePeriod && (spread ? center.kind === 'late' : inDays != null && inDays < 0);
  // „ბოლო პატერნზე გვიანია“ only with the server's late verdict (the /cycle banner's rule); a forecast from
  // defaults or < 2 logged cycles says „ჯერ ვსწავლობთ შენს რიტმს“ (CYC-07).
  const lateBadge = late
    ? pastEstimateBadge({ alerts: bundle.alerts, showLatePeriod: caps.showLatePeriod, averages: bundle.averages })
    : null;
  // Dashed = an estimate (the calendar's grammar): the expected start with its weekday.
  const badge = forecastOn && next && !onPeriod
    ? late
      ? lateBadge === 'late'
        ? { text: ka.cycle.lateCalmTitle, calm: true }
        : lateBadge === 'learning'
          ? { text: ka.cycle.confidenceLowShort, calm: true }
          : null
      : inDays != null && inDays > 0
        ? { text: `${ka.cycle.heroLikely} · ${WEEKDAYS_KA[weekdayIndex(next)]}, ${formatYmd(next)}`, calm: false }
        : null
    : null;

  const leads = startLeads({ onPeriod, forecastOn, predictedToday, inDays });
  const isDayOne = dayOne || bundle.profile.lastPeriodStart === today || (onPeriod && phase.day === 1);
  const plan = heroPlanWhileAsking(cycleHeroActions({ onPeriod, dayOne: isDayOne, leadsWithStart: leads }), periodState.askStill);
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
  // „ციკლის ტალღა“ (owner 2026-10-03): the whole cycle as one wave whenever the day is known.
  const cycleStart = day != null && day > 0 ? addDaysKey(today, -(day - 1)) : null;
  const wave = cycleWaveModel({
    day,
    cycleLength: cycleLen,
    periodLength: bundle.averages?.usedPeriodLength ?? bundle.profile?.avgPeriodLength ?? 5,
    recordedPeriodDays: recordedPeriodDaysInCycle({
      today,
      day,
      cycleLength: length,
      bleedDates: bundle.logs.filter((l) => isBleedFlow(l.flow)).map((l) => l.date),
    }),
    fertileDays: fertileDaysInCycle({
      today,
      day,
      cycleLength: length,
      window: fertilityVisible && !hidePredicted ? bundle.predictions?.fertileWindow : null,
    }),
    nextInDays: forecastOn && !late ? inDays : null,
    window:
      forecastOn && !late && periodWindow
        ? { from: daysBetweenKeys(today, periodWindow.from), to: daysBetweenKeys(today, periodWindow.to) }
        : null,
  });
  // The big answer: countdown → „3 დღე“ with the date under it; a variable cycle → „3–7 დღე“ with the
  // date range (never one date); otherwise the centre copy as is.
  const unit =
    center.kind === 'countdown'
      ? tx('დღე', center.days === 1 ? 'day' : 'days')
      : center.kind === 'countdownRange'
        ? tx('დღე', 'days')
        : null;
  const sub =
    center.kind === 'countdown'
      ? badge && !badge.calm && next
        ? `${ka.cycle.heroLikely} · ${WEEKDAYS_KA[weekdayIndex(next)]}, ${formatYmd(next)}`
        : ka.cycle.heroLikely
      : center.kind === 'countdownRange' && periodWindow
        ? `${ka.cycle.heroLikely} · ${shortDate(periodWindow.from)} – ${shortDate(periodWindow.to)} · ${CYCLES_VARY_NOTE()}`
        : center.kind === 'windowOpen' && periodWindow
          ? // Open: „ან მომდევნო N დღეში“, then „სავარაუდო · 30 სექ – 9 ოქტ“ — the whole window, from its first day.
            center.to > 0
            ? `${windowOpenTail(center.to)}\n${periodWindowLine(periodWindow.from, periodWindow.to)}`
            : periodWindowLine(periodWindow.from, periodWindow.to)
          : centerText.bottom;

  // The leaf carries the date, so the line under the number keeps only the estimate word.
  const leaf: WaveLeaf | null =
    center.kind === 'countdown' && next
      ? { kind: 'day', weekday: WEEKDAYS_KA[weekdayIndex(next)], day: Number(next.slice(8, 10)), month: shortDate(next).split(' ').slice(1).join(' ') }
      : center.kind === 'countdownRange' && periodWindow
        ? { kind: 'range', from: shortDate(periodWindow.from), to: shortDate(periodWindow.to) }
        : null;
  const waveAnswer: WaveAnswer = {
    top: centerText.top,
    value: centerText.value,
    unit,
    sub: center.kind === 'countdown' ? ka.cycle.heroLikely : center.kind === 'countdownRange' ? `${ka.cycle.heroLikely} · ${CYCLES_VARY_NOTE()}` : sub,
    tone: centerText.tone,
  };
  /** Finger on the wave → that day's date, cycle day and (logged or estimated) phase — the dial's words. */
  const describeDay = (d: number): WaveAnswer | null => {
    if (!cycleStart) return null;
    const date = addDaysKey(cycleStart, d - 1);
    const [, mm, dd] = date.split('-').map(Number);
    const mark = bundle.predictions?.calendar?.[date];
    const logged = bundle.logs.some((l) => l.date === date && isBleedFlow(l.flow));
    const phaseText = logged
      ? ka.cycle.dialLoggedPeriod
      : !hidePredicted && mark?.phaseKa && mark.phase !== 'unknown'
        ? ka.cycle.dialEstimated(mark.phaseKa)
        : null;
    return {
      top: `${date === today ? ka.cycle.heroToday : `${dd} ${MONTHS_KA[mm - 1]}`} · ${ka.cycle.cycleDay}`,
      value: String(d),
      unit: null,
      sub: phaseText,
      tone: logged ? 'period' : 'ink',
    };
  };

  return (
    <View style={s.open}>
      <WeekTray days={strip} compact={false} bleedLabel={cycleLoggedBleedLabel(bundle.profile.mode, ka.cycle)} onPress={onOpen} />
      {/* The wave owns its touches (finger preview), so it sits outside the card's open-the-calendar press. */}
      {wave ? (
        <CycleWaveStage model={wave} tone={todayColor} answer={waveAnswer} leaf={leaf} title={title} detail={detail} describeDay={describeDay} a11yLabel={summary} onOpen={onOpen} />
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={summary} onPress={onOpen} style={[s.stage, wave ? { marginTop: -6 } : null]}>
        {wave ? null : (
          <GlowAnswer tone={todayColor} caption={centerText.top} value={centerText.value} unit={unit} sub={sub} valueTone={centerText.tone === 'period' ? c.period : c.ink} />
        )}
        <StatusStack
          title={title}
          dot={todayColor}
          detail={detail}
          pill={!wave}
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
      {periodState.askStill ? <CycleStillBleedingRow onYes={onStillBleeding} onEnded={onEnd} disabled={busy} /> : null}
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

// ---------- Tracking card (TRACK_PERIOD + „მენსტრუაციას არ ველი“, brief §9 wave 2 item 17) ----------

/**
 * Nothing estimated: the week tray with logged bleeding only, today's date on the glow, „როგორ ხარ
 * დღეს?“, the day's log first, then „ახალი ციკლის დაწყება“ (or ending a logged bleed) beside „♥ სექსი“.
 */
function TrackingCard({
  bundle,
  today,
  offline,
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
  const todayLog = bundle.logs.find((l) => l.date === today);
  const plan = trackingHeroActions({ bleedingToday: isBleedFlow(todayLog?.flow) });
  const [, mm, dd] = today.split('-').map(Number);
  const title = trackingCopy.title();
  const tone = isBleedFlow(todayLog?.flow) ? c.period : c.mutedSoft;
  const strip = cycleWeekStrip({
    today,
    calendar: bundle.predictions?.calendar,
    bleedLogs: bundle.logs,
    showFertility: false,
    showOvulation: false,
    showPredicted: false,
  });
  const summary = [title, `${trackingCopy.today()} ${dd} ${MONTHS_KA[mm - 1] ?? ''}`, trackingCopy.howAreYou(), offline ? ka.cycle.offlineBanner : null]
    .filter(Boolean)
    .join('. ');
  return (
    <View style={s.open}>
      <WeekTray days={strip} compact={false} bleedLabel={cycleLoggedBleedLabel(bundle.profile.mode, ka.cycle)} onPress={onOpen} />
      <Pressable accessibilityRole="button" accessibilityLabel={summary} onPress={onOpen} style={s.stage}>
        <GlowAnswer tone={tone} caption={trackingCopy.today()} value={String(dd)} unit={MONTHS_KA[mm - 1] ?? null} sub={trackingCopy.howAreYou()} />
        <StatusStack title={title} dot={tone} detail={trackingCopy.detail()} offline={offline} />
      </Pressable>
      <View style={s.actions}>
        <HeroButton label={ka.cycle.logTodayCta} icon={Plus} filled disabled={busy} onPress={onLog} />
        <View style={s.buttons}>
          {plan.secondary === 'end' ? (
            <HeroButton label={trackingCopy.endBleed()} flex={1} disabled={busy} onPress={onEnd} />
          ) : (
            <HeroButton label={trackingCopy.newCycleShort()} a11y={trackingCopy.newCycle()} icon={Droplet} flex={1} disabled={busy} onPress={onStart} />
          )}
          <SexButton logged={todayLog?.sexualActivity === true} disabled={sexBusy} wide={false} onPress={onSex} />
        </View>
      </View>
      {showHeavyBleedingCard(bundle.logs, today) ? <CycleHeavyBleedingCard variant="inset" showSources={false} /> : null}
      {error ? (
        <Text accessibilityRole="alert" style={[hubText.caption, { color: theme.danger, marginTop: -6 }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** „6 ოქტომბერი“ → „6 ოქტ“ (the disc has little room). */
function shortDate(ymd: string): string {
  const [day, ...month] = formatYmd(ymd).split(' ');
  return `${day} ${month.join(' ').slice(0, 3)}`;
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
  pill = true,
  badge = null,
  badgeCalm = false,
  note = null,
  offline = false,
}: {
  title: string;
  dot: string;
  detail: string | null;
  /** False when the wave stage already shows the phase and the day line. */
  pill?: boolean;
  badge?: string | null;
  badgeCalm?: boolean;
  note?: string | null;
  offline?: boolean;
}) {
  const theme = useThemeColors();
  const dark = useIsDark();
  const c = useCycleColors();
  if (!pill && !note && !badge && !offline) return null;
  return (
    <View style={s.stack}>
      {pill ? (
        <View style={[s.phasePill, { backgroundColor: c.cardSoft }]}>
          <View style={[s.phaseDot, { backgroundColor: dot }]} />
          <Text numberOfLines={2} style={[s.phaseText, { color: c.ink }]}>
            {title}
          </Text>
        </View>
      ) : null}
      {pill && detail ? <Text style={[hubText.body, { color: theme.text200, textAlign: 'center' }]}>{detail}</Text> : null}
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

/**
 * The week in a soft tray: −3…+3 days, marks in the cycle grammar and — because a mark must explain
 * itself — one legend line for exactly the marks this week shows (the shared `CyclePhaseLegend`, so
 * the tray and the calendar read the same way). Tapping opens the calendar.
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
  // Only the marks this week draws — never sex or symptoms (Home shows neither).
  const legendKeys: CycleLegendKey[] = [];
  if (days.some((d) => d.loggedPeriod)) legendKeys.push('logged');
  if (days.some((d) => d.predictedPeriod)) legendKeys.push('predicted');
  if (days.some((d) => d.fertile && !d.ovulation)) legendKeys.push('fertile');
  if (days.some((d) => d.ovulation)) legendKeys.push('ovulation');
  if (days.some((d) => d.spotting)) legendKeys.push('spotting');
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
      {legendKeys.length ? <CyclePhaseLegend look="dense" only={legendKeys} loggedBleedLabel={bleedLabel} /> : null}
    </Pressable>
  );
}

function HeroSkeleton({ minHeight }: { minHeight: number }) {
  const theme = useThemeColors();
  const bone = theme.bg200;
  return (
    <View
      style={[s.open, { minHeight }]}
    >
      <View style={{ height: STRIP_H + 24, borderRadius: 18, backgroundColor: bone }} />
      <CycleWaveLoader label={ka.common.loading} />
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
  /** The cycle hero sits on the page itself (owner 2026-10-03: no outer card) — tray, wave and buttons carry their own surfaces. */
  open: { gap: 16 },
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
});
