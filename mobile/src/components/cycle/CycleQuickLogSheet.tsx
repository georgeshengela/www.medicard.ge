import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { FLOW_OPTIONS } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { syncCycleLogToHealth } from '@/lib/healthSync';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  date: string;
  onClose: () => void;
  onSaved: () => void;
  isPeriodStart?: boolean;
};

export function CycleQuickLogSheet({ visible, date, onClose, onSaved, isPeriodStart }: Props) {
  const c = useCycleColors();
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (flow: string, markStart?: boolean) => {
    setSaving(flow);
    try {
      await api.cycle.upsertLog(date, { flow: flow as 'none' | 'spotting' | 'light' | 'medium' | 'heavy' });
      if (markStart) {
        await api.cycle.updateProfile({ lastPeriodStart: date });
      }
      await syncCycleLogToHealth({
        date,
        flow,
        bbt: null,
        cervicalMucus: null,
        isPeriodStart: markStart || (flow !== 'none' && flow !== 'spotting'),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onSaved();
      onClose();
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
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
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '800' }}>{ka.cycle.quickLogTitle}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
            {ka.cycle.quickLogHint}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FLOW_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                disabled={Boolean(saving)}
                onPress={() => save(opt.id)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: c.roseSoft,
                  opacity: pressed || saving ? 0.7 : 1,
                  minWidth: '30%',
                  flexGrow: 1,
                  alignItems: 'center',
                })}
              >
                {saving === opt.id ? (
                  <ActivityIndicator color={c.rose} />
                ) : (
                  <Text style={{ color: c.ink, fontWeight: '700', fontSize: 13 }}>{opt.label}</Text>
                )}
              </Pressable>
            ))}
          </View>
          {isPeriodStart !== false ? (
            <Pressable
              disabled={Boolean(saving)}
              onPress={() => save('medium', true)}
              style={({ pressed }) => ({
                marginTop: 12,
                backgroundColor: c.rose,
                borderRadius: 20,
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.9 : 1,
                ...cycleShadow.soft,
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{ka.cycle.quickLogStart}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
