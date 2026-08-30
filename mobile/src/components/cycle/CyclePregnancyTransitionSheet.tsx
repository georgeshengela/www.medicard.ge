import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: c.overlay }]}
        />
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            borderTopWidth: 1,
            borderColor: c.border,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.creamDeep,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>
            {ka.cycle.pregnancyTransitionTitle}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 16 }}>
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
              minHeight: 52,
              backgroundColor: c.cta,
              borderRadius: 20,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
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
          <Pressable
            onPress={onClose}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 4 }}
          >
            <Text style={{ color: c.muted, fontWeight: '700' }}>{ka.common.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
});
