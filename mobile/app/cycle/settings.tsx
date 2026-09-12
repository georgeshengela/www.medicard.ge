import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Baby, Bell, CalendarPlus, Check, Download, EyeOff, Flame, Heart, HeartPulse, Link2, Lock, Sparkles, Trash2 } from 'lucide-react-native';
import { CycleNotificationMaskPreview } from '@/components/cycle/CycleNotificationMaskPreview';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { CycleHealthConnectCard } from '@/components/cycle/CycleHealthConnectCard';
import { CyclePregnancyTransitionSheet } from '@/components/cycle/CyclePregnancyTransitionSheet';
import { CycleTtcOnboarding } from '@/components/cycle/CycleTtcOnboarding';
import { CyclePerimenopauseOnboarding } from '@/components/cycle/CyclePerimenopauseOnboarding';
import { CyclePostpartumOnboarding } from '@/components/cycle/CyclePostpartumOnboarding';
import { CyclePostpartumReturnSheet } from '@/components/cycle/CyclePostpartumReturnSheet';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CyclePrimaryButton,
  CycleSection,
  cycleNavHeader,
  formatCycleDateKa,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleBundle, type CycleCondition, type CycleContraceptionMethod, type CycleMode } from '@/lib/api';
import { CycleTtcConflictSheet } from '@/components/cycle/CycleTtcConflictSheet';
import { cacheCycleBundle, destroyCycleOfflineAccount, loadCycleView, peekCyclePendingCount } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import { normalizeIsoDate } from '@/lib/birthdate';
import { buildCycleIcs } from '@/lib/cycleCalendarExport';
import {
  getCycleReminderPrefs,
  setCyclePrivacyLockEnabled,
  setCycleReminderPrefs,
  isCyclePrivacyLockEnabled,
  type CycleReminderPrefs,
} from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import {
  CYCLE_MASK_STYLES,
  maskStyleLabel,
} from '@/lib/cycleNotificationMask';
import { getEffectiveCycleMask } from '@/lib/cycleNotificationContract.js';
import { isPostpartumReturnLearning } from '@/lib/cycleForecastEligibility';
import { importLatestPeriodStart, syncPeriodStartToHealth } from '@/lib/healthSync';
import { useCycleColors } from '@/theme/cycle';

const MODES: { id: CycleMode; label: string; hint: string; icon: typeof Heart }[] = [
  {
    id: 'TRACK_PERIOD',
    label: ka.cycle.modePeriod,
    hint: ka.cycle.modePeriodHint,
    icon: Heart,
  },
  {
    id: 'TRY_TO_CONCEIVE',
    label: ka.cycle.modeTtc,
    hint: ka.cycle.modeTtcHint,
    icon: Sparkles,
  },
  {
    id: 'PREGNANCY',
    label: ka.cycle.modePregnancy,
    hint: ka.cycle.modePregnancyHint,
    icon: Baby,
  },
  {
    id: 'PERIMENOPAUSE',
    label: ka.cycle.modePeri,
    hint: ka.cycle.modePeriHint,
    icon: Flame,
  },
  {
    id: 'POSTPARTUM',
    label: ka.cycle.modePostpartum,
    hint: ka.cycle.modePostpartumHint,
    icon: HeartPulse,
  },
];

const CONDITIONS: { id: CycleCondition; label: string }[] = [
  { id: 'pcos', label: ka.cycle.conditionPcos },
  { id: 'endometriosis', label: ka.cycle.conditionEndo },
  { id: 'perimenopause', label: ka.cycle.conditionPeri },
];

function applyProfile(data: CycleBundle) {
  const profile = data?.profile ?? ({} as CycleBundle['profile']);
  return {
    mode: profile.mode ?? 'TRACK_PERIOD',
    avgCycle: String(profile.avgCycleLength ?? 28),
    avgPeriod: String(profile.avgPeriodLength ?? 5),
    lastPeriod: normalizeIsoDate(profile.lastPeriodStart),
    dueDate: normalizeIsoDate(data?.pregnancy?.dueDate ?? profile.dueDate),
    referenceDate: normalizeIsoDate(data?.pregnancy?.referenceDate),
    irregular: Boolean(profile.isIrregular),
    privacy: Boolean(profile.privacyEnabled),
    conditions: (profile.conditions ?? []) as CycleCondition[],
    contraceptionMethod: (profile.contraceptionMethod ?? null) as CycleContraceptionMethod | null,
    contraceptionStartedAt: normalizeIsoDate(profile.contraceptionStartedAt),
    postpartumReference: normalizeIsoDate(data?.postpartum?.referenceDate),
  };
}

