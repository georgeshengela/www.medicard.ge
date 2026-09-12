import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
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
  const suggested = useMemo(
    () => (/^\d{4}-\d\d-\d\d$/.test(lastPeriod) ? lastPeriod : ''),
    [lastPeriod],
  );
  const [referenceDate, setReferenceDate] = useState(suggested);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReferenceDate(/^\d{4}-\d{2}-\d{2}$/.test(lastPeriod) ? lastPeriod : '');
    setError(null);
    setSaving(false);
  }, [visible, lastPeriod]);

  const confirm = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
      setError(ka.cycle.pregnancyPickReference);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.cycle.updateProfile({
        mode: 'PREGNANCY',
        pregnancyConfirm: true,
        pregnancyReferenceDate: referenceDate,
        pregnancyReferenceType: referenceDate === lastPeriod ? 'LMP' : 'USER_SELECTED',
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
              {ka.cycle.pregnancyOnboardTitle}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 12 }}>
              {ka.cycle.pregnancyOnboardWhat}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.pregnancyOnboardHistory}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.pregnancyOnboardEstimates}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.pregnancyOnboardTest}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.pregnancyOnboardPrivacy}
            </Text>
            <View style={{ marginTop: 16 }}>
              <CycleDateField
                label={ka.cycle.pregnancyReference}
                value={referenceDate}
                onChange={setReferenceDate}
                placeholder={ka.cycle.pregnancyPickReference}
                range="past"
              />
            </View>
            <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 10 }}>
              {ka.cycle.pregnancyOnboardDisclaimer}
            </Text>
            {error ? (
              <Text style={{ color: c.danger, fontSize: 13, lineHeight: 18, marginTop: 10 }}>{error}</Text>
            ) : null}
          </ScrollView>
          <Pressable
            onPress={() => void confirm()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={ka.cycle.pregnancyOnboardConfirm}
            style={{
              minHeight: 48,
              borderRadius: 16,
              backgroundColor: c.cta,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
              ...cycleShadow.soft,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                {ka.cycle.pregnancyOnboardConfirm}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ka.common.cancel}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
          >
            <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{ka.common.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
