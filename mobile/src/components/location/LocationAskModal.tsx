import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';
import {
  ProfileSetupLinkButton,
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

type Props = {
  visible: boolean;
  busy?: boolean;
  onEnable: () => void;
  onSkip: () => void;
};

export function LocationAskModal({ visible, busy, onEnable, onSkip }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={busy ? undefined : onSkip}>
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.profileSetup.locationAskLater}
          onPress={busy ? undefined : onSkip}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
        />

        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 20),
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: colors.bg300,
              padding: 22,
              gap: 20,
              zIndex: 2,
              elevation: 16,
            }}
          >
            <View style={{ alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: `${colors.primary200}18`,
                  borderWidth: 1,
                  borderColor: `${colors.primary200}44`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MapPin size={34} color={colors.primary200} strokeWidth={2} />
              </View>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 24,
                  lineHeight: 32,
                  color: colors.text100,
                  textAlign: 'center',
                }}
              >
                {ka.profileSetup.locationAskTitle}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 15,
                  lineHeight: 24,
                  color: colors.text200,
                  textAlign: 'center',
                }}
              >
                {ka.profileSetup.locationAskBody}
              </Text>
            </View>

            <ProfileSetupPrimaryButton
              label={ka.profileSetup.locationAskEnable}
              onPress={onEnable}
              loading={busy}
              icon="check"
            />
            <ProfileSetupLinkButton label={ka.profileSetup.locationAskLater} onPress={onSkip} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
