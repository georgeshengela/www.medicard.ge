import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { DoseChevronLeft } from '@/components/medications/MedicationDoseIcons';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';

export function MedicationNavHeader({ navigation, options }: NativeStackHeaderProps) {
  const FIGMA_MEDS = useFigmaMeds();
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : '';
  const HeaderRight = options.headerRight;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: FIGMA_MEDS.headerBg }}>
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
          <DoseChevronLeft size={24} color={FIGMA_MEDS.textPrimary} />
        </Pressable>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 16,
            lineHeight: 22,
            color: FIGMA_MEDS.textPrimary,
          }}
        >
          {title}
        </Text>

        <View style={{ minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          {HeaderRight ? <HeaderRight canGoBack={navigation.canGoBack()} tintColor={FIGMA_MEDS.textPrimary} /> : null}
        </View>
      </View>
    </View>
  );
}

export function MedicationHeaderPlus({ onPress }: { onPress: () => void }) {
  const FIGMA_MEDS = useFigmaMeds();
  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Plus size={24} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
    </Pressable>
  );
}
