import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Baby, Bell, CalendarPlus, Heart, Link2, Lock, Sparkles } from 'lucide-react-native';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { CycleHealthConnectCard } from '@/components/cycle/CycleHealthConnectCard';
import { CyclePregnancyTransitionSheet } from '@/components/cycle/CyclePregnancyTransitionSheet';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CyclePrimaryButton,
  CycleSection,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleBundle, type CycleCondition, type CycleMode } from '@/lib/api';
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
import { importLatestPeriodStart, syncPeriodStartToHealth } from '@/lib/healthSync';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

const MODES: { id: CycleMode; label: string; hint: string; icon: typeof Heart }[] = [
  {
    id: 'TRACK_PERIOD',
    label: ka.cycle.modePeriod,
    hint: 'პროგნოზები და სიმპტომები',
    icon: Heart,
  },
  {
    id: 'TRY_TO_CONCEIVE',
    label: ka.cycle.modeTtc,
    hint: 'ნაყოფიერი ფანჯარა · BBT',
    icon: Sparkles,
  },
  {
    id: 'PREGNANCY',
    label: ka.cycle.modePregnancy,
    hint: 'კვირები და ჩეკლისტი',
    icon: Baby,
  },
];

const CONDITIONS: { id: CycleCondition; label: string }[] = [
  { id: 'pcos', label: ka.cycle.conditionPcos },
  { id: 'endometriosis', label: ka.cycle.conditionEndo },
  { id: 'perimenopause', label: ka.cycle.conditionPeri },
];

function applyProfile(data: CycleBundle) {
  return {
    mode: data.profile.mode ?? 'TRACK_PERIOD',
    avgCycle: String(data.profile.avgCycleLength ?? 28),
    avgPeriod: String(data.profile.avgPeriodLength ?? 5),
    lastPeriod: normalizeIsoDate(data.profile.lastPeriodStart),
    dueDate: normalizeIsoDate(data.profile.dueDate),
    irregular: Boolean(data.profile.isIrregular),
    privacy: Boolean(data.profile.privacyEnabled),
    conditions: (data.profile.conditions ?? []) as CycleCondition[],
  };
}