function serverReminderPrefs(prefs: CycleReminderPrefs) {
  return {
    enabled: prefs.enabled,
    periodDaysBefore: prefs.periodDaysBefore,
    ovulation: prefs.ovulation,
    dailyLog: prefs.dailyLog,
    pms: prefs.pms,
    opk: prefs.opk,
    bbt: prefs.bbt,
  };
}

export default function CycleSettings() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [canonical, setCanonical] = useState<CycleBundle | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'success' | 'error'>('success');

  const [mode, setMode] = useState<CycleMode>('TRACK_PERIOD');
  const [avgCycle, setAvgCycle] = useState('28');
  const [avgPeriod, setAvgPeriod] = useState('5');
  const [lastPeriod, setLastPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [irregular, setIrregular] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [privacyLock, setPrivacyLock] = useState(false);
  const [conditions, setConditions] = useState<CycleCondition[]>([]);
  const [reminders, setReminders] = useState<CycleReminderPrefs>({
    enabled: false,
    periodDaysBefore: 2,
    ovulation: true,
    dailyLog: false,
    pms: true,
    opk: false,
    bbt: false,
    maskNotifications: true,
    maskStyle: 'neutral',
  });
  const [pregnancySheet, setPregnancySheet] = useState(false);
  const [contraceptionMethod, setContraceptionMethod] = useState<CycleContraceptionMethod | null>(null);
  const [contraceptionStartedAt, setContraceptionStartedAt] = useState('');
  const [ttcConflictOpen, setTtcConflictOpen] = useState(false);
  const [ttcOnboarding, setTtcOnboarding] = useState(false);
  const [periOnboarding, setPeriOnboarding] = useState(false);
  const [postpartumOnboarding, setPostpartumOnboarding] = useState(false);
  const [postpartumReference, setPostpartumReference] = useState('');
  const [postpartumReturnSheet, setPostpartumReturnSheet] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.settings));
  }, [navigation, c]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    Promise.all([loadCycleView(user.id), getCycleReminderPrefs(), isCyclePrivacyLockEnabled()])
      .then(([view, remPrefs, lockOn]) => {
        const data = view.display;
        setBundle(data);
        setCanonical(view.canonical);
        setPendingCount(view.pendingCount);
        const next = applyProfile(data);
        setMode(next.mode);
        setAvgCycle(next.avgCycle);
        setAvgPeriod(next.avgPeriod);
        setLastPeriod(next.lastPeriod);
        setDueDate(next.dueDate);
        setReferenceDate(next.referenceDate);
        setIrregular(next.irregular);
        setPrivacy(next.privacy);
        setConditions(next.conditions);
        setContraceptionMethod(next.contraceptionMethod);
        setContraceptionStartedAt(next.contraceptionStartedAt);
        setPostpartumReference(next.postpartumReference);
        setReminders(remPrefs);
        setPrivacyLock(lockOn);
      })
      .catch((err) => {
        setMsgTone('error');
        setMsg(err instanceof ApiError ? err.message : ka.common.error);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const lastPeriodStart = /^\d{4}-\d{2}-\d{2}$/.test(lastPeriod) ? lastPeriod : null;
      if (lastPeriodStart) {
        await api.cycle.setLastPeriod(lastPeriodStart);
      }
      const data = await api.cycle.updateProfile({
        mode,
        avgCycleLength: Math.min(45, Math.max(21, Number(avgCycle) || 28)),
        avgPeriodLength: Math.min(10, Math.max(2, Number(avgPeriod) || 5)),
        lastPeriodStart,
        pregnancyReferenceDate:
          mode === 'PREGNANCY' && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : undefined,
        pregnancyReferenceType:
          mode === 'PREGNANCY' && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
            ? referenceDate === lastPeriod
              ? 'LMP'
              : 'USER_SELECTED'
            : undefined,
        postpartumReferenceDate:
          mode === 'POSTPARTUM'
            ? /^\d{4}-\d{2}-\d{2}$/.test(postpartumReference)
              ? postpartumReference
              : null
            : undefined,
        isIrregular: irregular,
        privacyEnabled: privacy,
        conditions,
        reminderPrefs: serverReminderPrefs(reminders),
        contraceptionMethod,
        contraceptionStartedAt: /^\d{4}-\d{2}-\d{2}$/.test(contraceptionStartedAt)
          ? contraceptionStartedAt
          : null,
      });
      if (data.contraception?.ttcConflict) setTtcConflictOpen(true);
      setBundle(data);
      setCanonical(data);
      if (user?.id) {
        try {
          await cacheCycleBundle(user.id, data);
        } catch {
          /* Profile is already saved on the server. */
        }
      }
      const next = applyProfile(data);
      setLastPeriod(next.lastPeriod);
      setDueDate(next.dueDate);
      setReferenceDate(next.referenceDate);
      setPostpartumReference(next.postpartumReference);
      if (/^\d{4}-\d{2}-\d{2}$/.test(next.lastPeriod)) {
        try {
          await syncPeriodStartToHealth(next.lastPeriod);
        } catch {
          /* Health sync is optional. */
        }
      }
      try {
        await setCycleReminderPrefs(reminders);
      } catch {
        /* Local reminder prefs must not fail a saved last-period date. */
      }
      let count = 0;
      try {
        count = await syncCycleReminders(data, reminders);
      } catch {
        /* Reminders must not fail a saved last-period date. */
      }
      setMsgTone('success');
      setMsg(
        reminders.enabled && count > 0
          ? ka.cycle.remindersScheduled(count)
          : ka.profile.profileSaved,
      );
    } catch (err) {
      setMsgTone('error');
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setSaving(false);
    }
  };

  const pickMode = (next: CycleMode) => {
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

  const exportCalendar = async () => {
    const source = canonical ?? bundle;
    if (!source) return;
    setMsg(null);
    try {
      if ((pendingCount || (user?.id ? await peekCyclePendingCount(user.id) : 0)) > 0) {
        setMsgTone('error');
        setMsg(ka.cycle.reportPendingWarn);
        return;
      }
      const ics = buildCycleIcs(source);
      if (Platform.OS === 'web') {
        await Share.share({ message: ics });
        return;
      }
      const path = `${FileSystem.cacheDirectory}medicard-cycle.ics`;
      await FileSystem.writeAsStringAsync(path, ics, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/calendar', UTI: 'public.calendar-event' });
      }
      setMsgTone('success');
      setMsg(ka.common.share);
    } catch (err) {
      setMsgTone('error');
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    }
  };

  const exportJson = async () => {
    setMsg(null);
    try {
      if ((pendingCount || (user?.id ? await peekCyclePendingCount(user.id) : 0)) > 0) {
        setMsgTone('error');
        setMsg(ka.cycle.reportPendingWarn);
        return;
      }
      const data = await api.cycle.exportData();
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        await Share.share({ message: json });
        return;
      }
      const path = `${FileSystem.cacheDirectory}medicard-cycle-export.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', UTI: 'public.json' });
      }
      setMsgTone('success');
      setMsg(ka.cycle.exportJsonDone);
    } catch (err) {
      setMsgTone('error');
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    }
  };

  const wipeCycleData = () => {
    Alert.alert(ka.cycle.deleteCycleTitle, ka.cycle.deleteCycleBody, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.cycle.deleteCycleConfirm,
        style: 'destructive',
        onPress: () => {
          Alert.alert(ka.cycle.deleteCycleAgain, ka.cycle.deleteCycleBody, [
            { text: ka.common.cancel, style: 'cancel' },
            {
              text: ka.cycle.deleteCycleConfirm,
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  try {
                    const result = await api.cycle.wipeData();
                    if (user?.id) {
                      await destroyCycleOfflineAccount(user.id);
                      const { wipePregnancyCareCalendarOwnership } = await import('@/lib/pregnancyCareCalendar');
                      await wipePregnancyCareCalendarOwnership(user.id);
                    }
                    const next = applyProfile(result.bundle);
                    setBundle(result.bundle);
                    setCanonical(result.bundle);
                    setPendingCount(0);
                    setMode(next.mode);
                    setLastPeriod(next.lastPeriod);
                    setContraceptionMethod(next.contraceptionMethod);
                    setContraceptionStartedAt(next.contraceptionStartedAt);
                    setMsgTone('success');
                    setMsg(ka.cycle.deleteCycleDone);
                  } catch (err) {
                    setMsgTone('error');
                    setMsg(err instanceof ApiError ? err.message : ka.common.error);
                  }
                })();
              },
            },
          ]);
        },
      },
    ]);
  };

  const togglePrivacyLock = async (on: boolean) => {
    setPrivacyLock(on);
    await setCyclePrivacyLockEnabled(on);
  };

  const updateReminders = (patch: Partial<CycleReminderPrefs>) => {
    setReminders((cur) => ({ ...cur, ...patch }));
  };

  const toggleShare = async (on: boolean) => {
    setMsg(null);
    try {
      const data = await api.cycle.updateProfile({ enablePartnerShare: on });
      setBundle(data);
      const code = data.partnerShare?.code ?? data.profile.partnerShareCode;
      if (on && code) {
        const url = `https://medicard.ge/share/cycle/${code}`;
        await Share.share({ message: url });
        setMsgTone('success');
        setMsg(ka.common.share);
      } else if (!on) {
        setMsgTone('success');
        setMsg(ka.cycle.partnerOff);
      }
    } catch (err) {
      setMsgTone('error');
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    }
  };

  const patchSharePerm = async (key: keyof NonNullable<CycleBundle['partnerShare']>['permissions'], value: boolean) => {
    setMsg(null);
    try {
      const data = await api.cycle.updateProfile({ sharePermissions: { [key]: value } });
      setBundle(data);
    } catch (err) {
      setMsgTone('error');
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    }
  };

  if (loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ marginBottom: 20 }}>
          <View
            style={{
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
            }}
          >
            <Text
              style={{
                color: c.brand,
                fontSize: 12,
                fontFamily: 'NotoSansGeorgian_700Bold',
                letterSpacing: 0.6,
              }}
            >
              {ka.cycle.settings}
            </Text>
            <Text
              style={{
                color: c.ink,
                fontSize: 20,
                fontFamily: 'NotoSansGeorgian_700Bold',
                marginTop: 6,
                letterSpacing: -0.3,
              }}
            >
              {ka.cycle.settingsHero}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
              {ka.cycle.settingsHeroHint}
            </Text>
          </View>
        </Animated.View>

        <CycleSection title={ka.cycle.settingsMode} subtitle={ka.cycle.settingsModeHint} delay={40}>
          <View style={{ gap: 10 }}>
            {MODES.map((m, i) => {
              const on = mode === m.id;
              const Icon = m.icon;
              return (
                <Animated.View key={m.id} entering={FadeInUp.delay(60 + i * 40).duration(360)}>
                  <Pressable
                    onPress={() => pickMode(m.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={m.label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: on ? c.cta : c.card,
                      borderRadius: 16,
                      padding: 16,
                      minHeight: 44,
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? c.ink : c.border,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: on ? 'rgba(255,255,255,0.2)' : c.cardSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={20} color={on ? '#fff' : c.brand} strokeWidth={2.1} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            color: on ? '#fff' : c.ink,
                            fontFamily: 'NotoSansGeorgian_700Bold',
                            fontSize: 15,
                            flex: 1,
                          }}
                        >
                          {m.label}
                        </Text>
                        {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                      </View>
                      <Text
                        style={{
                          color: on ? 'rgba(255,255,255,0.8)' : c.muted,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {m.hint}
                      </Text>
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
        <CycleSection title={ka.cycle.settingsMyCycle} delay={80}>
          <CycleCard>
            <Stepper
              label={ka.cycle.avgCycle}
              value={Number(avgCycle) || 28}
              min={21}
              max={45}
              onChange={(n) => setAvgCycle(String(n))}
              c={c}
            />
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
            <Stepper
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
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
            <RowSwitch
              icon={Sparkles}
              label={ka.cycle.irregular}
              value={irregular}
              onChange={setIrregular}
              c={c}
            />
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 10 }}>{ka.cycle.lastPeriod}</Text>
            <CycleDateField
              value={lastPeriod}
              onChange={setLastPeriod}
              placeholder={ka.cycle.onboardTapCalendar}
              range="past"
              variant="hero"
            />
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
              {ka.cycle.conditionsExplain}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CONDITIONS.map((item) => {
                const on = conditions.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleCondition(item.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      minHeight: 40,
                      borderRadius: 999,
                      backgroundColor: on ? c.cta : c.creamDeep,
                      borderWidth: 1,
                      borderColor: on ? c.cta : c.border,
                    }}
                  >
                    <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '700', fontSize: 13 }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </CycleCard>
        </CycleSection>

        {mode === 'PREGNANCY' ? (
          <CycleSection
            title={ka.cycle.pregnancySettingsReference}
            subtitle={ka.cycle.pregnancySettingsDueHint}
            delay={110}
          >
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
          <CycleSection
            title={ka.cycle.postpartumReferenceLabel}
            subtitle={ka.cycle.postpartumReferenceHint}
            delay={110}
          >
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
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.card,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 14,
              }}
            >
              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                {ka.cycle.postpartumReturnAction}
              </Text>
            </Pressable>
          </CycleSection>
        ) : null}

        <CycleSection title={ka.cycle.contraceptionTitle} subtitle={ka.cycle.contraceptionHint} delay={130}>
          <CycleCard>
            <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16, marginBottom: 12 }}>
              {ka.cycle.contraceptionNotMethod}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(ka.cycle.contraceptionMethod) as CycleContraceptionMethod[]).map((id) => {
                const on = contraceptionMethod === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setContraceptionMethod(id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: on ? c.cta : c.creamDeep,
                      borderWidth: 1,
                      borderColor: on ? c.cta : c.border,
                    }}
                  >
                    <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '700', fontSize: 12 }}>
                      {ka.cycle.contraceptionMethod[id]}
                    </Text>
                  </Pressable>
                );
              })}
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
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
                {ka.cycle.contraceptionClear}
              </Text>
            </Pressable>
          </CycleCard>
        </CycleSection>

        <CycleSection title={ka.cycle.settingsReminders} subtitle={ka.cycle.remindersHint} delay={140}>
          <CycleCard>
            <RowSwitch
              icon={Bell}
              label={ka.cycle.remindersEnabled}
              value={reminders.enabled}
              onChange={(v) => updateReminders({ enabled: v })}
              c={c}
            />
            {reminders.enabled ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
                <Stepper
                  label={ka.cycle.remindersPeriodBefore}
                  value={reminders.periodDaysBefore}
                  min={0}
                  max={5}
                  onChange={(n) => updateReminders({ periodDaysBefore: n })}
                  c={c}
                />
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
                <RowSwitch
                  icon={Sparkles}
                  label={ka.cycle.remindersOvulation}
                  value={reminders.ovulation}
                  onChange={(v) => updateReminders({ ovulation: v })}
                  c={c}
                />
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
                <RowSwitch
                  icon={Heart}
                  label={ka.cycle.remindersDailyLog}
                  value={reminders.dailyLog}
                  onChange={(v) => updateReminders({ dailyLog: v })}
                  c={c}
                />
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
                <RowSwitch
                  icon={Heart}
                  label={ka.cycle.remindersPms}
                  value={reminders.pms}
                  onChange={(v) => updateReminders({ pms: v })}
                  c={c}
                />
                {mode === 'TRY_TO_CONCEIVE' ? (
                  <>
                    <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
                    <RowSwitch
                      icon={Sparkles}
                      label={ka.cycle.remindersOpk}
                      value={reminders.opk}
                      onChange={(v) => updateReminders({ opk: v })}
                      c={c}
                    />
                    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 6 }}>
                      {ka.cycle.remindersOpkHint}
                    </Text>
                    <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
                    <RowSwitch
                      icon={Heart}
                      label={ka.cycle.remindersBbt}
                      value={reminders.bbt}
                      onChange={(v) => updateReminders({ bbt: v })}
                      c={c}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </CycleCard>
        </CycleSection>

        {/* §45 — კონფიდენციალურობა: privacy, mask, lock, sharing together. */}
        <CycleSection title={ka.cycle.settingsPrivacy} delay={200}>
          <CycleCard>
            <RowSwitch
              icon={Lock}
              label={ka.cycle.privacy}
              value={privacy}
              onChange={setPrivacy}
              c={c}
            />
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 8 }}>
              {ka.cycle.privacyHint}
            </Text>
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
            <RowSwitch
              icon={Lock}
              label={ka.cycle.privacyLock}
              value={privacyLock}
              onChange={togglePrivacyLock}
              c={c}
            />
          </CycleCard>

          <View style={{ height: 12 }} />

          <CycleCard delay={0}>
            <RowSwitch
              icon={EyeOff}
              label={ka.cycle.maskEnabled}
              value={reminders.maskNotifications}
              onChange={(v) => updateReminders({ maskNotifications: v })}
              c={c}
            />
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 8 }}>
              {privacy && !reminders.maskNotifications
                ? ka.cycle.maskForcedByPrivacy
                : ka.cycle.maskHint}
            </Text>

            <CycleNotificationMaskPreview
              maskEnabled={
                getEffectiveCycleMask({
                  privacyEnabled: privacy,
                  maskNotifications: reminders.maskNotifications,
                }).masked
              }
              maskStyle={reminders.maskStyle}
            />

            {reminders.maskNotifications ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
                <Text style={{ color: c.ink, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
                  {ka.cycle.maskStyleLabel}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CYCLE_MASK_STYLES.map((style) => {
                    const on = reminders.maskStyle === style;
                    return (
                      <Pressable
                        key={style}
                        onPress={() => updateReminders({ maskStyle: style })}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 999,
                          backgroundColor: on ? c.cta : c.creamDeep,
                          borderWidth: 1,
                          borderColor: on ? c.cta : c.border,
                        }}
                      >
                        <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '700', fontSize: 13 }}>
                          {maskStyleLabel(style)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </CycleCard>

          <View style={{ height: 12 }} />

          <CycleCard delay={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Link2 size={18} color={c.lavender} />
              <Text style={{ color: c.muted, marginLeft: 8, fontSize: 13, flex: 1 }}>
                {ka.cycle.partnerShareHint}
              </Text>
            </View>
            {bundle?.partnerShare?.code ? (
              <Text
                style={{ color: c.ink, fontSize: 12, marginBottom: 8, fontWeight: '600' }}
                selectable
              >
                medicard.ge/share/cycle/{bundle.partnerShare.code}
              </Text>
            ) : null}
            {bundle?.partnerShare?.active ? (
              <Text style={{ color: c.success, fontSize: 12, marginBottom: 8, fontWeight: '600' }}>
                {ka.cycle.partnerShareAccepted}
              </Text>
            ) : null}
            {bundle?.partnerShare?.active && bundle.partnerShare.expiresAt ? (
              <Text style={{ color: c.muted, fontSize: 12, marginBottom: 12, fontWeight: '600' }}>
                {ka.cycle.partnerShareExpires}: {bundle.partnerShare.expiresAt.slice(0, 10)}
              </Text>
            ) : null}
            {bundle?.partnerShare?.active ? (
              <View style={{ gap: 4, marginBottom: 12 }}>
                <RowSwitch
                  icon={Heart}
                  label={ka.cycle.partnerPermPeriod}
                  value={bundle.partnerShare.permissions.period}
                  onChange={(v) => void patchSharePerm('period', v)}
                  c={c}
                />
                <RowSwitch
                  icon={Sparkles}
                  label={ka.cycle.partnerPermPhase}
                  value={bundle.partnerShare.permissions.cyclePhase}
                  onChange={(v) => void patchSharePerm('cyclePhase', v)}
                  c={c}
                />
                <RowSwitch
                  icon={Baby}
                  label={ka.cycle.partnerPermFertile}
                  value={bundle.partnerShare.permissions.fertileWindow}
                  onChange={(v) => void patchSharePerm('fertileWindow', v)}
                  c={c}
                />
                <RowSwitch
                  icon={EyeOff}
                  label={ka.cycle.partnerPermSymptoms}
                  value={bundle.partnerShare.permissions.symptoms}
                  onChange={(v) => void patchSharePerm('symptoms', v)}
                  c={c}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => toggleShare(true)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: c.lavenderSoft,
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{ color: c.ink, fontWeight: '700', fontSize: 13, textAlign: 'center' }}
                >
                  {ka.cycle.partnerOn}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => toggleShare(false)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: c.creamDeep,
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{ color: c.muted, fontWeight: '700', fontSize: 13, textAlign: 'center' }}
                >
                  {ka.cycle.partnerOff}
                </Text>
              </Pressable>
            </View>
          </CycleCard>
        </CycleSection>

        {/* §45 — მონაცემები: health sync, exports, deletion. */}
        <CycleSection title={ka.cycle.settingsData} subtitle={ka.cycle.calendarExportHint} delay={240}>
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

          <View style={{ height: 12 }} />

          <CycleCard delay={0}>
            <Pressable
              onPress={exportCalendar}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.calendarExport}
              className="active:opacity-90"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 48,
              }}
            >
              <CalendarPlus size={20} color={c.brand} />
              <Text style={{ color: c.ink, fontWeight: '700', marginLeft: 10, flex: 1 }}>
                {ka.cycle.calendarExport}
              </Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8 }} />
            <Pressable
              onPress={() => void exportJson()}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.exportJson}
              className="active:opacity-90"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 48,
              }}
            >
              <Download size={20} color={c.brand} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '700' }}>{ka.cycle.exportJson}</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                  {ka.cycle.exportJsonHint}
                </Text>
              </View>
            </Pressable>
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8 }} />
            <Pressable
              onPress={wipeCycleData}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.deleteCycleTitle}
              className="active:opacity-90"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 48,
              }}
            >
              <Trash2 size={20} color={c.danger} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: c.danger, fontWeight: '700' }}>{ka.cycle.deleteCycleTitle}</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                  {ka.cycle.deleteCycleBody}
                </Text>
              </View>
            </Pressable>
          </CycleCard>
        </CycleSection>

        {msg ? (
          <View
            style={{
              marginBottom: 12,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: msgTone === 'error' ? `${c.danger}14` : `${c.success}18`,
            }}
          >
            <Text
              style={{
                color: msgTone === 'error' ? c.danger : c.success,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {msg}
            </Text>
          </View>
        ) : null}
        <CyclePrimaryButton
          label={saving ? ka.common.loading : ka.common.save}
          onPress={save}
          loading={saving}
          disabled={saving}
        />
      </ScrollView>

      <CyclePregnancyTransitionSheet
        visible={pregnancySheet}
        lastPeriod={lastPeriod}
        onClose={() => setPregnancySheet(false)}
        onComplete={() => {
          setMode('PREGNANCY');
          if (user?.id) {
            void loadCycleView(user.id).then((view) => {
              setBundle(view.display);
              setCanonical(view.canonical);
              const next = applyProfile(view.display);
              setDueDate(next.dueDate);
              setReferenceDate(next.referenceDate);
            });
          }
        }}
      />
      <CycleTtcOnboarding
        visible={ttcOnboarding}
        onClose={() => setTtcOnboarding(false)}
        onConfirm={() => {
          setTtcOnboarding(false);
          setMode('TRY_TO_CONCEIVE');
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
          if (user?.id) {
            void loadCycleView(user.id).then((view) => {
              setBundle(view.display);
              setCanonical(view.canonical);
              const next = applyProfile(view.display);
              setPostpartumReference(next.postpartumReference);
            });
          }
        }}
      />
      <CyclePostpartumReturnSheet
        visible={postpartumReturnSheet}
        onClose={() => setPostpartumReturnSheet(false)}
        onComplete={() => {
          setMode('TRACK_PERIOD');
          if (user?.id) {
            void loadCycleView(user.id).then((view) => {
              setBundle(view.display);
              setCanonical(view.canonical);
              const next = applyProfile(view.display);
              setPostpartumReference(next.postpartumReference);
              void cacheCycleBundle(user.id, view.canonical).catch(() => undefined);
            });
          }
        }}
      />
      <CycleTtcConflictSheet
        visible={ttcConflictOpen}
        onClose={() => setTtcConflictOpen(false)}
        onKeepTtc={() => setTtcConflictOpen(false)}
        onSwitchTrack={() => {
          setTtcConflictOpen(false);
          setMode('TRACK_PERIOD');
          void api.cycle.updateProfile({ mode: 'TRACK_PERIOD' }).then((data) => {
            setBundle(data);
            setCanonical(data);
          }).catch(() => undefined);
        }}
      />
    </CycleAtmosphere>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  c,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  c: ReturnType<typeof useCycleColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: c.ink, fontWeight: '700', flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: c.cardSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18 }}>−</Text>
        </Pressable>
        <Text
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 20,
            minWidth: 28,
            textAlign: 'center',
          }}
        >
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: c.cardSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18 }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RowSwitch({
  icon: Icon,
  label,
  value,
  onChange,
  c,
}: {
  icon: typeof Lock;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  c: ReturnType<typeof useCycleColors>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        paddingVertical: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, minWidth: 0, paddingRight: 12 }}>
        <Icon size={18} color={c.brand} strokeWidth={2.1} style={{ marginTop: 2 }} />
        <Text
          style={{
            color: c.ink,
            fontWeight: '700',
            marginLeft: 10,
            flex: 1,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.cta, false: c.creamDeep }}
        thumbColor="#fff"
      />
    </View>
  );
}
