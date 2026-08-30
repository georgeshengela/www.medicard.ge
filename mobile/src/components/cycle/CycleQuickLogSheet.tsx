import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CycleFlowPicker } from '@/components/cycle/CycleFlowPicker';
import { CycleTestResultRow } from '@/components/cycle/CycleTestResultRow';
import { CyclePainEditor } from '@/components/cycle/CycleObservationFields';
import { MOOD_OPTIONS, PHYSICAL_SYMPTOMS } from '@/constants/cycle';
import { PAIN_MANAGED_SYMPTOM_IDS } from '@/lib/cycleObservations';
import { ka } from '@/i18n/ka';
import { loadCycleView } from '@/lib/cycleOffline';
import { EMPTY_CYCLE_LOG, formFromCycleLog, isBleedFlow, persistCycleLog } from '@/lib/cycleLogSave';
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
  onSaved: () => void;
  isPeriodStart?: boolean;
  onOpenFull?: () => void;
  onOpenHub?: () => void;
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
  onOpenHub,
}: Props) {
  const { user } = useAuth();
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<CycleLogForm>(EMPTY_CYCLE_LOG);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('TRACK_PERIOD');

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    if (!user?.id) return;
    void loadCycleView(user.id).then((view) => {
      if (!alive) return;
      setForm(formFromCycleLog(view.display.logs.find((l) => l.date === date)));
      setMode(view.display.profile.mode);
    });
    return () => {
      alive = false;
    };
  }, [visible, date, user?.id]);

  const save = async (markStart?: boolean) => {
    setSaving(true);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
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
            padding: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            borderTopWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ color: c.ink, fontSize: 18, fontFamily: 'NotoSansGeorgian_700Bold' }}>
            {ka.cycle.quickLogTitle}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4, marginBottom: 14 }}>
            {ka.cycle.quickLogHint}
          </Text>

          <CycleFlowPicker
            value={form.flow}
            disabled={saving}
            onChange={(id) => setForm((prev) => ({ ...prev, flow: id }))}
          />

          {mode === 'TRY_TO_CONCEIVE' ? (
            <View style={{ marginTop: 14 }}>
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
                accent={c.fertile}
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
                placeholder="36.5"
                placeholderTextColor={c.mutedSoft}
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
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            {ka.cycle.symptoms}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_SYMPTOMS.map((opt) => {
              const on = form.symptoms.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setForm((prev) => ({ ...prev, symptoms: toggle(prev.symptoms, opt.id) }))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={opt.label}
                  style={{
                    minHeight: 40,
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
                    minHeight: 40,
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
                {isPeriodStart ? ka.cycle.quickLogStart : ka.cycle.saveLog}
              </Text>
            )}
          </Pressable>

          <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}>
            {onOpenFull ? (
              <Pressable
                onPress={onOpenFull}
                accessibilityRole="button"
                accessibilityLabel={ka.cycle.fullLog}
                style={{ flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.fullLog}</Text>
              </Pressable>
            ) : null}
            {onOpenHub ? (
              <Pressable
                onPress={onOpenHub}
                accessibilityRole="button"
                accessibilityLabel={ka.cycle.quickLogMore}
                style={{ flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.quickLogMore}</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