export default function CycleSettings() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'success' | 'error'>('success');

  const [mode, setMode] = useState<CycleMode>('TRACK_PERIOD');
  const [avgCycle, setAvgCycle] = useState('28');
  const [avgPeriod, setAvgPeriod] = useState('5');
  const [lastPeriod, setLastPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
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
  });
  const [pregnancySheet, setPregnancySheet] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.settings));
  }, [navigation, c]);

  useEffect(() => {
    Promise.all([api.cycle.get(), getCycleReminderPrefs(), isCyclePrivacyLockEnabled()])
      .then(([data, remPrefs, lockOn]) => {
        setBundle(data);
        const next = applyProfile(data);
        setMode(next.mode);
        setAvgCycle(next.avgCycle);
        setAvgPeriod(next.avgPeriod);
        setLastPeriod(next.lastPeriod);
        setDueDate(next.dueDate);
        setIrregular(next.irregular);
        setPrivacy(next.privacy);
        setConditions(next.conditions);
        setReminders(remPrefs);
        setPrivacyLock(lockOn);
      })
      .catch((err) => {
        setMsgTone('error');
        setMsg(err instanceof ApiError ? err.message : ka.common.error);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const data = await api.cycle.updateProfile({
        mode,
        avgCycleLength: Math.min(45, Math.max(21, Number(avgCycle) || 28)),
        avgPeriodLength: Math.min(10, Math.max(2, Number(avgPeriod) || 5)),
        lastPeriodStart: /^\d{4}-\d{2}-\d{2}$/.test(lastPeriod) ? lastPeriod : null,
        dueDate: mode === 'PREGNANCY' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
        isIrregular: irregular,
        privacyEnabled: privacy,
        conditions,
        reminderPrefs: reminders,
      });
      setBundle(data);
      const next = applyProfile(data);
      setLastPeriod(next.lastPeriod);
      setDueDate(next.dueDate);
      if (/^\d{4}-\d{2}-\d{2}$/.test(next.lastPeriod)) {
        await syncPeriodStartToHealth(next.lastPeriod);
      }
      await setCycleReminderPrefs(reminders);
      const count = await syncCycleReminders(data, reminders);
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
    setMode(next);
  };

  const toggleCondition = (id: CycleCondition) => {
    setConditions((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const exportCalendar = async () => {
    if (!bundle) return;
    setMsg(null);
    try {
      const ics = buildCycleIcs(bundle);
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
      if (on && data.profile.partnerShareCode) {
        const url = `https://medicard.ge/api/cycle/share/${data.profile.partnerShareCode}`;
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

  if (loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ marginBottom: 20 }}>
          <LinearGradient
            colors={[c.heroFrom, c.heroTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 18,
              borderWidth: 1,
              borderColor: c.border,
              ...cycleShadow.soft,
            }}
          >
            <Text style={{ color: c.rose, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>
              {ka.cycle.settings}
            </Text>
            <Text
              style={{
                color: c.ink,
                fontSize: 20,
                fontWeight: '800',
                marginTop: 6,
                letterSpacing: -0.3,
              }}
            >
              {ka.cycle.settingsHero}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
              {ka.cycle.settingsHeroHint}
            </Text>
          </LinearGradient>
        </Animated.View>

        <CycleSection title="რეჟიმი" subtitle="აირჩიეთ თქვენი მიზანი" delay={40}>
          <View style={{ gap: 10 }}>
            {MODES.map((m, i) => {
              const on = mode === m.id;
              const Icon = m.icon;
              return (
                <Animated.View key={m.id} entering={FadeInUp.delay(60 + i * 40).duration(360)}>
                  <Pressable
                    onPress={() => pickMode(m.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: on ? c.rose : c.card,
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: on ? 0 : 1,
                      borderColor: c.border,
                      ...(on ? cycleShadow.soft : {}),
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: on ? 'rgba(255,255,255,0.2)' : c.roseSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={20} color={on ? '#fff' : c.rose} strokeWidth={2.1} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '800', fontSize: 15 }}>
                        {m.label}
                      </Text>
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
        </CycleSection>

        <CycleSection title={ka.cycle.remindersTitle} subtitle={ka.cycle.remindersHint} delay={140}>
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
              </>
            ) : null}
          </CycleCard>
        </CycleSection>

        <CycleSection title={ka.cycle.conditionsTitle} subtitle={ka.cycle.conditionsHint} delay={150}>
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
                    borderRadius: 999,
                    backgroundColor: on ? c.rose : c.card,
                    borderWidth: 1,
                    borderColor: on ? c.rose : c.border,
                  }}
                >
                  <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '700', fontSize: 13 }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </CycleSection>

        <CycleSection title="ციკლის პარამეტრები" delay={120}>
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
          </CycleCard>
        </CycleSection>

        <CycleSection
          title={ka.cycle.lastPeriod}
          subtitle={ka.cycle.onboardHint}
          delay={160}
        >
          <CycleCard delay={0}>
            <CycleDateField
              value={lastPeriod}
              onChange={setLastPeriod}
              placeholder={ka.cycle.onboardTapCalendar}
              range="past"
              variant="hero"
            />
          </CycleCard>
        </CycleSection>

        {mode === 'PREGNANCY' ? (
          <CycleSection title={ka.cycle.dueDate} subtitle="აირჩიეთ კალენდრიდან" delay={180}>
            <CycleDateField
              value={dueDate}
              onChange={setDueDate}
              placeholder={ka.cycle.pickDate}
              range="due"
            />
          </CycleSection>
        ) : null}

        <CycleSection title={ka.cycle.healthTitle} subtitle={ka.cycle.healthHint} delay={200}>
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

        <CycleCard style={{ marginBottom: 14 }} delay={240}>
          <RowSwitch
            icon={Sparkles}
            label={ka.cycle.irregular}
            value={irregular}
            onChange={setIrregular}
            c={c}
          />
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
          <RowSwitch
            icon={Lock}
            label={ka.cycle.privacy}
            value={privacy}
            onChange={setPrivacy}
            c={c}
          />
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
          <RowSwitch
            icon={Lock}
            label={ka.cycle.privacyLock}
            value={privacyLock}
            onChange={togglePrivacyLock}
            c={c}
          />
        </CycleCard>

        <CycleSection title={ka.cycle.calendarExport} subtitle={ka.cycle.calendarExportHint} delay={260}>
          <CycleCard>
            <Pressable
              onPress={exportCalendar}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <CalendarPlus size={20} color={c.rose} />
              <Text style={{ color: c.ink, fontWeight: '700', marginLeft: 10, flex: 1 }}>
                {ka.cycle.calendarExport}
              </Text>
            </Pressable>
          </CycleCard>
        </CycleSection>

        <CycleSection title={ka.cycle.partnerShare} delay={280}>
          <CycleCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Link2 size={18} color={c.lavender} />
              <Text style={{ color: c.muted, marginLeft: 8, fontSize: 13, flex: 1 }}>
                უსაფრთხო ბმული პარტნიორისთვის
              </Text>
            </View>
            {bundle?.profile.partnerShareCode ? (
              <Text
                style={{ color: c.ink, fontSize: 12, marginBottom: 12, fontWeight: '600' }}
                selectable
              >
                medicard.ge/api/cycle/share/{bundle.profile.partnerShareCode}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => toggleShare(true)}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: c.lavenderSoft,
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text numberOfLines={1} style={{ color: c.ink, fontWeight: '700', fontSize: 13 }}>
                  {ka.cycle.partnerOn}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => toggleShare(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: c.creamDeep,
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text numberOfLines={1} style={{ color: c.muted, fontWeight: '700', fontSize: 13 }}>
                  {ka.cycle.partnerOff}
                </Text>
              </Pressable>
            </View>
          </CycleCard>
        </CycleSection>

        {msg ? (
          <Text
            style={{
              color: msgTone === 'error' ? c.danger : c.success,
              marginBottom: 12,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            {msg}
          </Text>
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
          api.cycle.get().then((data) => {
            setBundle(data);
            const next = applyProfile(data);
            setDueDate(next.dueDate);
          });
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
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: c.roseSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.rose, fontWeight: '800', fontSize: 18 }}>−</Text>
        </Pressable>
        <Text
          style={{ color: c.ink, fontWeight: '800', fontSize: 20, minWidth: 28, textAlign: 'center' }}
        >
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: c.roseSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.rose, fontWeight: '800', fontSize: 18 }}>+</Text>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
        <Icon size={18} color={c.rose} strokeWidth={2.1} />
        <Text style={{ color: c.ink, fontWeight: '700', marginLeft: 10 }}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.blushDeep, false: c.creamDeep }}
        thumbColor="#fff"
      />
    </View>
  );
}
