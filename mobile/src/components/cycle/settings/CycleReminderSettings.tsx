/**
 * `/cycle/settings/reminders` — შეხსენებები (W2-9): every cycle reminder switch with its lock-screen
 * example (brief §9 item 5) and the „hide cycle text“ mask. Switches save at once, like reminders
 * always persisted on the device: the local prefs are written immediately, the server copy
 * (`reminderPrefs`) and the scheduled notifications follow a moment later (one write per burst of taps).
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, BellOff, CalendarClock, EyeOff, Heart, NotebookPen, Smartphone, Sparkles } from 'lucide-react-native';
import { CycleNotificationMaskPreview } from '@/components/cycle/CycleNotificationMaskPreview';
import { CycleAtmosphere, CycleCard, CycleLoading, CyclePrimaryButton, CycleSection, cycleNavHeader } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type CycleBundle } from '@/lib/api';
import { onReturnToForeground } from '@/lib/appForeground';
import { getNotificationPermissionStatus, requestNotificationPermission } from '@/lib/notifications';
import { markPrimerAsked, primerCopy, primerSettingsLabel } from '@/lib/permissionPrimer';
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
import { isCompleteCycleBundle } from '@/lib/cycleOfflineCore';
import { cycleLockScreenSupported } from '@/lib/cycleWidget';
import {
  getCycleExpectedDayActivity,
  getCycleWidgetDiscreet,
  readCycleWidgetPrivacy,
  setCycleExpectedDayActivity,
  setCycleWidgetDiscreet,
} from '@/lib/cycleWidgetPrefs';
import { cycleWidgetDiscreetForced } from '@/lib/cycleWidgetSnapshot';
import { useCycleColors } from '@/theme/cycle';
import {
  ReminderExample,
  SettingsDivider,
  SettingsPill,
  SettingsRowSwitch,
  SettingsStepper,
  serverReminderPrefs,
  useCycleSettingsView,
  type CycleColors,
} from './CycleSettingsKit';

type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/**
 * Her cycle reminders cannot arrive while the phone's notifications are off: a calm note instead of a
 * bare „შენახულია“. Never asked → MEDIPILL's one-button primer („გაგრძელება“ opens the system sheet,
 * App Review 5.1.1(iv)); already refused → „პარამეტრების გახსნა“.
 */
