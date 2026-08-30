import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SEXUAL_OPTIONS } from '@/constants/cycle';
import { CycleLogTabs, type CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { CyclePregnancyTransitionSheet } from '@/components/cycle/CyclePregnancyTransitionSheet';
import { persistCycleLog } from '@/lib/cycleLogSave';
import { loadCycleView, queueRemoveCycleLog } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import {
  CycleAtmosphere,
  CycleLoading,
  CyclePrimaryButton,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { ApiError, type CycleLog } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

const SEX_IDS = new Set(SEXUAL_OPTIONS.map((o) => o.id));

const EMPTY_FORM: CycleLogForm = {
  flow: null,
  symptoms: [],
  moods: [],
  sexTags: [],
  sexual: false,
  libido: null,
  bbt: '',
  mucus: null,
  ovulationTest: null,
  pregnancyTest: null,
  notes: '',
};

export default function CycleLogScreen() {
  const { date: paramDate, tab: paramTab, prefillNote } = useLocalSearchParams<{
    date?: string;
    tab?: string;
    prefillNote?: string;
  }>();
  const date = useMemo(() => {
    if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) return paramDate;
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }, [paramDate]);

  const initialTab = useMemo(() => {
    if (paramTab === 'flow' || paramTab === 'feel' || paramTab === 'more') return paramTab;
    return undefined;
  }, [paramTab]);

  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CycleLogForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [hasLog, setHasLog] = useState(false);
  const [mode, setMode] = useState('TRACK_PERIOD');
  const [lastPeriod, setLastPeriod] = useState('');
  const [offerPregnancy, setOfferPregnancy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.logToday));
  }, [navigation, c]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user?.id) throw new ApiError(ka.common.error, 401);
        const view = await loadCycleView(user.id);
        if (!alive) return;
        const bundle = view.display;
        setMode(bundle.profile.mode);
        setLastPeriod(bundle.profile.lastPeriodStart || bundle.inferred.lastPeriodStart || date);
        const existing = bundle.logs.find((l) => l.date === date) as CycleLog | undefined;
        setHasLog(Boolean(existing));
        if (existing) {
          const all = existing.symptoms || [];
          setForm({
            flow: existing.flow,
            symptoms: all.filter((id) => !SEX_IDS.has(id)),
            sexTags: all.filter((id) => SEX_IDS.has(id)),
            moods: existing.moods || [],
            sexual: Boolean(existing.sexualActivity) || all.some((id) => SEX_IDS.has(id)),
            libido: existing.libido,
            bbt: existing.bbt != null ? String(existing.bbt) : '',
            mucus: existing.cervicalMucus,
            ovulationTest: existing.ovulationTest ?? null,
            pregnancyTest: existing.pregnancyTest ?? null,
            notes: existing.notes || '',
          });
        } else if (typeof prefillNote === 'string' && prefillNote.trim()) {
          setForm({ ...EMPTY_FORM, notes: prefillNote.trim() });
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : ka.common.error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [date, prefillNote, user?.id]);

  const patchForm = (patch: Partial<CycleLogForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!user?.id) throw new ApiError(ka.common.error, 401);
      const result = await persistCycleLog(user.id, date, form);
      if (result.view && !result.view.stale && result.view.pendingCount === 0) {
        const prefs = await getCycleReminderPrefs();
        await syncCycleReminders(result.view.canonical, prefs);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (result.synced) setSaved(ka.cycle.logSaved);
      else if (result.persistedLocally) setSaved(ka.cycle.savedOnDevice);
      else if (result.sessionOnly) setSaved(ka.cycle.savedSessionOnly);
      else {
        setError(ka.cycle.saveNotPersisted);
        return;
      }
      if (form.pregnancyTest === 'positive' && mode !== 'PREGNANCY') {
        Alert.alert(ka.cycle.positivePregTitle, ka.cycle.positivePregBody, [
          { text: ka.cycle.positivePregLater, style: 'cancel', onPress: () => router.back() },
          { text: ka.cycle.positivePregConfirm, onPress: () => setOfferPregnancy(true) },
        ]);
        return;
      }
      setTimeout(() => router.back(), 400);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert(ka.cycle.deleteLog, ka.cycle.deleteLogConfirm, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.common.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            setError(null);
            try {
              if (!user?.id) throw new ApiError(ka.common.error, 401);
              const result = await queueRemoveCycleLog(user.id, date);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              if (result.synced) setSaved(ka.cycle.deleteLogDone);
              else if (result.persistedLocally) setSaved(ka.cycle.savedOnDevice);
              else if (result.sessionOnly) setSaved(ka.cycle.savedSessionOnly);
              else setError(ka.cycle.saveNotPersisted);
              setTimeout(() => router.back(), 400);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : ka.common.error);
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  };

  if (loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {error ? (
          <View
            style={{
              marginHorizontal: 20,
              marginTop: 10,
              backgroundColor: `${c.danger}14`,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: c.danger, fontWeight: '600' }}>{error}</Text>
          </View>
        ) : null}
        {saved ? (
          <View
            style={{
              marginHorizontal: 20,
              marginTop: 10,
              backgroundColor: `${c.success}18`,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: c.success, fontWeight: '700' }}>{saved}</Text>
          </View>
        ) : null}

        <CycleLogTabs
          date={date}
          mode={mode}
          form={form}
          onChange={patchForm}
          bottomInset={insets.bottom + (hasLog ? 72 : 24)}
          initialTab={initialTab}
        />

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: c.cream,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          <CyclePrimaryButton
            label={saving ? ka.common.loading : ka.cycle.saveLog}
            onPress={save}
            loading={saving}
            disabled={saving}
          />
          {hasLog ? (
            <Pressable
              onPress={remove}
              disabled={saving}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                marginTop: 4,
              }}
            >
              <Text style={{ color: c.danger, fontWeight: '700' }}>{ka.cycle.deleteLog}</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <CyclePregnancyTransitionSheet
        visible={offerPregnancy}
        lastPeriod={lastPeriod}
        onClose={() => {
          setOfferPregnancy(false);
          router.back();
        }}
        onComplete={() => {
          setOfferPregnancy(false);
          setMode('PREGNANCY');
        }}
      />
    </CycleAtmosphere>
  );
}
