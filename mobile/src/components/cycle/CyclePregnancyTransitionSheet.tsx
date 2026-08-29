import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { addDaysToKey } from '@/lib/cyclePhase';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  lastPeriod: string;
  onClose: () => void;
  onComplete: () => void;
};

export function CyclePregnancyTransitionSheet({ visible, lastPeriod, onClose, onComplete }: Props) {
  const c = useCycleColors();
  const router = useRouter();
  const suggestedDue = useMemo(() => {
    const lmp = /^\d{4}-\d{2}-\d{2}$/.test(lastPeriod) ? lastPeriod : todayKey();
    return addDaysToKey(lmp, 280);
  }, [lastPeriod]);

  const [dueDate, setDueDate] = useState(suggestedDue);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      await api.cycle.updateProfile({
        mode: 'PREGNANCY',
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
      });
      onComplete();
      onClose();
      router.push('/cycle/pregnancy' as never);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 20,
            paddingBottom: 28,
            borderTopWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '800' }}>
            {ka.cycle.pregnancyTransitionTitle}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
            {ka.cycle.pregnancyTransitionHint}
          </Text>
          <CycleDateField
            value={dueDate}
            onChange={setDueDate}
            placeholder={ka.cycle.dueDate}
            range="due"
          />
          <Pressable
            disabled={saving}
            onPress={confirm}
            style={({ pressed }) => ({
              marginTop: 16,
              backgroundColor: c.rose,
              borderRadius: 20,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: pressed ? 0.9 : 1,
              ...cycleShadow.soft,
            })}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                {ka.cycle.pregnancyTransitionCta}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={onClose} style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: c.muted, fontWeight: '600' }}>{ka.common.cancel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
