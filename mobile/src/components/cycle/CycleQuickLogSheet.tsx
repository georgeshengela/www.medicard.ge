import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { ChatScreenShell, ChatFormScroll } from '@/components/chat/ChatScreenShell';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  useWindowDimensions,
  View} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, CalendarDays, Check } from 'lucide-react-native';
import { CyclePrimaryButton } from './CycleUI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { CycleSexSection } from '@/components/cycle/CycleSexSection';
import { CycleMoreTracking } from '@/components/cycle/CycleMoreTracking';
import { CycleQuickLogBody } from '@/components/cycle/CycleQuickLogBody';
import { CyclePregnancyQuickLog } from '@/components/cycle/CyclePregnancyQuickLog';
import { CyclePerimenopauseQuickLog } from '@/components/cycle/CyclePerimenopauseQuickLog';
import { CyclePostpartumQuickLog } from '@/components/cycle/CyclePostpartumQuickLog';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { expectationsFromBundle, type CycleExpectation } from '@/lib/cycleExpectations';
import { EMPTY_CYCLE_LOG, formFromCycleLog, isBleedFlow, persistCycleLog } from '@/lib/cycleLogSave';
import { loadCycleView, type CycleView } from '@/lib/cycleOffline';
import { cyclePresentationModeKnown } from '@/lib/cycleHistoryCopy';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import type { CycleLog } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';

type Props = {
  visible: boolean;
  date: string;
  onClose: () => void;
  onSaved: (view?: CycleView | null) => void;
  isPeriodStart?: boolean;
  onOpenFull?: () => void;
};

