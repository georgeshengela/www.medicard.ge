import React from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';

export const KEYBOARD_DONE_ACCESSORY_ID = 'medicard-keyboard-done';

/** iOS toolbar above number-pad — dismiss keyboard to reach CTAs below. */
export function KeyboardDoneAccessory() {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: '#F3F4F6',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => Keyboard.dismiss()}
          hitSlop={8}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 16,
              color: '#14B8A6',
            }}
          >
            {ka.common.done}
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
