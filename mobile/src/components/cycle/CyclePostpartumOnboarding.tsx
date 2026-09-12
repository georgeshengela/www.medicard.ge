import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleMode } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  fromMode: CycleMode | null;
  onClose: () => void;
  onComplete: () => void;
};

export function CyclePostpartumOnboarding({ visible, fromMode, onClose, onComplete }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const fromPregnancy = fromMode === 'PREGNANCY';
  const [referenceDate, setReferenceDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReferenceDate('');
    setError(null);
    setSaving(false);
  }, [visible]);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.cycle.updateProfile({
        mode: 'POSTPARTUM',
        postpartumConfirm: true,
        postpartumReferenceDate: /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : null,
      });
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
            maxHeight: '90%',
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 20,
                lineHeight: 28,
              }}
            >
              {ka.cycle.postpartumOnboardTitle}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 12 }}>
              {ka.cycle.postpartumOnboardWhat}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.postpartumOnboardReference}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.postpartumOnboardOutcome}
            </Text>
            {fromPregnancy ? (
              <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
                {ka.cycle.postpartumOnboardFromPregnancy}
              </Text>
            ) : null}
            <View style={{ marginTop: 16 }}>
              <CycleDateField
                label={ka.cycle.postpartumReferenceLabel}
                value={referenceDate}
                onChange={setReferenceDate}
                hint={ka.cycle.postpartumReferenceHint}
                range="past"
              />
            </View>
            {error ? (
              <Text style={{ color: c.danger, fontSize: 13, lineHeight: 20, marginTop: 10 }}>{error}</Text>
            ) : null}
          </ScrollView>
          <Pressable
            onPress={confirm}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={ka.cycle.postpartumOnboardDone}
            style={{
              minHeight: 48,
              borderRadius: 16,
              backgroundColor: c.cta,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                {ka.cycle.postpartumOnboardDone}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ka.common.close}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
          >
            <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 }}>
              {ka.common.close}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
