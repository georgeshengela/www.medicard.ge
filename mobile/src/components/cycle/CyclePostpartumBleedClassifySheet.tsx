import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  date: string | null;
  classified: boolean;
  onClose: () => void;
  onComplete: () => void;
};

export function CyclePostpartumBleedClassifySheet({ visible, date, classified, onClose, onComplete }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSaving(false);
  }, [visible, date, classified]);

  const confirm = async () => {
    if (!date) return;
    setSaving(true);
    setError(null);
    try {
      if (classified) await api.cycle.unclassifyPostpartumBleed(date);
      else await api.cycle.classifyPostpartumBleed(date);
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
          style={{ flex: 1, backgroundColor: c.overlay }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
        />
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 22,
            paddingTop: 18,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            borderTopWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 18,
              lineHeight: 24,
            }}
          >
            {classified ? ka.cycle.postpartumUnclassify : ka.cycle.postpartumClassifyTitle}
          </Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }}>
            {classified ? ka.cycle.postpartumUnclassifyBody : ka.cycle.postpartumClassifyBody}
          </Text>
          {error ? (
            <Text style={{ color: c.period, fontSize: 13, lineHeight: 19, marginTop: 10 }}>{error}</Text>
          ) : null}
          <Pressable
            onPress={() => void confirm()}
            disabled={saving || !date}
            accessibilityRole="button"
            accessibilityLabel={classified ? ka.cycle.postpartumUnclassify : ka.cycle.postpartumClassifyConfirm}
            style={{
              minHeight: 48,
              borderRadius: 14,
              backgroundColor: c.cta,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 18,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                {classified ? ka.cycle.postpartumUnclassify : ka.cycle.postpartumClassifyConfirm}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ka.common.close}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
          >
            <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
              {ka.common.close}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
