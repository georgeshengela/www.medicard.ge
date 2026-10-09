/**
 * `/cycle/settings/profile` — პროფილი (W2-9): mode, cycle/period length, variable cycles, last period,
 * conditions, Tracking + fertile-days display (W2-6), pregnancy / postpartum reference, contraception.
 * One „შენახვა“ pinned above the keyboard (KeyboardFormShell); same writes as the former one-page
 * settings (`setLastPeriod` + `updateProfile`), then reminders are re-planned for the new profile.
 */
import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Baby, Check, Droplet, Flame, Heart, HeartPulse, Sparkles } from 'lucide-react-native';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { CycleHealthConnectCard } from '@/components/cycle/CycleHealthConnectCard';
import { CyclePregnancyTransitionSheet } from '@/components/cycle/CyclePregnancyTransitionSheet';
import { CycleTtcOnboarding } from '@/components/cycle/CycleTtcOnboarding';
import { CyclePerimenopauseOnboarding } from '@/components/cycle/CyclePerimenopauseOnboarding';
import { CyclePostpartumOnboarding } from '@/components/cycle/CyclePostpartumOnboarding';
import { CyclePostpartumReturnSheet } from '@/components/cycle/CyclePostpartumReturnSheet';
import { CycleTtcConflictSheet } from '@/components/cycle/CycleTtcConflictSheet';
import { useCycleTemperatureSetting } from './CycleTemperatureRow';
import {
  CycleCard,
  CycleLoading,
  CyclePrimaryButton,
  CycleSection,
  cycleNavHeader,
  formatCycleDateKa,
} from '@/components/cycle/CycleUI';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, ApiError, type CycleBundle, type CycleCondition, type CycleContraceptionMethod, type CycleMode } from '@/lib/api';
import { cacheCycleBundle, discardQueuedStartRestores } from '@/lib/cycleOffline';
import { isCompleteCycleBundle } from '@/lib/cycleOfflineCore';
import { putCycleBundle } from '@/lib/cycleViewCache';
import { getCycleReminderPrefs, setCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { cycleTrackingFromBundle, isPostpartumReturnLearning } from '@/lib/cycleForecastEligibility';
import { trackingSettingsCopy } from '@/lib/cycleTrackingCopy';
import { importLatestPeriodStart, syncPeriodStartToHealth } from '@/lib/healthSync';
import { useCycleColors } from '@/theme/cycle';
import {
  SettingsCheckRow,
  SettingsDivider,
  SettingsNotice,
  SettingsPill,
  SettingsRowSwitch,
  SettingsStepper,
  applyCycleProfile,
  serverReminderPrefs,
  useCycleSettingsView,
} from './CycleSettingsKit';

const MODES: { id: CycleMode; label: string; hint: string; icon: typeof Heart }[] = [
  { id: 'TRACK_PERIOD', label: ka.cycle.modePeriod, hint: ka.cycle.modePeriodHint, icon: Heart },
  { id: 'TRY_TO_CONCEIVE', label: ka.cycle.modeTtc, hint: ka.cycle.modeTtcHint, icon: Sparkles },
  { id: 'PREGNANCY', label: ka.cycle.modePregnancy, hint: ka.cycle.modePregnancyHint, icon: Baby },
  { id: 'PERIMENOPAUSE', label: ka.cycle.modePeri, hint: ka.cycle.modePeriHint, icon: Flame },
  { id: 'POSTPARTUM', label: ka.cycle.modePostpartum, hint: ka.cycle.modePostpartumHint, icon: HeartPulse },
];

const CONDITIONS: { id: CycleCondition; label: string }[] = [
  { id: 'pcos', label: ka.cycle.conditionPcos },
  { id: 'endometriosis', label: ka.cycle.conditionEndo },
  { id: 'perimenopause', label: ka.cycle.conditionPeri },
];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function CycleProfileSettings() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const { userId, bundle, settled, loading, error, refetch } = useCycleSettingsView();
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'success' | 'error'>('success');

  const [mode, setMode] = useState<CycleMode>('TRACK_PERIOD');
  const [avgCycle, setAvgCycle] = useState('28');
  const [avgPeriod, setAvgPeriod] = useState('5');
  const [lastPeriod, setLastPeriod] = useState('');
  /** The last period start the form was filled with (or last saved): a different one is her own new answer. */
  const filledLastPeriod = useRef('');
  const [dueDate, setDueDate] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [irregular, setIrregular] = useState(false);
  const [conditions, setConditions] = useState<CycleCondition[]>([]);
  const [contraceptionMethod, setContraceptionMethod] = useState<CycleContraceptionMethod | null>(null);
  const [contraceptionStartedAt, setContraceptionStartedAt] = useState('');
  const [postpartumReference, setPostpartumReference] = useState('');
  const [expectsBleeding, setExpectsBleeding] = useState(true);
  const [fertilityDisplay, setFertilityDisplay] = useState<'auto' | 'off'>('auto');
  /** TTC onboarding turns the ovulation reminder on; it is written with the profile on „შენახვა“. */
  const [ttcOvulationOn, setTtcOvulationOn] = useState(false);

  const [pregnancySheet, setPregnancySheet] = useState(false);
  const [ttcConflictOpen, setTtcConflictOpen] = useState(false);
  const [ttcOnboarding, setTtcOnboarding] = useState(false);
  const [periOnboarding, setPeriOnboarding] = useState(false);
  const [postpartumOnboarding, setPostpartumOnboarding] = useState(false);
  const [postpartumReturnSheet, setPostpartumReturnSheet] = useState(false);

  // „ტემპერატურა Apple Health-იდან“ (train 1.0.0.20): acts at once; asks the OS only from its switch.
  const temperature = useCycleTemperatureSetting(userId);

  // Live (unsaved) Tracking / fertile-days state: the saved contraception rules + the form's choices.
  const liveTracking = cycleTrackingFromBundle(bundle, { mode, expectsBleeding, fertilityDisplay });

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, tx('ციკლის პროფილი', 'Cycle profile')));
  }, [navigation, c]);

  const fill = (data: CycleBundle | null | undefined) => {
    const next = applyCycleProfile(data);
    setMode(next.mode);
    setAvgCycle(next.avgCycle);
    setAvgPeriod(next.avgPeriod);
    setLastPeriod(next.lastPeriod);
    filledLastPeriod.current = next.lastPeriod;
    setDueDate(next.dueDate);
    setReferenceDate(next.referenceDate);
    setIrregular(next.irregular);
    setConditions(next.conditions);
    setContraceptionMethod(next.contraceptionMethod);
    setContraceptionStartedAt(next.contraceptionStartedAt);
    setPostpartumReference(next.postpartumReference);
    setExpectsBleeding(next.expectsBleeding);
    setFertilityDisplay(next.fertilityDisplay);
  };

  // The form fills once, from a cached view that is not being refreshed — never from a stale copy a
  // refresh could still change (a later refetch must not wipe what she is editing).
  useEffect(() => {
    if (hydrated || !settled) return;
    fill(bundle);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, settled, bundle]);

  /** After a mode sheet wrote on its own: re-read the view and take the dates it set. */
  const reloadAfterSheet = async (pick: (next: ReturnType<typeof applyCycleProfile>) => void) => {
    try {
      const result = await refetch();
      const data = result.data?.display;
      if (data) pick(applyCycleProfile(data));
    } catch {
      /* The sheet already saved; the next visit shows it. */
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const lastPeriodStart = DATE_KEY.test(lastPeriod) ? lastPeriod : null;
      // A start she changed here replaces an undo's start restore still queued on the phone (IR3-3). The
      // prefilled start, saved again with another setting, leaves it alone: the undo is still on its way.
      if (userId && lastPeriod !== filledLastPeriod.current) await discardQueuedStartRestores(userId);
      if (lastPeriodStart) {
        await api.cycle.setLastPeriod(lastPeriodStart);
      }
      const storedPrefs = await getCycleReminderPrefs({ mode });
      const reminders = ttcOvulationOn ? { ...storedPrefs, ovulation: true } : storedPrefs;
      const data = await api.cycle.updateProfile({
        mode,
        avgCycleLength: Math.min(45, Math.max(21, Number(avgCycle) || 28)),
        avgPeriodLength: Math.min(10, Math.max(2, Number(avgPeriod) || 5)),
        lastPeriodStart,
        pregnancyReferenceDate: mode === 'PREGNANCY' && DATE_KEY.test(referenceDate) ? referenceDate : undefined,
        pregnancyReferenceType:
          mode === 'PREGNANCY' && DATE_KEY.test(referenceDate)
            ? referenceDate === lastPeriod
              ? 'LMP'
              : 'USER_SELECTED'
            : undefined,
        postpartumReferenceDate:
          mode === 'POSTPARTUM' ? (DATE_KEY.test(postpartumReference) ? postpartumReference : null) : undefined,
        isIrregular: irregular,
        conditions,
        reminderPrefs: serverReminderPrefs(reminders),
        contraceptionMethod,
        contraceptionStartedAt: DATE_KEY.test(contraceptionStartedAt) ? contraceptionStartedAt : null,
        expectsBleeding,
        fertilityDisplay,
      });
      if (data?.contraception?.ttcConflict) setTtcConflictOpen(true);
      if (userId) {
        putCycleBundle(userId, data);
        try {
          await cacheCycleBundle(userId, data);
        } catch {
          /* Profile is already saved on the server. */
        }
      }
      // `null` (an older server: a partial `{ profile, meta }`) = saved, but the server could not reload the
      // bundle (CYC-06): the form keeps what she typed, the cycle views refetch, and reminders are
      // re-planned on the next foreground.
      const fresh = isCompleteCycleBundle(data) ? data : null;
      filledLastPeriod.current = lastPeriod;
      if (fresh) {
        const next = applyCycleProfile(fresh);
        setLastPeriod(next.lastPeriod);
        filledLastPeriod.current = next.lastPeriod;
        setExpectsBleeding(next.expectsBleeding);
        setFertilityDisplay(next.fertilityDisplay);
        setDueDate(next.dueDate);
        setReferenceDate(next.referenceDate);
        setPostpartumReference(next.postpartumReference);
        if (DATE_KEY.test(next.lastPeriod)) {
          try {
            await syncPeriodStartToHealth(next.lastPeriod);
          } catch {
            /* Health sync is optional. */
          }
        }
      }
      if (ttcOvulationOn) {
        try {
          await setCycleReminderPrefs({ ovulation: true });
          setTtcOvulationOn(false);
        } catch {
          /* Local reminder prefs must not fail a saved profile. */
        }
      }
      let count = 0;
      try {
        if (fresh) count = await syncCycleReminders(fresh, reminders);
      } catch {
        /* Reminders must not fail a saved profile. */
      }
      setMsgTone('success');
      setMsg(reminders.enabled && count > 0 ? ka.cycle.remindersScheduled(count) : ka.profile.profileSaved);
    } catch (err) {
      setMsgTone('error');
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setSaving(false);
    }
  };

  const pickMode = (next: CycleMode) => {
    setMsg(null);
    if (next === 'PREGNANCY' && mode !== 'PREGNANCY') {
      setPregnancySheet(true);
      return;
    }
    if (next === 'TRY_TO_CONCEIVE' && mode !== 'TRY_TO_CONCEIVE') {
      setTtcOnboarding(true);
      return;
    }
    if (next === 'PERIMENOPAUSE' && mode !== 'PERIMENOPAUSE') {
      setPeriOnboarding(true);
      return;
    }
    if (next === 'POSTPARTUM' && mode !== 'POSTPARTUM') {
      setPostpartumOnboarding(true);
      return;
    }
    if (next === 'TRACK_PERIOD' && bundle?.profile.mode === 'POSTPARTUM') {
      setPostpartumReturnSheet(true);
      return;
    }
    setMode(next);
  };

  const toggleCondition = (id: CycleCondition) => {
    setConditions((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  if (!hydrated) {
    if (loading || !error) return <CycleLoading />;
  }

  return (
    <>
      <KeyboardFormShell
        background={c.cream}
        contentStyle={{ paddingHorizontal: 20, paddingTop: 16 }}
        footer={
          <>
            <SettingsNotice c={c} tone={msgTone} text={msg ?? (!hydrated && error ? ka.common.error : null)} />
            <CyclePrimaryButton
              label={saving ? ka.common.loading : ka.common.save}
              onPress={save}
              loading={saving}
              disabled={saving || !hydrated}
            />
          </>
        }
      >
        <CycleSection title={ka.cycle.settingsMode} subtitle={ka.cycle.settingsModeHint}>
          <View style={{ gap: 8 }}>
            {MODES.map((m, i) => {
              const on = mode === m.id;
              const Icon = m.icon;
              return (
                <Animated.View key={m.id} entering={FadeInUp.delay(40 + i * 30).duration(300)}>
                  <Pressable
                    onPress={() => pickMode(m.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={m.label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: on ? c.accentSoft : c.card,
                      borderRadius: 18,
                      padding: 12,
                      minHeight: 56,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: on ? c.card : c.cardSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={18} color={c.brand} strokeWidth={1.8} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, flex: 1 }}>
                          {m.label}
                        </Text>
                        {on ? <Check size={16} color={c.brand} strokeWidth={2.5} /> : null}
                      </View>
                      <Text style={{ color: c.muted, fontSize: 11.5, lineHeight: 16, marginTop: 2 }}>{m.hint}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
          {mode === 'TRACK_PERIOD' && isPostpartumReturnLearning(bundle) ? (
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 12 }}>
              {ka.cycle.postpartumReturnExplain}
            </Text>
          ) : null}
        </CycleSection>

        {/* §45 — ჩემი ციკლი: cycle profile facts in one place. */}
        <CycleSection title={ka.cycle.settingsMyCycle}>
          <CycleCard>
            <SettingsStepper
              label={ka.cycle.avgCycle}
              value={Number(avgCycle) || 28}
              min={21}
              max={45}
              onChange={(n) => setAvgCycle(String(n))}
              c={c}
            />
            <SettingsDivider c={c} gap={14} />
            <SettingsStepper
              label={ka.cycle.avgPeriod}
              value={Number(avgPeriod) || 5}
              min={2}
              max={10}
              onChange={(n) => setAvgPeriod(String(n))}
              c={c}
            />
            <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16, marginTop: 10 }}>
              {ka.cycle.avgHintOnboarding}
            </Text>
            <SettingsDivider c={c} gap={14} />
            <SettingsRowSwitch icon={Sparkles} label={ka.cycle.irregular} value={irregular} onChange={setIrregular} c={c} />
            <SettingsDivider c={c} gap={14} />
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 10 }}>{ka.cycle.lastPeriod}</Text>
            <CycleDateField
              value={lastPeriod}
              onChange={setLastPeriod}
              placeholder={ka.cycle.onboardTapCalendar}
              range="past"
              variant="hero"
            />
          </CycleCard>
          <View style={{ height: 12 }} />
          <CycleHealthConnectCard
            onConnected={async () => {
              const imported = await importLatestPeriodStart();
              if (imported && !lastPeriod) {
                setLastPeriod(imported);
                setMsgTone('success');
                setMsg(ka.cycle.healthImportHint);
              }
            }}
          />
        </CycleSection>

        <CycleSection title={tx('მდგომარეობები', 'Conditions')} subtitle={ka.cycle.conditionsExplain}>
          <CycleCard>
            <View style={{ gap: 8 }}>
              {CONDITIONS.map((item) => (
                <SettingsCheckRow
                  key={item.id}
                  label={item.label}
                  selected={conditions.includes(item.id)}
                  onPress={() => toggleCondition(item.id)}
                  c={c}
                />
              ))}
            </View>
          </CycleCard>
        </CycleSection>

        {/* Brief §9 wave 2 item 17: Tracking (no periods expected) + the fertile-days display switch. */}
        {mode === 'TRACK_PERIOD' || mode === 'TRY_TO_CONCEIVE' ? (
          <CycleSection title={trackingSettingsCopy.section()}>
            <CycleCard>
              {mode === 'TRACK_PERIOD' ? (
                <>
                  <SettingsRowSwitch
                    icon={Droplet}
                    label={trackingSettingsCopy.expectsLabel()}
                    hint={trackingSettingsCopy.expectsHint()}
                    value={!expectsBleeding}
                    onChange={(v) => setExpectsBleeding(!v)}
                    c={c}
                  />
                  <SettingsDivider c={c} />
                </>
              ) : null}
              <SettingsRowSwitch
                icon={Sparkles}
                label={trackingSettingsCopy.fertilityLabel()}
                hint={
                  trackingSettingsCopy.forced(liveTracking.fertility.forcedBy)
                  ?? (liveTracking.fertility.effective === 'on'
                    ? trackingSettingsCopy.fertilityHintOn()
                    : trackingSettingsCopy.fertilityHintOff())
                }
                value={liveTracking.fertility.effective === 'on'}
                disabled={!liveTracking.fertility.userCanChange}
                onChange={(v) => setFertilityDisplay(v ? 'auto' : 'off')}
                c={c}
              />
            </CycleCard>
            {temperature.card ? <View style={{ height: 12 }} /> : null}
            {temperature.card}
          </CycleSection>
        ) : null}

        {mode === 'PREGNANCY' ? (
          <CycleSection title={ka.cycle.pregnancySettingsReference} subtitle={ka.cycle.pregnancySettingsDueHint}>
            <CycleDateField
              value={referenceDate}
              onChange={setReferenceDate}
              placeholder={ka.cycle.pregnancyPickReference}
              range="past"
            />
            {dueDate ? (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 12 }}>
                {ka.cycle.pregnancyEstimatedDue}: {formatCycleDateKa(dueDate)}
              </Text>
            ) : null}
            <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
              {bundle?.pregnancy?.referenceType === 'USER_SELECTED'
                ? ka.cycle.pregnancySourceSelected
                : ka.cycle.pregnancySourceLmp}
            </Text>
          </CycleSection>
        ) : null}

        {mode === 'POSTPARTUM' ? (
          <CycleSection title={ka.cycle.postpartumReferenceLabel} subtitle={ka.cycle.postpartumReferenceHint}>
            <CycleDateField
              value={postpartumReference}
              onChange={setPostpartumReference}
              placeholder={ka.cycle.postpartumAddReference}
              range="past"
            />
            {postpartumReference ? (
              <Pressable
                onPress={() => setPostpartumReference('')}
                accessibilityRole="button"
                accessibilityLabel={ka.cycle.postpartumClearReference}
                style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
              >
                <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
                  {ka.cycle.postpartumClearReference}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setPostpartumReturnSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.postpartumReturnAction}
              style={{
                minHeight: 48,
                marginTop: 16,
                borderRadius: 16,
                backgroundColor: c.card,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, textAlign: 'center' }}>
                {ka.cycle.postpartumReturnAction}
              </Text>
            </Pressable>
          </CycleSection>
        ) : null}

        <CycleSection title={ka.cycle.contraceptionTitle} subtitle={ka.cycle.contraceptionHint}>
          <CycleCard>
            <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16, marginBottom: 12 }}>
              {ka.cycle.contraceptionNotMethod}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(ka.cycle.contraceptionMethod) as CycleContraceptionMethod[]).map((id) => (
                <SettingsPill
                  key={id}
                  label={ka.cycle.contraceptionMethod[id]}
                  selected={contraceptionMethod === id}
                  onPress={() => setContraceptionMethod(id)}
                  c={c}
                />
              ))}
            </View>
            {contraceptionMethod && contraceptionMethod !== 'NONE' ? (
              <View style={{ marginTop: 14 }}>
                <CycleDateField
                  value={contraceptionStartedAt}
                  onChange={setContraceptionStartedAt}
                  placeholder={ka.cycle.contraceptionUnknownStart}
                  range="past"
                />
              </View>
            ) : null}
            <Pressable
              onPress={() => {
                setContraceptionMethod('NONE');
                setContraceptionStartedAt('');
              }}
              accessibilityRole="button"
              style={{ marginTop: 12, minHeight: 40, justifyContent: 'center' }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
                {ka.cycle.contraceptionClear}
              </Text>
            </Pressable>
          </CycleCard>
        </CycleSection>
      </KeyboardFormShell>
      {temperature.primer}

      <CyclePregnancyTransitionSheet
        visible={pregnancySheet}
        lastPeriod={lastPeriod}
        onClose={() => setPregnancySheet(false)}
        onComplete={() => {
          setMode('PREGNANCY');
          void reloadAfterSheet((next) => {
            setDueDate(next.dueDate);
            setReferenceDate(next.referenceDate);
          });
        }}
      />
      <CycleTtcOnboarding
        visible={ttcOnboarding}
        onClose={() => setTtcOnboarding(false)}
        onConfirm={() => {
          setTtcOnboarding(false);
          setMode('TRY_TO_CONCEIVE');
          // TTC onboarding turns ovulation + fertile-window reminders on (brief §9 item 5); saved with the profile.
          setTtcOvulationOn(true);
        }}
      />
      <CyclePerimenopauseOnboarding
        visible={periOnboarding}
        onClose={() => setPeriOnboarding(false)}
        onConfirm={() => {
          setPeriOnboarding(false);
          setMode('PERIMENOPAUSE');
        }}
      />
      <CyclePostpartumOnboarding
        visible={postpartumOnboarding}
        fromMode={mode}
        onClose={() => setPostpartumOnboarding(false)}
        onComplete={() => {
          setMode('POSTPARTUM');
          void reloadAfterSheet((next) => setPostpartumReference(next.postpartumReference));
        }}
      />
      <CyclePostpartumReturnSheet
        visible={postpartumReturnSheet}
        onClose={() => setPostpartumReturnSheet(false)}
        onComplete={() => {
          setMode('TRACK_PERIOD');
          void (async () => {
            const result = await refetch().catch(() => null);
            const view = result?.data;
            if (!view) return;
            setPostpartumReference(applyCycleProfile(view.display).postpartumReference);
            if (userId) void cacheCycleBundle(userId, view.canonical).catch(() => undefined);
          })();
        }}
      />
      <CycleTtcConflictSheet
        visible={ttcConflictOpen}
        onClose={() => setTtcConflictOpen(false)}
        onKeepTtc={() => setTtcConflictOpen(false)}
        onSwitchTrack={() => {
          setTtcConflictOpen(false);
          setMode('TRACK_PERIOD');
          void api.cycle
            .updateProfile({ mode: 'TRACK_PERIOD' })
            .then((data) => {
              if (userId) putCycleBundle(userId, data);
            })
            .catch(() => undefined);
        }}
      />
    </>
  );
}