export function CycleQuickLogSheet({
  visible,
  date,
  onClose,
  onSaved,
  isPeriodStart,
  onOpenFull,
}: Props) {
  const { user } = useAuth();
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [form, setForm] = useState<CycleLogForm>(EMPTY_CYCLE_LOG);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const caps = cyclePresentationModeKnown(mode) ? cycleModeCapabilities(mode) : null;
  const [logs, setLogs] = useState<CycleLog[]>([]);
  const [expected, setExpected] = useState<CycleExpectation[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const saveTask = useAnalysisTask(`cycle-quick:${user?.id}:${date}:${visible}`);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    if (!user?.id) return;
    setSaveError(null);
    setSaving(false);
    setHydrated(false);
    setMode(null);
    void loadCycleView(user.id)
      .then((view) => {
        if (!alive) return;
        setForm(formFromCycleLog(view.display.logs.find((l) => l.date === date)));
        setMode(view.display.profile.mode);
        setLogs(view.display.logs);
        setExpected(expectationsFromBundle(view.display, date));
        setHydrated(true);
      })
      .catch(() => {
        if (!alive) return;
        setSaveError(ka.cycle.assessmentLoadError);
        setHydrated(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, date, user?.id, loadAttempt]);

  const save = async (markStart?: boolean) => {
    if (!visible || !hydrated || saving) return;
    const ticket = saveTask.begin();
    if (!ticket) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = {
        ...form,
        flow:
          markStart && !isBleedFlow(form.flow)
            ? 'medium'
            : form.flow,
      };
      if (!user?.id) return;
      const result = await persistCycleLog(user.id, date, next, { markStart });
      if (!ticket.current()) return;
      if (!result.view && !result.synced && !result.persistedLocally && !result.sessionOnly) {
        setSaveError(ka.cycle.saveNotPersisted);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onSaved(result.view);
      onClose();
    } catch (err) {
      if (ticket.current()) setSaveError(err instanceof Error ? err.message : ka.cycle.saveNotPersisted);
    } finally {
      if (ticket.current()) setSaving(false);
      ticket.finish();
    }
  };

  const sheetPad = Math.max(insets.bottom, 16) + (fontScale >= 1.3 ? 40 : 16);

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <ChatScreenShell header={null} style={{ backgroundColor: c.overlay }}>
        <View style={{ flex: 1, minHeight: 0, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={onClose} style={{ position: 'absolute', inset: 0 }} />
          <View role="dialog" aria-modal={true} accessibilityLabel={ka.cycle.quickLogTitle} accessibilityViewIsModal
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
              maxHeight: fontScale >= 1.5 ? '94%' : fontScale >= 1.3 ? '90%' : '92%',
              borderTopWidth: 1,
              borderColor: c.border,
            }}
          >
            <ChatFormScroll style={{ flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            >
              <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
              <View style={{width:30,height:34,borderRadius:12,backgroundColor:c.accentSoft,alignItems:'center',justifyContent:'center'}}><CalendarDays size={18} color={c.brand}/></View>
              <Text style={{ flex:1, color: c.ink, fontSize: 18, lineHeight:26, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                {ka.cycle.logTodayCta}
              </Text>
              <Pressable onPress={onClose} disabled={saving} accessibilityRole="button" accessibilityLabel={ka.common.close}
                style={{width:44,height:44,borderRadius:22,backgroundColor:c.cardSoft,alignItems:'center',justifyContent:'center'}}><X size={20} color={c.muted}/></Pressable>
              </View>
              {!hydrated || !caps ? (
                <View style={{ minHeight: 120, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 }}>
                  {!saveError ? <ActivityIndicator color={c.brand} /> : null}
                  <Text
                    accessibilityLabel={ka.common.loading}
                    style={{ color: c.muted, fontSize: 13, marginTop: 10 }}
                  >
                    {saveError || ka.common.loading}
                  </Text>
                  {saveError ? <CyclePrimaryButton label={tx('ხელახლა ცდა', 'Try again')} onPress={() => setLoadAttempt(n => n + 1)}/> : null}
                </View>
              ) : (
              <>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 4, marginBottom: 14 }}>
                {formatCycleDateKa(date)} ·{' '}
                {caps.showPregnancyOverview
                  ? ka.cycle.pregnancyQuickLogHint
                  : caps.showPostpartumTracking
                    ? ka.cycle.postpartumQuickLogHint
                    : caps.showPerimenopauseTracking
                      ? ka.cycle.periQuickLogHint
                      : ka.cycle.quickLogHint}
              </Text>

              {caps.showPregnancyObservations ? (
                <CyclePregnancyQuickLog
                  form={form}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                  assessmentReady={hydrated}
                />
              ) : caps.showPostpartumTracking ? (
                <CyclePostpartumQuickLog
                  form={form}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                />
              ) : caps.showPerimenopauseTracking ? (
                <CyclePerimenopauseQuickLog
                  form={form}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                  assessmentReady={hydrated}
                />
              ) : (
                <CycleQuickLogBody
                  form={form}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                  disabled={saving}
                  date={date}
                  logs={logs}
                  showFertility={Boolean(caps.showFertilityShortcuts)}
                  expected={expected}
                />
              )}

              {/* Other modes have their own quick logs; sex and sex drive follow them there. */}
              {caps.showPregnancyObservations || caps.showPostpartumTracking || caps.showPerimenopauseTracking ? (
                <CycleSexSection
                  form={form}
                  disabled={saving}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                />
              ) : null}

              {caps.showPregnancyObservations || caps.showPostpartumTracking || caps.showPerimenopauseTracking ? (
                <View style={{ marginTop: 16 }}>
                  <CycleMoreTracking
                    form={form}
                    onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                    compact
                    mode={mode || undefined}
                  />
                </View>
              ) : null}

              {saveError ? (
                <Text
                  style={{
                    color: c.danger,
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 13,
                    marginTop: 12,
                  }}
                >
                  {saveError}
                </Text>
              ) : null}


              </>
              )}
            </ChatFormScroll>
            {hydrated && caps ? <View style={{paddingHorizontal:16,paddingTop:10,paddingBottom:Math.max(insets.bottom,8),borderTopWidth:1,borderColor:c.border,backgroundColor:c.card,gap:0}}>
              <CyclePrimaryButton label={isPeriodStart && caps.showClassicCycleOverview ? ka.cycle.quickLogStart : ka.cycle.saveLog}
                loading={saving} onPress={() => void save(isPeriodStart)} icon={Check}/>
              {onOpenFull ? <Pressable onPress={onOpenFull} disabled={saving} accessibilityRole="button" accessibilityLabel={ka.cycle.fullLog}
                style={{minHeight:44,alignItems:'center',justifyContent:'center'}}>
                <Text style={{color:c.brand,fontSize:13,lineHeight:20,fontFamily:'NotoSansGeorgian_600SemiBold'}}>{ka.cycle.fullLog}</Text>
              </Pressable> : null}
            </View> : null}
          </View>
        </View>
      </ChatScreenShell>
    </Modal>
  );
}
