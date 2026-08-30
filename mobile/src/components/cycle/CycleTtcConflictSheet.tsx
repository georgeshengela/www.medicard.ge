import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  onKeepTtc: () => void;
  onSwitchTrack: () => void;
  onClose: () => void;
};

export function CycleTtcConflictSheet({ visible, onKeepTtc, onSwitchTrack, onClose }: Props) {
  const c = useCycleColors();
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 22,
            borderTopWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18 }}>
            {ka.cycle.contraceptionTtcTitle}
          </Text>
          <Text
            style={{
              color: c.muted,
              marginTop: 10,
              lineHeight: 20,
              fontFamily: 'NotoSansGeorgian_400Regular',
            }}
          >
            {ka.cycle.contraceptionTtcBody}
          </Text>
          <Pressable
            onPress={onKeepTtc}
            style={{ marginTop: 20, backgroundColor: c.cta, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.contraceptionKeepTtc}</Text>
          </Pressable>
          <Pressable
            onPress={onSwitchTrack}
            style={{
              marginTop: 10,
              backgroundColor: c.cardSoft,
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>
              {ka.cycle.contraceptionSwitchTrack}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
