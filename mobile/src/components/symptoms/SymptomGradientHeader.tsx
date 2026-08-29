import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
};

export function SymptomGradientHeader({ title, subtitle, onBack, trailing, children, compact }: Props) {
  const T = useFigmaSymptoms();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#14B8A6', 'rgba(20,184,166,0)']} locations={[0, 1]} style={{ paddingTop: insets.top }}>
      <View style={{ minHeight: compact ? 48 : 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} color={T.textPrimary} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
        {compact ? (
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.textPrimary, textAlign: 'center' }} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {trailing ?? <View style={{ width: 32 }} />}
      </View>
      {!compact ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, gap: 8 }}>
          <Text style={{ fontSize: 30, lineHeight: 38, fontWeight: '700', color: T.textPrimary, letterSpacing: -0.25 }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 16, lineHeight: 26, color: T.textSecondary }}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </LinearGradient>
  );
}
