import React from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';

export function MedCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: FIGMA_MEDS.white,
          borderRadius: FIGMA_MEDS.cardRadius,
          borderWidth: 1,
          borderColor: FIGMA_MEDS.border,
          ...FIGMA_MEDS.shadowCard,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function MedInsetCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: FIGMA_MEDS.cardBg,
          borderRadius: FIGMA_MEDS.cardRadiusSm,
          borderWidth: 1,
          borderColor: FIGMA_MEDS.border,
          padding: FIGMA_MEDS.paddingH,
          ...FIGMA_MEDS.shadowInput,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function MedSectionHeader({
  title,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: FIGMA_MEDS.paddingH,
        paddingVertical: FIGMA_MEDS.sectionPy,
        marginBottom: 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {icon}
        <Text style={{ fontSize: 16, fontWeight: '700', color: FIGMA_MEDS.textPrimary }}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: FIGMA_MEDS.brand }}>{actionLabel}</Text>
          <ChevronRight size={16} color={FIGMA_MEDS.brand} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function MedFormSectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: FIGMA_MEDS.paddingH,
        paddingVertical: FIGMA_MEDS.sectionPy,
      }}
    >
      {icon}
      <Text style={{ fontSize: 16, fontWeight: '700', color: FIGMA_MEDS.textPrimary }}>{title}</Text>
    </View>
  );
}

export function MedFieldLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 14, fontWeight: '700', color: FIGMA_MEDS.textPrimary, marginBottom: 8 }}>{children}</Text>
  );
}

export function MedInputShell({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const shell = (
    <View
      style={[
        {
          height: FIGMA_MEDS.inputHeight,
          borderRadius: FIGMA_MEDS.inputRadius,
          borderWidth: 1,
          borderColor: FIGMA_MEDS.borderTertiary,
          backgroundColor: FIGMA_MEDS.white,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          ...FIGMA_MEDS.shadowInput,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{shell}</Pressable>;
  return shell;
}

export function MedDivider() {
  return <View style={{ height: 1, backgroundColor: FIGMA_MEDS.border, width: '100%' }} />;
}

export function MedChip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 6,
        paddingVertical: 4,
        minHeight: 24,
        borderRadius: 8,
        backgroundColor: FIGMA_MEDS.white,
        borderWidth: 1,
        borderColor: active ? FIGMA_MEDS.brand : FIGMA_MEDS.borderTertiary,
        ...FIGMA_MEDS.shadowInput,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '500', color: FIGMA_MEDS.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

export function MedPrimaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: FIGMA_MEDS.brand,
        borderRadius: FIGMA_MEDS.inputRadius,
        minHeight: FIGMA_MEDS.inputHeight,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {icon}
      <Text style={{ color: FIGMA_MEDS.white, fontWeight: '800', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function MedScreenPad({ children, bottom = 24 }: { children: React.ReactNode; bottom?: number }) {
  return <View style={{ paddingBottom: bottom }}>{children}</View>;
}
