import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

type Props = {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteAccountModal({ visible, busy, onClose, onConfirm }: Props) {
  const colors = useThemeColors();
  const [acked, setAcked] = useState(false);

  const close = () => {
    if (busy) return;
    setAcked(false);
    onClose();
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.cancel}
          onPress={close}
          style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 28,
          }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 18,
              color: colors.text100,
            }}
          >
            {ka.profile.deleteAccountTitle}
          </Text>
          <Text
            style={{
              marginTop: 10,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 14,
              lineHeight: 22,
              color: colors.text200,
            }}
          >
            {ka.profile.deleteAccountBody}
          </Text>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acked }}
            onPress={() => setAcked((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: acked ? colors.danger : colors.bg300,
                backgroundColor: acked ? colors.danger : 'transparent',
                marginTop: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {acked ? (
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>
              ) : null}
            </View>
            <Text
              style={{
                flex: 1,
                marginLeft: 10,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 13,
                lineHeight: 20,
                color: colors.text200,
              }}
            >
              {ka.profile.deleteAccountAck}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!acked || busy}
            onPress={onConfirm}
            style={{
              marginTop: 18,
              height: 48,
              borderRadius: 16,
              backgroundColor: !acked || busy ? colors.bg200 : colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 15,
                  color: !acked ? colors.text300 : '#fff',
                }}
              >
                {ka.profile.deleteAccountConfirm}
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={close}
            style={{ marginTop: 12, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 15,
                color: colors.text200,
              }}
            >
              {ka.common.cancel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
