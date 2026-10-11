import React, { useState } from 'react';
import { Image, Keyboard, Platform, Text, TextInput, View } from 'react-native';
import { formatDisplayPhone } from '@/components/profile/ProfilePhoneField';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/ui/KeyboardDoneAccessory';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

const H = 56;

type Props = {
  value: string;
  onChange: (digits: string) => void;
  palette: VelvetPalette;
  error?: string | null;
};

/** Georgian mobile number in a velvet trough: the 🇬🇪 +995 prefix rests on a small raised chip. */
export function VelvetPhoneField({ value, onChange, palette: p, error }: Props) {
  const [focused, setFocused] = useState(false);
  const ring = error ? p.danger : focused ? p.pulse : null;

  return (
    <View style={{ width: '100%', gap: 6 }}>
      <View
        style={{
          minHeight: H,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 7,
          paddingRight: 18,
          borderRadius: 18,
          backgroundColor: p.field,
          boxShadow: ring ? `${velvetField(p)}, 0px 0px 0px 1.5px ${ring}` : velvetField(p),
        }}
      >
        <View
          style={{
            height: 42,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: p.surface,
            boxShadow: velvetLift(p),
          }}
        >
          <Image source={{ uri: 'https://flagcdn.com/w40/ge.png' }} style={{ width: 20, height: 20, borderRadius: 10 }} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 20, color: p.ink }}>+995</Text>
        </View>
        <TextInput
          value={formatDisplayPhone(value)}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').replace(/^995/, '').slice(0, 9))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={tx('მობილურის ნომერი', 'Mobile number')}
          placeholder={ka.auth.phonePlaceholder}
          placeholderTextColor={p.inkOff}
          selectionColor={p.pulse}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={() => Keyboard.dismiss()}
          inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_DONE_ACCESSORY_ID : undefined}
          style={{
            flex: 1,
            minHeight: H,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 17,
            lineHeight: 22,
            letterSpacing: 0.5,
            color: p.text,
            paddingVertical: 0,
            ...(Platform.OS === 'web' ? { outlineWidth: 0, backgroundColor: 'transparent' } : null),
          }}
        />
      </View>
      {error ? (
        <Text style={{ marginLeft: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: p.danger }}>{error}</Text>
      ) : null}
    </View>
  );
}
