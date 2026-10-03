/**
 * `/cycle/settings/reminders` — შეხსენებები (W2-9): every cycle reminder switch with its lock-screen
 * example (brief §9 item 5) and the „hide cycle text“ mask. Switches save at once, like reminders
 * always persisted on the device: the local prefs are written immediately, the server copy
 * (`reminderPrefs`) and the scheduled notifications follow a moment later (one write per burst of taps).
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, CalendarClock, EyeOff, Heart, NotebookPen, Sparkles } from 'lucide-react-native';
import { CycleNotificationMaskPreview } from '@/components/cycle/CycleNotificationMaskPreview';
import { CycleAtmosphere, CycleCard, CycleLoading, CycleSection, cycleNavHeader } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type CycleBundle } from '@/lib/api';
import {
  DEFAULT_CYCLE_REMINDER_PREFS,
  getCycleReminderPrefs,
  setCycleReminderPrefs,
  type CycleReminderPrefs,
} from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { CYCLE_MASK_STYLES, maskStyleLabel } from '@/lib/cycleNotificationMask';
import { getEffectiveCycleMask } from '@/lib/cycleNotificationContract.js';
import { cycleTrackingFromBundle } from '@/lib/cycleForecastEligibility';
import { putCycleBundle } from '@/lib/cycleViewCache';
import { useCycleColors } from '@/theme/cycle';
import {
  ReminderExample,
  SettingsDivider,
  SettingsPill,
  SettingsRowSwitch,
  SettingsStepper,
  serverReminderPrefs,
  useCycleSettingsView,
} from './CycleSettingsKit';

/** Keys the server keeps in `reminderPrefs` (the rest live on the device only). */
const SERVER_KEYS: (keyof CycleReminderPrefs)[] = ['enabled', 'periodDaysBefore', 'ovulation', 'dailyLog', 'pms', 'opk', 'bbt'];
const PERSIST_DELAY_MS = 600;

