import React from 'react';
import { Image, Keyboard, Platform, Text, TextInput, View } from 'react-native';
import { ChevronDown, CircleHelp } from 'lucide-react-native';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/ui/KeyboardDoneAccessory';
import { FIGMA_AUTH_SHADOW } from '@/constants/figmaAuthLayout';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';
import { ka } from '@/i18n/ka';

type Props = {
  value: string;
  onChange: (digits: string) => void;
  error?: string | null;
};

function formatDisplayPhone(digits: string) {
  const d = digits.replace(/\D/g, '').replace(/^995/, '').slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/** Figma InputField Type=Country/Phone — GE +995 entry. */
export function ProfilePhoneField({ value, onChange, error }: Props) {
  const FIGMA_PROFILE_SETUP = useFigmaProfileSetup();
  return (
    <View style={{ width: '100%', gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          minHeight: FIGMA_PROFILE_SETUP.inputMinHeight,
          borderRadius: FIGMA_PROFILE_SETUP.inputRadius,
          borderWidth: 1,
          borderColor: error ? '#FCA5A5' : FIGMA_PROFILE_SETUP.inputBorder,
          backgroundColor: FIGMA_PROFILE_SETUP.inputBg,
          overflow: 'hidden',
          ...FIGMA_AUTH_SHADOW,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRightWidth: 1,
            borderRightColor: FIGMA_PROFILE_SETUP.inputBorder,
          }}
        >
          <Image
            source={{ uri: 'https://flagcdn.com/w40/ge.png' }}
            style={{ width: 20, height: 20, borderRadius: 10 }}
          />
          <ChevronDown size={20} color="#4B5563" strokeWidth={2.2} />
        </View>

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
            gap: 6,
          }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 16,
              lineHeight: 22,
              color: '#4B5563',
            }}
          >
            +995
          </Text>
          <TextInput
            value={formatDisplayPhone(value)}
            onChangeText={(text) =>
              onChange(text.replace(/\D/g, '').replace(/^995/, '').slice(0, 9))
            }
            placeholder={ka.auth.phonePlaceholder}
            placeholderTextColor="#4B5563"
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => Keyboard.dismiss()}
            inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_DONE_ACCESSORY_ID : undefined}
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 22,
              color: '#4B5563',
              padding: 0,
            }}
          />
          <CircleHelp size={20} color="#4B5563" strokeWidth={2} />
        </View>
      </View>

      {error ? (
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 14,
            lineHeight: 20,
            color: '#EF4444',
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
