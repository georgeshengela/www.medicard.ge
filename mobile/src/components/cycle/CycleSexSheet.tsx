import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, Heart, X } from 'lucide-react-native';
import { ChatFormScroll, ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { CyclePressable as Pressable } from './CyclePressable';
import { CyclePrimaryButton, formatCycleDateKa } from './CycleUI';
import { CycleSexSection } from './CycleSexSection';
import { useCycleDayForm } from './useCycleDayForm';
import { ka } from '@/i18n/ka';
import { persistCycleLog } from '@/lib/cycleLogSave';
import type { CycleView } from '@/lib/cycleOffline';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

/**
 * Sex and sex drive on their own (owner request 2026-09-29): a small private sheet, separate from the
 * daily log. It fills from the day's full log in the shared cached cycle view (no download behind a
 * spinner on every open — CYC-09) and saves it back whole, so nothing else is overwritten.
 */
export function CycleSexSheet({
  visible,
  date,
  onClose,
  onSaved,
}: {
  visible: boolean;
  date: string;
  onClose: () => void;
  onSaved: (view?: CycleView | null) => void;
}) {
  const { user } = useAuth();
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  // `base` = the day as stored when the sheet filled (Apple Health / Health Connect get only what a save changes).
  const { form, setForm, base, hydrated, loadError } = useCycleDayForm({ active: visible, date, userId: user?.id });
  const [saving, setSaving] = useState(false);
  const [saveError, setError] = useState<string | null>(null);
  const error = saveError ?? loadError;
  const task = useAnalysisTask(`cycle-sex:${user?.id}:${date}:${visible}`);

  useEffect(() => {
    if (!visible || !user?.id) return;
    setError(null);
    setSaving(false);
  }, [visible, date, user?.id]);

  const save = async () => {
    if (!hydrated || saving || !user?.id) return;
    const ticket = task.begin();
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      const result = await persistCycleLog(user.id, date, form, { base });
      if (!ticket.current()) return;
      if (!result.view && !result.synced && !result.persistedLocally && !result.sessionOnly) {
        setError(ka.cycle.saveNotPersisted);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onSaved(result.view);
      onClose();
    } catch (err) {
      if (ticket.current()) setError(err instanceof Error ? err.message : ka.cycle.saveNotPersisted);
    } finally {
      if (ticket.current()) setSaving(false);
      ticket.finish();
    }
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <ChatScreenShell header={null} style={{ backgroundColor: c.overlay }}>
        <View style={{ flex: 1, minHeight: 0, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={onClose} style={{ position: 'absolute', inset: 0 }} />
          <View
            accessibilityViewIsModal
            accessibilityLabel={ka.cycle.sexSectionTitle}
            style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', maxHeight: '90%' }}
          >
            <ChatFormScroll style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.periodSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Heart size={18} color={c.period} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontSize: 18, lineHeight: 25, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{ka.cycle.sexSectionTitle}</Text>
                  <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17 }}>{formatCycleDateKa(date)}</Text>
                </View>
                <Pressable
                  onPress={onClose}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={ka.common.close}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.cardSoft, alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} color={c.muted} />
                </Pressable>
              </View>
              {hydrated ? (
                <CycleSexSection hideHeading form={form} disabled={saving} onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))} />
              ) : (
                <View style={{ minHeight: 160, alignItems: 'center', justifyContent: 'center' }}>
                  {!error ? <ActivityIndicator color={c.brand} /> : null}
                </View>
              )}
              {error ? <Text style={{ color: c.danger, fontSize: 13, lineHeight: 18, marginTop: 12 }}>{error}</Text> : null}
            </ChatFormScroll>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
              <CyclePrimaryButton label={ka.cycle.saveLog} onPress={() => void save()} loading={saving} disabled={!hydrated || saving} icon={Check} />
            </View>
          </View>
        </View>
      </ChatScreenShell>
    </Modal>
  );
}
