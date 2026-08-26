import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function SymptomCta({ label, onPress, disabled, loading }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={inactive ? undefined : onPress}
      style={{
        height: T.btnH,
        borderRadius: T.btnRadius,
        backgroundColor: T.brand,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 20,
        opacity: inactive ? 0.45 : 1,
        ...T.shadowXs,
      }}
    >
      {loading ? (
        <ActivityIndicator color={T.white} />
      ) : (
        <>
          <Text style={{ color: T.white, fontSize: 16, lineHeight: 22, fontWeight: '600' }}>{label}</Text>
          <ArrowRight size={20} color={T.white} strokeWidth={2.2} />
        </>
      )}
    </Pressable>
  );
}

export function SymptomFooter({ children }: { children: React.ReactNode }) {
  return <View style={{ padding: T.pad, backgroundColor: T.white }}>{children}</View>;
}
