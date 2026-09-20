import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { ChatScreenShell, ChatFormScroll } from '@/components/chat/ChatScreenShell';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Activity, CalendarDays, Check, Droplets, Heart, Smile } from 'lucide-react-native';
import { CycleVisualChoice, CycleLogSectionHeading } from './CycleVisualChoice';
import { CyclePrimaryButton } from './CycleUI';
import { CycleObservationIcon } from './CycleObservationIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CycleFlowPicker } from '@/components/cycle/CycleFlowPicker';
import { CycleTestResultRow } from '@/components/cycle/CycleTestResultRow';
import { CycleMoreTracking } from '@/components/cycle/CycleMoreTracking';
import { CyclePainEditor } from '@/components/cycle/CycleObservationFields';
import { CyclePregnancyQuickLog } from '@/components/cycle/CyclePregnancyQuickLog';
import { CyclePerimenopauseQuickLog } from '@/components/cycle/CyclePerimenopauseQuickLog';
import { CyclePostpartumQuickLog } from '@/components/cycle/CyclePostpartumQuickLog';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { MOOD_OPTIONS, MUCUS_OPTIONS, PHYSICAL_SYMPTOMS } from '@/constants/cycle';
import { recentObservationKeys } from '@/lib/cycleObservationRegistry';
import { PAIN_MANAGED_SYMPTOM_IDS } from '@/lib/cycleObservations';
import { ka } from '@/i18n/ka';
import { EMPTY_CYCLE_LOG, formFromCycleLog, isBleedFlow, persistCycleLog } from '@/lib/cycleLogSave';
import { applySymptomChipToggle } from '@/lib/cycleObservationAssessment';
import { loadCycleView, type CycleView } from '@/lib/cycleOffline';
import { cyclePresentationModeKnown } from '@/lib/cycleHistoryCopy';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';

const QUICK_SYMPTOMS = PHYSICAL_SYMPTOMS.filter((o) =>
  ['bloating', 'fatigue', 'nausea'].includes(o.id) && !PAIN_MANAGED_SYMPTOM_IDS.has(o.id),
);
const QUICK_MOODS = MOOD_OPTIONS.filter((o) =>
  ['calm', 'happy', 'irritable', 'tired_mood'].includes(o.id),
);

type Props = {
  visible: boolean;
  date: string;
  onClose: () => void;
  onSaved: (view?: CycleView | null) => void;
  isPeriodStart?: boolean;
  onOpenFull?: () => void;
};

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

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
  const [recentIds, setRecentIds] = useState<string[]>([]);
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
        setRecentIds(recentObservationKeys(view.display.logs, { limit: 4, minDays: 2 }));
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
                {ka.cycle.quickLogTitle}
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
                  {saveError ? <CyclePrimaryButton label="ხელახლა ცდა" onPress={() => setLoadAttempt(n => n + 1)}/> : null}
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
                <View>
              <CycleLogSectionHeading icon={Droplets}>{ka.cycle.flow}</CycleLogSectionHeading>
              <CycleFlowPicker
                value={form.flow}
                disabled={saving}
                onChange={(id) => setForm((prev) => ({ ...prev, flow: id }))}
              />

              {caps.showFertilityShortcuts ? (
                <View style={{ marginTop: 14 }}>
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    {ka.cycle.ttcQuickLogTitle}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
                    {ka.cycle.ttcOpkHint}
                  </Text>
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      marginBottom: 8,
                    }}
                  >
                    {ka.cycle.ovulationTest}
                  </Text>
                  <CycleTestResultRow
                    value={form.ovulationTest}
                    onChange={(ovulationTest) => setForm((prev) => ({ ...prev, ovulationTest }))}
                  />
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    {ka.cycle.bbt}
                  </Text>
                  <TextInput
                    value={form.bbt}
                    onChangeText={(bbt) => setForm((prev) => ({ ...prev, bbt }))}
                    keyboardType="decimal-pad"
                    placeholder="36.6"
                    placeholderTextColor={c.mutedSoft}
                    accessibilityLabel={ka.cycle.bbt}
                    style={{
                      minHeight: 44,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: c.controlBorder,
                      backgroundColor: c.cardSoft,
                      color: c.ink,
                      paddingHorizontal: 12,
                      fontSize: 16,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                    }}
                  />
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    {ka.cycle.mucus}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {MUCUS_OPTIONS.map((opt) => {
                      const on = form.mucus === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => undefined);
                            setForm((prev) => ({ ...prev, mucus: on ? null : opt.id }));
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={opt.label}
                          style={{
                            minHeight: 44,
                            paddingHorizontal: 12,
                            borderRadius: 14,
                            justifyContent: 'center',
                            backgroundColor: on ? c.card : c.cardSoft,
                            borderWidth: 1,
                            borderColor: on ? c.brand : c.border,
                          }}
                        >
                          <Text style={{ color: c.ink, fontSize: 13 }}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    {ka.cycle.pregnancyTest}
                  </Text>
                  <CycleTestResultRow
                    value={form.pregnancyTest}
                    onChange={(pregnancyTest) => setForm((prev) => ({ ...prev, pregnancyTest }))}
                  />
                </View>
              ) : null}

              <CycleLogSectionHeading icon={Activity}>{ka.cycle.pain}</CycleLogSectionHeading>
              <CyclePainEditor
                compact
                entries={form.painEntries}
                onChange={(painEntries) => setForm((prev) => ({ ...prev, painEntries }))}
              />

              <CycleLogSectionHeading icon={Smile}>{ka.cycle.moods}</CycleLogSectionHeading>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_MOODS.map((opt) => {
                  const on = form.moods.includes(opt.id);
                  return (
                    <CycleVisualChoice key={opt.id} id={opt.id} label={opt.label} selected={on} disabled={saving}
                      onPress={() => setForm((prev) => ({ ...prev, moods: toggle(prev.moods, opt.id) }))} />
                  );
                })}
              </View>

              <CycleLogSectionHeading icon={Heart}>{ka.cycle.symptoms}</CycleLogSectionHeading>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(recentIds.length
                  ? PHYSICAL_SYMPTOMS.filter((o) => recentIds.includes(o.id) && !PAIN_MANAGED_SYMPTOM_IDS.has(o.id))
                  : QUICK_SYMPTOMS
                ).map((opt) => {
                  const on = form.symptoms.includes(opt.id);
                  return (
                    <CycleVisualChoice key={opt.id} id={opt.id} label={opt.label} selected={on} disabled={saving}
                      onPress={() => setForm((prev) => ({ ...prev, ...applySymptomChipToggle(prev, opt.id) }))} />
                  );
                })}
              </View>
                </View>
              )}

              <View style={{ marginTop: 16 }}>
                <CycleMoreTracking
                  form={form}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                  compact
                  mode={mode || undefined}
                />
              </View>

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
