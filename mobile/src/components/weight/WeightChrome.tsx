import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react-native';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { ka } from '@/i18n/ka';

export function WeightAppBar({
  title,
  onBack,
  onEdit,
}: {
  title: string;
  onBack: () => void;
  onEdit?: () => void;
}) {
  const T = useFigmaWeight();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={ka.common.back} onPress={onBack} hitSlop={12}>
        <ChevronLeft size={24} color={T.textPrimary} strokeWidth={2.2} />
      </Pressable>
      <Text
        style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 16,
          lineHeight: 22,
          color: T.textPrimary,
        }}
      >
        {title}
      </Text>
      {onEdit ? (
        <Pressable accessibilityRole="button" accessibilityLabel={ka.common.edit} onPress={onEdit} hitSlop={12}>
          <Pencil size={24} color={T.textPrimary} strokeWidth={2} />
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
    </View>
  );
}

export function WeightWizardBar({ progress, onBack }: { progress: number; onBack: () => void }) {
  const T = useFigmaWeight();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={ka.common.back} onPress={onBack} hitSlop={12}>
        <ChevronLeft size={24} color={T.textPrimary} strokeWidth={2.2} />
      </Pressable>
      <View style={{ flex: 1, height: 4, borderRadius: 8, backgroundColor: T.track, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: 4, borderRadius: 999, backgroundColor: T.brand }} />
      </View>
      <View style={{ width: 24 }} />
    </View>
  );
}

export function WeightPrimaryButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  const T = useFigmaWeight();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        height: 48,
        minHeight: 48,
        borderRadius: 16,
        backgroundColor: T.cta,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        ...T.shadowXs,
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 22, color: '#FFFFFF' }}>
        {label}
      </Text>
      {icon}
    </Pressable>
  );
}

export function WeightSwipeDelete({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const T = useFigmaWeight();
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <View style={{ width: 72, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.common.delete}
            onPress={onDelete}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: T.destructive,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={20} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}
