import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { HydrationCheck, HydrationDrop } from '@/components/hydration/HydrationIcons';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { ka } from '@/i18n/ka';

type Props = {
  visible: boolean;
  ml: number;
  onClose: () => void;
};

export function WaterLoggedModal({ visible, ml, onClose }: Props) {
  const T = useFigmaHydration();
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View
          style={{
            backgroundColor: T.pageBg,
            borderRadius: 32,
            padding: 16,
            gap: 24,
            borderWidth: 1,
            borderColor: T.border,
          }}
        >
          <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
            <HydrationDrop size={88} color={T.waterMid} />
            <View style={{ position: 'absolute', bottom: 36, right: 110 }}>
              <HydrationCheck size={40} />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 24,
                lineHeight: 32,
                textAlign: 'center',
                color: T.textPrimary,
              }}
            >
              {ka.hydration.loggedTitle}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 16,
                lineHeight: 24,
                textAlign: 'center',
                color: T.textSecondary,
              }}
            >
              {ka.hydration.loggedBody(`${ml} ml`)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={{
              minHeight: 48,
              borderRadius: 16,
              backgroundColor: T.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>
              {ka.hydration.loggedOk}
            </Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={{
            alignSelf: 'center',
            marginTop: 16,
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: T.textPrimary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={28} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      </View>
    </Modal>
  );
}
