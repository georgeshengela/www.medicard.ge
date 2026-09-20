import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { ChatScreenShell, useChatKeyboardOpen } from '@/components/chat/ChatScreenShell';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CycleLogTabs, type CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { EMPTY_CYCLE_LOG, formFromCycleLog, persistCycleLog } from '@/lib/cycleLogSave';
import { api, ApiError, type CycleCustomTag, type CycleLog } from '@/lib/api';
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
import { useCycleColors } from '@/theme/cycle';

export default function CycleLogRoute() {
  const { user } = useAuth();
  const { date } = useLocalSearchParams<{date?:string}>();
  return <CycleLogScreen key={`${user?.id}:${date}`} />;
}
function CycleLogDock({children}:{children:React.ReactNode}) {
  const c=useCycleColors(),insets=useSafeAreaInsets(),open=useChatKeyboardOpen();
  return <View style={{paddingHorizontal:20,paddingTop:12,paddingBottom:open?12:Math.max(insets.bottom,12),backgroundColor:c.cream,borderTopWidth:1,borderTopColor:c.border}}>{children}</View>;
}
function CycleLogScreen() {
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
  const task = useAnalysisTask(`cycle-log:${user?.id}:${date}`);
  const [form, setForm] = useState(EMPTY_CYCLE_LOG);
  const [customTags, setCustomTags] = useState<CycleCustomTag[]>([]);
  const [creatingTag, setCreatingTag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [hasLog, setHasLog] = useState(false);
  const [mode, setMode] = useState('TRACK_PERIOD');

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
        setCustomTags(bundle.customTags ?? []);
        const existing = bundle.logs.find((l) => l.date === date) as CycleLog | undefined;
        setHasLog(Boolean(existing));
        if (existing) {
          setForm(formFromCycleLog(existing));
        } else if (typeof prefillNote === 'string' && prefillNote.trim()) {
          setForm({ ...EMPTY_CYCLE_LOG, notes: prefillNote.trim() });
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

  const createTag = async (name: string) => {
    setCreatingTag(true);
    try {
      const result = await api.cycle.createTag({ name });
      setCustomTags(result.bundle.customTags ?? [...customTags, result.tag]);
      setForm((prev) => ({
        ...prev,
        customTagIds: prev.customTagIds.includes(result.tag.id)
          ? prev.customTagIds
          : [...prev.customTagIds, result.tag.id],
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.cycle.customTagOnlineOnly);
    } finally {
      setCreatingTag(false);
    }
  };

  const save = async () => {
    if (saving || loading) return;
    const ticket = task.begin();
    if (!ticket) return;
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      if (!user?.id) throw new ApiError(ka.common.error, 401);
      const result = await persistCycleLog(user.id, date, form);
      if (!ticket.current()) return;
      if (result.view && !result.view.stale && result.view.pendingCount === 0) {
        try {
          const prefs = await getCycleReminderPrefs();
          if (!ticket.current()) return;
          await syncCycleReminders(result.view.canonical, prefs);
        } catch { /* A reminder failure does not undo the saved journal entry. */ }
        if (!ticket.current()) return;
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
          { text: ka.cycle.positivePregConfirm, onPress: () => router.back() },
        ]);
        return;
      }
      router.back();
    } catch (err) {
      if (ticket.current()) setError(err instanceof Error ? err.message : ka.common.error);
    } finally {
      if (ticket.current()) setSaving(false);
      ticket.finish();
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
            const ticket = task.begin();
            if (!ticket) return;
            setSaving(true);
            setError(null);
            try {
              if (!user?.id) throw new ApiError(ka.common.error, 401);
              const result = await queueRemoveCycleLog(user.id, date);
              if (!ticket.current()) return;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              if (result.synced) setSaved(ka.cycle.deleteLogDone);
              else if (result.persistedLocally) setSaved(ka.cycle.savedOnDevice);
              else if (result.sessionOnly) setSaved(ka.cycle.savedSessionOnly);
              else { setError(ka.cycle.saveNotPersisted); return; }
              router.back();
            } catch (err) {
              if (ticket.current()) setError(err instanceof ApiError ? err.message : ka.common.error);
            } finally {
              if (ticket.current()) setSaving(false);
              ticket.finish();
            }
          })();
        },
      },
    ]);
  };

  if (loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <ChatScreenShell header={null} style={{ backgroundColor: c.cream }}>
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
          bottomInset={0}
          initialTab={initialTab}
          customTags={customTags}
          onCreateTag={createTag}
          creatingTag={creatingTag}
        />

        <CycleLogDock>
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
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.deleteLog}
              accessibilityState={{ disabled: saving }}
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
        </CycleLogDock>
      </ChatScreenShell>
    </CycleAtmosphere>
  );
}
