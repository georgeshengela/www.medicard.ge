import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
};

export function CyclePostpartumReturnSheet({ visible, onClose, onComplete }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSaving(false);
  }, [visible]);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.cycle.updateProfile({ mode: 'TRACK_PERIOD' });
      onComplete();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={{ flex: 1, backgroundColor: c.overlay }}
        />
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 10,
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
              marginBottom: 14,
            }}
          />
          <Text
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 18,
              lineHeight: 24,
              marginBottom: 10,
            }}
          >
            {ka.cycle.postpartumReturnTitle}
          </Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, marginBottom: 16 }}>
            {ka.cycle.postpartumReturnBody}
          </Text>
          {error ? (
            <Text style={{ color: c.period, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>{error}</Text>
          ) : null}
          <Pressable
            onPress={() => void confirm()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={ka.cycle.postpartumReturnConfirm}
            style={{
              minHeight: 48,
              borderRadius: 16,
              backgroundColor: c.cta,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                {ka.cycle.postpartumReturnConfirm}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={onClose}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={ka.common.cancel}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
              {ka.common.cancel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
