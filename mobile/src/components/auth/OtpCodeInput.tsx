import React, { useRef, useState } from 'react';
import { Keyboard, Platform, Text, TextInput, View } from 'react-native';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/ui/KeyboardDoneAccessory';
import { useFigmaProfileSetup, FIGMA_PROFILE_SETUP_SHADOW } from '@/constants/figmaProfileSetupLayout';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { velvetField, type VelvetPalette } from '@/theme/velvet';

type Props = {
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  /** Number of OTP digits — default 4 for Medicard SMS. */
  length?: 4 | 6;
  /** Figma profile-setup uses larger 80px boxes. */
  variant?: 'compact' | 'hero';
  /** Remount the hidden field after a failed attempt so Android does not keep the old digits. */
  resetKey?: number;
  /** Velvet look (sign-in): each digit sits in a pressed well; the next one to fill glows. */
  palette?: VelvetPalette;
};

/** Single-digit OTP boxes — compact (48px) or hero (80px) per Figma. */
export function OtpCodeInput({
  value,
  onChange,
  error,
  autoFocus = true,
  length = 4,
  variant = 'compact',
  resetKey = 0,
  palette,
}: Props) {
  const FIGMA_PROFILE_SETUP = useFigmaProfileSetup();
  const theme = useThemeColors();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  const velvet = palette != null;
  const box = velvet ? (length === 6 ? 46 : 66) : variant === 'hero' ? FIGMA_PROFILE_SETUP.otpBoxSize : 48;
  const gap = velvet ? (length === 6 ? 9 : 14) : variant === 'hero' ? FIGMA_PROFILE_SETUP.otpGap : 8;
  const fontSize = velvet ? (length === 6 ? 24 : 30) : variant === 'hero' ? 32 : 22;
  const borderRadius = velvet ? (length === 6 ? 15 : 20) : variant === 'hero' ? FIGMA_PROFILE_SETUP.otpBoxRadius : 14;
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  return (
    <View>
      <View style={{ position: 'relative' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap }} pointerEvents="none">
          {digits.map((digit, index) => {
            const filled = digit.trim().length > 0;
            if (palette) {
              const next = focused && index === Math.min(value.length, length - 1);
              const ring = error ? palette.danger : next ? palette.pulse : null;
              return (
                <View
                  key={index}
                  style={{
                    width: box,
                    height: box,
                    borderRadius,
                    backgroundColor: palette.field,
                    boxShadow: ring ? `${velvetField(palette)}, 0px 0px 0px 1.5px ${ring}` : velvetField(palette),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize, color: palette.text }}>{filled ? digit : ''}</Text>
                </View>
              );
            }
            return (
              <View
                key={index}
                style={{
                  width: box,
                  height: box + (variant === 'hero' ? 0 : 4),
                  borderRadius,
                  borderWidth: variant === 'hero' ? 1 : 1.5,
                  borderColor: error ? '#EF4444' : FIGMA_PROFILE_SETUP.inputBorder,
                  backgroundColor: error ? '#FEF2F2' : FIGMA_PROFILE_SETUP.inputBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(variant === 'hero' ? FIGMA_PROFILE_SETUP_SHADOW : {
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                  }),
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize,
                    color: filled ? theme.text100 : theme.text300,
                  }}
                >
                  {filled ? digit : variant === 'hero' ? '' : '·'}
                </Text>
              </View>
            );
          })}
        </View>

        <TextInput
          key={resetKey}
          ref={inputRef}
          value={value}
          onChangeText={(text) => {
            const next = text.replace(/\D/g, '').slice(0, length);
            onChange(next);
            if (next.length >= length) Keyboard.dismiss();
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          caretHidden
          importantForAccessibility="yes"
          accessibilityLabel={tx('SMS კოდი', 'SMS code')}
          inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_DONE_ACCESSORY_ID : undefined}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: box + (velvet || variant === 'hero' ? 0 : 4),
            opacity: 0.02,
            color: theme.text100,
            fontSize,
          }}
        />
      </View>

      {error ? (
        <Text
          style={{
            marginTop: 12,
            textAlign: 'center',
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 14,
            color: palette ? palette.danger : '#EF4444',
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
