import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function SymptomCta({ label, onPress, disabled, loading }: Props) {
  const T = useFigmaSymptoms();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={!!inactive}
      onPress={inactive ? undefined : onPress}
      style={{
        minHeight: T.btnH,
        paddingVertical: 12,
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
        <ActivityIndicator color={T.textOnBrand} />
      ) : (
        <>
          <Text style={{ color: T.textOnBrand, fontSize: 16, lineHeight: 22, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{label}</Text>
          <ArrowRight size={20} color={T.textOnBrand} strokeWidth={2.2} />
        </>
      )}
    </Pressable>
  );
}

export function SymptomFooter({ children }: { children: React.ReactNode }) {
  const T = useFigmaSymptoms();
  return <View style={{ padding: T.pad, backgroundColor: T.white }}>{children}</View>;
}
