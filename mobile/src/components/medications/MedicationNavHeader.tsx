import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus } from 'lucide-react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';

export function MedicationNavHeader({ navigation, options }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : '';
  const HeaderRight = options.headerRight;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: FIGMA_MEDS.white }}>
      <View
        style={{
          minHeight: 56,
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 24, height: 24, justifyContent: 'center' }}>
          <ChevronLeft size={24} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
        </Pressable>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '600',
            color: FIGMA_MEDS.textPrimary,
          }}
        >
          {title}
        </Text>

        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          {HeaderRight ? <HeaderRight canGoBack={navigation.canGoBack()} tintColor={FIGMA_MEDS.textPrimary} /> : null}
        </View>
      </View>
    </View>
  );
}

export function MedicationHeaderPlus({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Plus size={24} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
    </Pressable>
  );
}
