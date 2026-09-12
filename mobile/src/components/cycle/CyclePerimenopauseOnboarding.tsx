import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CyclePerimenopauseOnboarding({ visible, onClose, onConfirm }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
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
            maxHeight: '88%',
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
              {ka.cycle.periOnboardTitle}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 12 }}>
              {ka.cycle.periOnboardWhat}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.periOnboardHistory}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.periOnboardEstimates}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
              {ka.cycle.periOnboardDisclaimer}
            </Text>
          </ScrollView>
          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel={ka.cycle.periOnboardDone}
            style={{
              minHeight: 48,
              borderRadius: 16,
              backgroundColor: c.cta,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
            }}
          >
            <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
              {ka.cycle.periOnboardDone}
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ka.common.close}
            style={{
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
              {ka.common.close}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
