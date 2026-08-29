import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';

type Props = {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  bordered?: boolean;
};

export function SymptomNavHeader({ title, onBack, right, bordered }: Props) {
  const T = useFigmaSymptoms();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: T.white, borderBottomWidth: bordered ? 1 : 0, borderBottomColor: T.borderTertiary }}>
      <View
        style={{
          minHeight: T.barH,
          paddingHorizontal: T.pad,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable onPress={onBack} hitSlop={12} style={{ width: 24, height: 24, justifyContent: 'center' }}>
          <ChevronLeft size={24} color={T.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '600',
            color: T.textPrimary,
          }}
        >
          {title ?? ''}
        </Text>
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>{right}</View>
      </View>
    </View>
  );
}
