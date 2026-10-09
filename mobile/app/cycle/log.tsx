import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { CycleExplainSheet } from '@/components/cycle/CycleExplainSheet';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { ChatScreenShell, useChatKeyboardOpen } from '@/components/chat/ChatScreenShell';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CycleLogTabs, type CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { EMPTY_CYCLE_LOG, formFromCycleLog, persistCycleLog } from '@/lib/cycleLogSave';
import { lastLoggedBbt } from '@/lib/cycleBbt';
import { hasCycleLogNoteMarker, takeCycleLogNote } from '@/lib/cycleLogHandoff';
import { api, ApiError, type CycleCustomTag, type CycleLog } from '@/lib/api';
import { queueRemoveCycleLog } from '@/lib/cycleOffline';
import { toggleDayTagId } from '@/lib/cycleOfflineCore';
import { useCycleView } from '@/lib/cycleViewCache';
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
import { trackCycleLogSaved } from '@/lib/funnel';
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
  // `note=1`: a drafted note waits in memory (cycleLogHandoff) — health text never rides in the URL.
  const { date: paramDate, tab: paramTab, note: noteMarker } = useLocalSearchParams<{
    date?: string;
    tab?: string;
    note?: string;
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
  /** Delete-log confirmation and the positive-pregnancy-test notice, both in the app's own sheet. */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pregPrompt, setPregPrompt] = useState(false);
  const [mode, setMode] = useState('TRACK_PERIOD');
  /** True only once the day's existing log was read — saving before that would overwrite it with blanks. */
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.logToday));
  }, [navigation, c]);

  // The day's log comes from the shared cached cycle view. The form fills once, from an answer that is
  // not being refreshed (a fresh cache hit at once, otherwise the re-read) — never from a stale copy
  // that a refresh could still change, so saving cannot overwrite the day with old values.
  const viewQuery = useCycleView(user?.id);
  const viewData = viewQuery.data;
  const viewIdle = viewQuery.fetchStatus === 'idle';
  const viewError = viewQuery.error;
  /** Where the BBT wheel starts (local, inside the cycle screens only — never fills the form by itself). */
  const lastBbt = useMemo(() => lastLoggedBbt(viewData?.display.logs as CycleLog[] | undefined, date), [viewData, date]);
  useEffect(() => {
    if (hydrated) return;
    if (!user?.id) {
      setError(ka.common.error);
      setLoading(false);
      return;
    }
    if (viewData && viewIdle) {
      const bundle = viewData.display;
      setMode(bundle.profile.mode);
      setCustomTags(bundle.customTags ?? []);
      const existing = bundle.logs.find((l) => l.date === date) as CycleLog | undefined;
      setHasLog(Boolean(existing));
      // Consume-once, account-bound: taken (and cleared) here even when the day already has a log.
      const stagedNote = hasCycleLogNoteMarker(noteMarker) ? takeCycleLogNote(user.id) : null;
      if (existing) {
        setForm(formFromCycleLog(existing));
      } else if (stagedNote) {
        setForm({ ...EMPTY_CYCLE_LOG, notes: stagedNote });
      }
      setHydrated(true);
      setLoading(false);
    } else if (!viewData && viewError && viewIdle) {
      setError(viewError instanceof ApiError ? viewError.message : ka.common.error);
      setLoading(false);
    }
  }, [hydrated, viewData, viewIdle, viewError, date, noteMarker, user?.id]);

  const patchForm = (patch: Partial<CycleLogForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const createTag = async (name: string) => {
    setCreatingTag(true);
    try {
      const result = await api.cycle.createTag({ name });
      setCustomTags(result.bundle.customTags ?? [...customTags, result.tag]);
      // A new tag is ticked only while the day has fewer than 8 (CYC-10); the picker says why otherwise.
      setForm((prev) => ({
        ...prev,
        customTagIds: prev.customTagIds.includes(result.tag.id)
          ? prev.customTagIds
          : toggleDayTagId(prev.customTagIds, result.tag.id).ids,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.cycle.customTagOnlineOnly);
    } finally {
      setCreatingTag(false);
    }
  };

  const save = async () => {
    if (saving || loading || !hydrated) return;
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
          const prefs = await getCycleReminderPrefs({ mode: result.view.canonical.profile.mode });
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
      trackCycleLogSaved('full');
      if (form.pregnancyTest === 'positive' && mode !== 'PREGNANCY') {
        // The app's own sheet instead of a native alert; closing it (any way) returns to the previous screen.
        setPregPrompt(true);
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

  /** Opens the delete confirmation sheet (the app's own, not a native alert). */
  const remove = () => setConfirmDelete(true);

  const runRemove = async () => {
    setConfirmDelete(false);
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
          lastBbt={lastBbt}
        />

        <CycleLogDock>
          <CyclePrimaryButton
            label={saving ? ka.common.loading : ka.cycle.saveLog}
            onPress={save}
            loading={saving}
            disabled={saving || !hydrated}
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
      <CycleExplainSheet
        visible={confirmDelete}
        title={ka.cycle.deleteLog}
        body={ka.cycle.deleteLogConfirm}
        accent={c.danger}
        actions={[{ label: ka.common.delete, tone: 'destructive', icon: Trash2, onPress: () => void runRemove(), loading: saving }]}
        onClose={() => setConfirmDelete(false)}
      />
      <CycleExplainSheet
        visible={pregPrompt}
        title={ka.cycle.positivePregTitle}
        body={ka.cycle.positivePregBody}
        accent={c.rose}
        sourceIds={['menstrualCycle']}
        actions={[{ label: ka.cycle.positivePregConfirm, onPress: () => { setPregPrompt(false); router.back(); } }]}
        closeLabel={ka.cycle.positivePregLater}
        onClose={() => { setPregPrompt(false); router.back(); }}
      />
    </CycleAtmosphere>
  );
}