export function CycleReminderSettings() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId, bundle, canonical, settled, loading } = useCycleSettingsView();
  const [prefs, setPrefs] = useState<CycleReminderPrefs | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'success' | 'error'>('success');

  const prefsRef = useRef<CycleReminderPrefs>(DEFAULT_CYCLE_REMINDER_PREFS);
  const serverDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<CycleBundle | null>(null);
  sourceRef.current = canonical ?? bundle;

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.settingsReminders));
  }, [navigation, c]);

  const mode = bundle?.profile.mode ?? null;
  useEffect(() => {
    if (prefs || !settled) return;
    let alive = true;
    void getCycleReminderPrefs({ mode }).then((next) => {
      if (!alive) return;
      prefsRef.current = next;
      setPrefs(next);
    });
    return () => {
      alive = false;
    };
  }, [prefs, settled, mode]);

  /** Server copy + re-planned notifications for the latest prefs. Never throws. */
  const persist = useCallback(async () => {
    timer.current = null;
    const current = prefsRef.current;
    let source = sourceRef.current;
    try {
      if (serverDirty.current) {
        serverDirty.current = false;
        const data = await api.cycle.updateProfile({ reminderPrefs: serverReminderPrefs(current) });
        source = data;
        if (userId) putCycleBundle(userId, data);
      }
    } catch {
      // The device copy is saved; the server copy is retried with the next change.
      serverDirty.current = true;
      setMsgTone('error');
      setMsg(tx('შეხსენებები ტელეფონზე შეინახა. სერვერთან სინქრონი მოგვიანებით.', 'Reminders are saved on this phone. Server sync will retry later.'));
    }
    if (!source) return;
    try {
      const count = await syncCycleReminders(source, current);
      if (!serverDirty.current) {
        setMsgTone('success');
        setMsg(current.enabled && count > 0 ? ka.cycle.remindersScheduled(count) : tx('შენახულია', 'Saved'));
      }
    } catch {
      /* Scheduling is retried by the foreground reconcile. */
    }
  }, [userId]);

  // Leaving the screen flushes a pending write at once.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void persist();
      }
    },
    [persist],
  );

  const update = (patch: Partial<CycleReminderPrefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    setMsg(null);
    if (SERVER_KEYS.some((key) => key in patch)) serverDirty.current = true;
    void setCycleReminderPrefs(patch).catch(() => undefined);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), PERSIST_DELAY_MS);
  };

  if (!prefs) {
    if (loading || !settled) return <CycleLoading />;
  }
  const reminders = prefs ?? DEFAULT_CYCLE_REMINDER_PREFS;
  const tracking = cycleTrackingFromBundle(bundle);
  const privacy = Boolean(bundle?.profile.privacyEnabled);

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
          {tx(
            'ცვლილება მაშინვე ინახება. ქვემოთ ხედავ ზუსტ ტექსტს, რომელიც ჩაკეტილ ეკრანზე გამოჩნდება.',
            'Changes save at once. Below each switch is the exact text your lock screen will show.',
          )}
        </Text>
        {/* Fixed-height status line: a save never shifts the switches under her finger. */}
        <View style={{ minHeight: 20, marginTop: -10, marginBottom: 8 }} accessibilityLiveRegion="polite">
          {msg ? (
            <Text
              style={{
                color: msgTone === 'error' ? c.danger : c.success,
                fontSize: 12,
                lineHeight: 17,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
              }}
            >
              {msgTone === 'success' ? '✓ ' : ''}
              {msg}
            </Text>
          ) : null}
        </View>

        <CycleSection title={tx('მენსტრუაციის შეხსენებები', 'Period reminders')} subtitle={ka.cycle.remindersHint}>
          <CycleCard>
            <SettingsRowSwitch
              icon={Bell}
              label={ka.cycle.remindersEnabled}
              value={reminders.enabled}
              onChange={(v) => update({ enabled: v })}
              c={c}
            />
            {reminders.enabled && tracking.trackingOnly ? (
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
                {tx(
                  'მენსტრუაციის შეხსენებები არ მოვა, სანამ „მენსტრუაციას არ ველი“ ჩართულია.',
                  'Period reminders are off while “I don’t expect periods” is on.',
                )}
              </Text>
            ) : null}
            {reminders.enabled && !tracking.trackingOnly ? (
              <>
                <SettingsDivider c={c} />
                <SettingsStepper
                  label={ka.cycle.remindersPeriodBefore}
                  value={reminders.periodDaysBefore}
                  min={0}
                  max={5}
                  onChange={(n) => update({ periodDaysBefore: n })}
                  c={c}
                />
                {reminders.periodDaysBefore > 0 ? (
                  <ReminderExample type="period_soon" periodDaysBefore={reminders.periodDaysBefore} c={c} />
                ) : null}
                <SettingsDivider c={c} />
                <SettingsRowSwitch icon={Heart} label={ka.cycle.remindersPeriodDay} value c={c} />
                <ReminderExample type="period_start" c={c} />
                <SettingsDivider c={c} />
                <SettingsRowSwitch
                  icon={CalendarClock}
                  label={ka.cycle.remindersPeriodLate}
                  hint={ka.cycle.remindersPeriodLateHint}
                  value={reminders.periodLate}
                  onChange={(v) => update({ periodLate: v })}
                  c={c}
                />
                <ReminderExample type="period_late" c={c} />
              </>
            ) : null}
          </CycleCard>
        </CycleSection>

        {reminders.enabled ? (
          <CycleSection title={ka.cycle.remindersOptionalTitle} subtitle={ka.cycle.remindersOptionalHint}>
            <CycleCard>
              {/* Fertile-days display off: ovulation and the ovulation-based PMS reminder are never scheduled. */}
              {tracking.fertility.effective === 'on' ? (
                <>
                  <SettingsRowSwitch
                    icon={Sparkles}
                    label={ka.cycle.remindersOvulation}
                    value={reminders.ovulation}
                    onChange={(v) => update({ ovulation: v })}
                    c={c}
                  />
                  <ReminderExample type="ovulation" c={c} />
                  <SettingsDivider c={c} />
                  <SettingsRowSwitch
                    icon={Heart}
                    label={ka.cycle.remindersPms}
                    value={reminders.pms}
                    onChange={(v) => update({ pms: v })}
                    c={c}
                  />
                  <ReminderExample type="pms" c={c} />
                  <SettingsDivider c={c} />
                </>
              ) : null}
              <SettingsRowSwitch
                icon={NotebookPen}
                label={ka.cycle.remindersDailyLog}
                value={reminders.dailyLog}
                onChange={(v) => update({ dailyLog: v })}
                c={c}
              />
              <ReminderExample type="log_nudge" c={c} />
              {mode === 'TRY_TO_CONCEIVE' ? (
                <>
                  <SettingsDivider c={c} />
                  <SettingsRowSwitch
                    icon={Sparkles}
                    label={ka.cycle.remindersOpk}
                    hint={ka.cycle.remindersOpkHint}
                    value={reminders.opk}
                    onChange={(v) => update({ opk: v })}
                    c={c}
                  />
                  <ReminderExample type="opk" c={c} />
                  <SettingsDivider c={c} />
                  <SettingsRowSwitch
                    icon={Heart}
                    label={ka.cycle.remindersBbt}
                    value={reminders.bbt}
                    onChange={(v) => update({ bbt: v })}
                    c={c}
                  />
                  <ReminderExample type="bbt" c={c} />
                </>
              ) : null}
            </CycleCard>
          </CycleSection>
        ) : null}

        <CycleSection title={tx('ჩაკეტილი ეკრანი', 'Lock screen')}>
          <CycleCard>
            <SettingsRowSwitch
              icon={EyeOff}
              label={ka.cycle.maskEnabled}
              value={reminders.maskNotifications}
              onChange={(v) => update({ maskNotifications: v })}
              c={c}
            />
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 8 }}>
              {privacy && !reminders.maskNotifications ? ka.cycle.maskForcedByPrivacy : ka.cycle.maskHint}
            </Text>
            <CycleNotificationMaskPreview
              maskEnabled={getEffectiveCycleMask({ privacyEnabled: privacy, maskNotifications: reminders.maskNotifications }).masked}
              maskStyle={reminders.maskStyle}
            />
            {reminders.maskNotifications ? (
              <>
                <SettingsDivider c={c} gap={14} />
                <Text style={{ color: c.ink, fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold', marginBottom: 10 }}>
                  {ka.cycle.maskStyleLabel}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CYCLE_MASK_STYLES.map((style) => (
                    <SettingsPill
                      key={style}
                      label={maskStyleLabel(style)}
                      selected={reminders.maskStyle === style}
                      onPress={() => update({ maskStyle: style })}
                      c={c}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </CycleCard>
        </CycleSection>

      </ScrollView>
    </CycleAtmosphere>
  );
}