function RemindersPermissionNote({
  kind,
  busy,
  onContinue,
  c,
}: {
  kind: 'primer' | 'settings';
  busy: boolean;
  onContinue: () => void;
  c: CycleColors;
}) {
  const settings = kind === 'settings';
  const primer = primerCopy('notifications');
  const Icon = settings ? BellOff : Bell;
  return (
    <CycleCard style={{ marginBottom: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={c.brand} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 15, lineHeight: 21, fontFamily: 'NotoSansGeorgian_700Bold' }}>
            {settings ? tx('შეტყობინებები გამორთულია', 'Notifications are off') : primer.title}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
            {settings
              ? tx(
                  'ამიტომ ციკლის შეხსენებებს ვერ მიიღებ. ჩართე შეტყობინებები ტელეფონის პარამეტრებში.',
                  'So your cycle reminders can’t reach you. Turn notifications on in your phone’s Settings.',
                )
              : primer.body}
          </Text>
        </View>
      </View>
      <CyclePrimaryButton
        label={settings ? primerSettingsLabel() : primer.cta}
        loading={busy}
        onPress={settings ? () => void Linking.openSettings().catch(() => undefined) : onContinue}
      />
    </CycleCard>
  );
}

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

  // „MEDICARD ციკლი“ widget + expected-day Live Activity (iOS, train 1.0.0.20): device switches.
  const [lockScreen] = useState(() => cycleLockScreenSupported());
  const [widgetDiscreet, setWidgetDiscreet] = useState(false);
  const [expectedDay, setExpectedDay] = useState(false);
  const [forcedBy, setForcedBy] = useState<{ lockOn: boolean | null; engageDiscreet: boolean | null }>({ lockOn: null, engageDiscreet: null });
  useEffect(() => {
    if (!lockScreen) return;
    let alive = true;
    void Promise.all([getCycleWidgetDiscreet(), getCycleExpectedDayActivity(), readCycleWidgetPrivacy(null)]).then(
      ([own, day, privacy]) => {
        if (!alive) return;
        setWidgetDiscreet(own);
        setExpectedDay(day);
        setForcedBy({ lockOn: privacy.lockOn, engageDiscreet: privacy.engageDiscreet });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [lockScreen]);

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
        // `null` (an older server: a partial body) = saved, but no fresh bundle came back: re-plan with the
        // one on screen.
        source = isCompleteCycleBundle(data) ? data : source;
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

  // The phone's notification permission — only read here (on focus and back from Settings); the system
  // sheet opens from the note's one „გაგრძელება“ button, never from an effect.
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const permissionRef = useRef<NotificationPermission | null>(null);
  const [asking, setAsking] = useState(false);
  const askingRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const readPermission = useCallback(async () => {
    if (Platform.OS === 'web') return;
    const status = await getNotificationPermissionStatus().catch(() => null);
    if (!alive.current) return;
    const was = permissionRef.current;
    permissionRef.current = status;
    setPermission(status);
    // Allowed in the phone's Settings: plan her reminders now (a grant from the sheet plans them itself).
    if (status === 'granted' && was != null && was !== 'granted' && !askingRef.current) void persist();
  }, [persist]);
  useFocusEffect(
    useCallback(() => {
      void readPermission();
    }, [readPermission]),
  );
  useEffect(() => onReturnToForeground(() => void readPermission()), [readPermission]);
  // The request is the first thing the tap does (iOS 26 shows no sheet after other awaits).
  const askPermission = () => {
    if (askingRef.current) return;
    askingRef.current = true;
    const asked = requestNotificationPermission();
    setAsking(true);
    void asked
      .catch(() => false)
      .then((granted) => {
        // A grant from the sheet re-plans every reminder itself; the read below must not plan again.
        if (granted) permissionRef.current = 'granted';
        return markPrimerAsked('notifications');
      })
      .finally(() => {
        askingRef.current = false;
        if (alive.current) setAsking(false);
        void readPermission();
      });
  };

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
  // The lock, privacy mode or hidden notifications keep the widget neutral; her own switch only adds to it.
  const widgetForced = cycleWidgetDiscreetForced({
    lockOn: forcedBy.lockOn,
    privacyEnabled: privacy,
    maskNotifications: reminders.maskNotifications,
    engageDiscreet: forcedBy.engageDiscreet,
  });

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

        {reminders.enabled && permission && permission !== 'granted' ? (
          <RemindersPermissionNote kind={permission === 'denied' ? 'settings' : 'primer'} busy={asking} onContinue={askPermission} c={c} />
        ) : null}

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
                {mode === 'PERIMENOPAUSE' ? (
                  // W3-4: the next period is only a window here — one „მალე“ before it opens, nothing else.
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
                    {tx(
                      'პერიმენოპაუზის რეჟიმში მოვა მხოლოდ ეს შეხსენება — სავარაუდო ფანჯრის დაწყებამდე. დღის და დაგვიანების შეხსენებები არ მოვა.',
                      'In perimenopause mode only this reminder comes — before the estimated window opens. No period-day or late reminders.',
                    )}
                  </Text>
                ) : null}
                {mode !== 'PERIMENOPAUSE' ? (
                <>
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
                  {/* Ovulation / fertile reminders are planned only while trying to conceive — no dead switch elsewhere. */}
                  {mode === 'TRY_TO_CONCEIVE' ? (
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
                    </>
                  ) : null}
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

        {lockScreen ? (
          <CycleSection
            title={tx('ვიჯეტი და ჩაკეტილი ეკრანი', 'Widget and lock screen')}
            subtitle={tx(
              '„MEDICARD ციკლი“ ვიჯეტი მხოლოდ მენსტრუაციას აჩვენებს — ნაყოფიერ დღეებს არასდროს.',
              'The “MEDICARD Cycle” widget shows your period only — never fertile days.',
            )}
          >
            <CycleCard>
              <SettingsRowSwitch
                icon={Smartphone}
                label={tx('ვიჯეტზე ციკლის დამალვა', 'Hide my cycle on the widget')}
                hint={
                  widgetForced
                    ? tx(
                        'ჩართულია, სანამ ციკლის დაბლოკვა, კონფიდენციალურობის რეჟიმი ან ფარული შეტყობინებები ჩართულია.',
                        'On while the cycle lock, privacy mode or hidden notifications are on.',
                      )
                    : tx('ვიჯეტზე მხოლოდ „MEDICARD“ და წერტილი გამოჩნდება.', 'The widget shows only “MEDICARD” and a dot.')
                }
                value={widgetForced || widgetDiscreet}
                disabled={widgetForced}
                onChange={(v) => {
                  setWidgetDiscreet(v);
                  void setCycleWidgetDiscreet(v).catch(() => undefined);
                }}
                c={c}
              />
              {!tracking.trackingOnly ? (
                <>
                  <SettingsDivider c={c} />
                  <SettingsRowSwitch
                    icon={CalendarClock}
                    label={tx('სავარაუდო დღე ჩაკეტილ ეკრანზე', 'Expected day on the lock screen')}
                    hint={
                      widgetForced || widgetDiscreet
                        ? tx(
                            'სავარაუდო დღეს, აპის გახსნისას, ჩაკეტილ ეკრანზე მხოლოდ „MEDICARD“ გამოჩნდება. ქრება სისხლდენის აღრიცხვისას ან არაუგვიანეს 24 საათში.',
                            'On the expected day, once you open the app, your lock screen shows only “MEDICARD”. It goes away when you log bleeding, or within 24 hours.',
                          )
                        : tx(
                            'სავარაუდო დღეს, აპის გახსნისას, ჩაკეტილ ეკრანზე მშვიდი შეხსენება დარჩება. ქრება სისხლდენის აღრიცხვისას ან არაუგვიანეს 24 საათში.',
                            'On the expected day, once you open the app, a calm note stays on your lock screen. It goes away when you log bleeding, or within 24 hours.',
                          )
                    }
                    value={expectedDay}
                    onChange={(v) => {
                      setExpectedDay(v);
                      void setCycleExpectedDayActivity(v).catch(() => undefined);
                    }}
                    c={c}
                  />
                </>
              ) : null}
            </CycleCard>
          </CycleSection>
        ) : null}
      </ScrollView>
    </CycleAtmosphere>
  );
}
