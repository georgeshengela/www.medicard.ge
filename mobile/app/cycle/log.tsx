import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SEXUAL_OPTIONS } from '@/constants/cycle';
import { CycleLogTabs, type CycleLogForm } from '@/components/cycle/CycleLogTabs';
import {
  CycleAtmosphere,
  CycleLoading,
  CyclePrimaryButton,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { api, ApiError, type CycleLog } from '@/lib/api';
import { syncCycleLogToHealth } from '@/lib/healthSync';
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

  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CycleLogForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState('TRACK_PERIOD');

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.logToday));
  }, [navigation, c]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bundle = await api.cycle.get();
        if (!alive) return;
        setMode(bundle.profile.mode);
        const existing = bundle.logs.find((l) => l.date === date) as CycleLog | undefined;
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
  }, [date, prefillNote]);

  const patchForm = (patch: Partial<CycleLogForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const bbtNum = form.bbt.trim() ? Number(form.bbt.replace(',', '.')) : null;
      await api.cycle.upsertLog(date, {
        flow: form.flow,
        symptoms: [...form.symptoms, ...(form.sexual ? form.sexTags : [])],
        moods: form.moods,
        sexualActivity: form.sexual,
        libido: form.libido,
        bbt: bbtNum != null && Number.isFinite(bbtNum) ? bbtNum : null,
        cervicalMucus: form.mucus,
        notes: form.notes.trim() || null,
      });
      const bundle = await api.cycle.get();
      const prefs = await getCycleReminderPrefs();
      await syncCycleReminders(bundle, prefs);
      await syncCycleLogToHealth({
        date,
        flow: form.flow,
        bbt: bbtNum != null && Number.isFinite(bbtNum) ? bbtNum : null,
        cervicalMucus: form.mucus,
        isPeriodStart: Boolean(form.flow && form.flow !== 'none' && form.flow !== 'spotting'),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {error ? (
          <Text
            style={{
              color: c.danger,
              marginHorizontal: 20,
              marginTop: 8,
              fontWeight: '600',
            }}
          >
            {error}
          </Text>
        ) : null}

        <CycleLogTabs
          date={date}
          mode={mode}
          form={form}
          onChange={patchForm}
          bottomInset={insets.bottom}
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
        </View>
      </KeyboardAvoidingView>
    </CycleAtmosphere>
  );
}
