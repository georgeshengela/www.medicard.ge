import React, { useRef } from 'react';
import { Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/ui/KeyboardDoneAccessory';
import { FIGMA_PROFILE_SETUP, FIGMA_PROFILE_SETUP_SHADOW } from '@/constants/figmaProfileSetupLayout';

type Props = {
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  /** Number of OTP digits — default 4 for Medicard SMS. */
  length?: 4 | 6;
  /** Figma profile-setup uses larger 80px boxes. */
  variant?: 'compact' | 'hero';
};

/** Single-digit OTP boxes — compact (48px) or hero (80px) per Figma. */
export function OtpCodeInput({
  value,
  onChange,
  error,
  autoFocus = true,
  length = 4,
  variant = 'compact',
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const box = variant === 'hero' ? FIGMA_PROFILE_SETUP.otpBoxSize : 48;
  const gap = variant === 'hero' ? FIGMA_PROFILE_SETUP.otpGap : 8;
  const fontSize = variant === 'hero' ? 32 : 22;
  const borderRadius = variant === 'hero' ? FIGMA_PROFILE_SETUP.otpBoxRadius : 14;
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  return (
    <View>
      <Pressable accessibilityRole="none" onPress={() => inputRef.current?.focus()}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap }}>
          {digits.map((digit, index) => {
            const filled = digit.trim().length > 0;
            return (
              <View
                key={index}
                style={{
                  width: box,
                  height: box + (variant === 'hero' ? 0 : 4),
                  borderRadius,
                  borderWidth: variant === 'hero' ? 1 : 1.5,
                  borderColor: error ? '#EF4444' : '#D1D5DB',
                  backgroundColor: error ? '#FEF2F2' : '#FFFFFF',
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
                    color: filled ? '#0F172A' : '#94A3B8',
                  }}
                >
                  {filled ? digit : variant === 'hero' ? '' : '·'}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>

      <TextInput
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
        inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_DONE_ACCESSORY_ID : undefined}
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />

      {error ? (
        <Text
          style={{
            marginTop: 12,
            textAlign: 'center',
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 14,
            color: '#EF4444',
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
