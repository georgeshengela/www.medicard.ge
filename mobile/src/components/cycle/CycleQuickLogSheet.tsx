import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
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

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    if (!user?.id) return;
    setSaveError(null);
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
  }, [visible, date, user?.id]);

  const save = async (markStart?: boolean) => {
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
      if (!result.view && !result.synced && !result.persistedLocally && !result.sessionOnly) {
        setSaveError(ka.cycle.saveNotPersisted);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onSaved(result.view);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const sheetPad = Math.max(insets.bottom, 16) + (fontScale >= 1.3 ? 40 : 16);

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
        >
          <Pressable
            onPress={() => undefined}
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
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20, paddingBottom: sheetPad }}
            >
              <Text style={{ color: c.ink, fontSize: 18, fontFamily: 'NotoSansGeorgian_700Bold' }}>
                {ka.cycle.quickLogTitle}
              </Text>
              {!hydrated || !caps ? (
                <View style={{ minHeight: 120, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 }}>
                  <ActivityIndicator color={c.brand} />
                  <Text
                    accessibilityLabel={ka.common.loading}
                    style={{ color: c.muted, fontSize: 13, marginTop: 10 }}
                  >
                    {ka.common.loading}
                  </Text>
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
                      borderColor: c.border,
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
                            borderColor: on ? c.ink : c.border,
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

              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 13,
                  marginTop: 16,
                  marginBottom: 8,
                }}
              >
                {ka.cycle.pain}
              </Text>
              <CyclePainEditor
                compact
                entries={form.painEntries}
                onChange={(painEntries) => setForm((prev) => ({ ...prev, painEntries }))}
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
                {ka.cycle.moods}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_MOODS.map((opt) => {
                  const on = form.moods.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setForm((prev) => ({ ...prev, moods: toggle(prev.moods, opt.id) }))}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={opt.label}
                      style={{
                        minHeight: 44,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        justifyContent: 'center',
                        backgroundColor: on ? c.cta : c.cardSoft,
                        borderWidth: 1,
                        borderColor: on ? c.ink : c.border,
                      }}
                    >
                      <Text style={{ color: on ? c.white : c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12 }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 13,
                  marginTop: 16,
                  marginBottom: 8,
                }}
              >
                {ka.cycle.symptoms}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(recentIds.length
                  ? PHYSICAL_SYMPTOMS.filter((o) => recentIds.includes(o.id) && !PAIN_MANAGED_SYMPTOM_IDS.has(o.id))
                  : QUICK_SYMPTOMS
                ).map((opt) => {
                  const on = form.symptoms.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setForm((prev) => ({ ...prev, ...applySymptomChipToggle(prev, opt.id) }))}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={opt.label}
                      style={{
                        minHeight: 44,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        justifyContent: 'center',
                        backgroundColor: on ? c.cta : c.cardSoft,
                        borderWidth: 1,
                        borderColor: on ? c.ink : c.border,
                      }}
                    >
                      <Text style={{ color: on ? c.white : c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12 }}>
                        {opt.label}
                      </Text>
                    </Pressable>
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
                    color: c.period,
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 13,
                    marginTop: 12,
                  }}
                >
                  {saveError}
                </Text>
              ) : null}

              <Pressable
                disabled={saving}
                onPress={() => void save(isPeriodStart)}
                accessibilityRole="button"
                accessibilityLabel={ka.cycle.saveLog}
                style={{
                  marginTop: 16,
                  minHeight: 48,
                  borderRadius: 14,
                  backgroundColor: c.cta,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {saving ? (
                  <ActivityIndicator color={c.white} />
                ) : (
                  <Text style={{ color: c.white, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                    {isPeriodStart && caps.showClassicCycleOverview ? ka.cycle.quickLogStart : ka.cycle.saveLog}
                  </Text>
                )}
              </Pressable>

              {onOpenFull ? (
                <Pressable
                  onPress={onOpenFull}
                  accessibilityRole="button"
                  accessibilityLabel={ka.cycle.fullLog}
                  style={{ marginTop: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.fullLog}</Text>
                </Pressable>
              ) : null}
              </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
