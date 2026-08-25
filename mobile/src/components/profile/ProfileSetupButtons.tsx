import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ArrowRight, Check, X } from 'lucide-react-native';
import { FIGMA_ASSESSMENT_SHADOW } from '@/constants/figmaAssessmentIntro';

type PrimaryProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: 'check' | 'arrow' | 'x' | 'none';
  tone?: 'brand' | 'destructive';
};

export function ProfileSetupPrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon = 'check',
  tone = 'brand',
}: PrimaryProps) {
  const inactive = loading || disabled;
  const bg = tone === 'destructive' ? '#F43F5E' : inactive ? '#99F6E4' : '#14B8A6';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={{ width: '100%' }}
    >
      <View
        style={{
          minHeight: 48,
          borderRadius: 16,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingHorizontal: 20,
          paddingVertical: 12,
          opacity: inactive && tone === 'brand' ? 0.85 : 1,
          ...FIGMA_ASSESSMENT_SHADOW,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: '#FFFFFF',
              }}
            >
              {label}
            </Text>
            {icon === 'check' ? <Check size={20} color="#FFFFFF" strokeWidth={2.4} /> : null}
            {icon === 'arrow' ? <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} /> : null}
            {icon === 'x' ? <X size={20} color="#FFFFFF" strokeWidth={2.4} /> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

export function ProfileSetupLinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ alignItems: 'center', paddingVertical: 4 }}>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 16,
          lineHeight: 22,
          color: '#14B8A6',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
