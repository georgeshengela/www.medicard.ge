import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Keyboard, Scan, Send, Sparkles } from 'lucide-react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';

type Props = {
  score: number;
  onFocusInput: () => void;
  onSend: () => void;
  onAnatomy: () => void;
  sendDisabled?: boolean;
};

export function SymptomComposer({ score, onFocusInput, onSend, onAnatomy, sendDisabled }: Props) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, backgroundColor: T.white }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        <Sparkles size={18} color={T.brand} strokeWidth={2.2} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPrimary }}>{ka.symptoms.findingScore}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 99, backgroundColor: T.cardBg, overflow: 'hidden' }}>
        <View style={{ width: `${score}%`, height: '100%', backgroundColor: T.brand, borderRadius: 99 }} />
      </View>
      <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: T.textSecondary, textAlign: 'center' }}>
        {ka.symptoms.findingHint}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, paddingVertical: 16 }}>
        <CircleBtn size={48} onPress={onFocusInput} label={ka.symptoms.searchPlaceholder}>
          <Keyboard size={22} color={T.textPrimary} strokeWidth={2} />
        </CircleBtn>
        <CircleBtn size={64} brand onPress={onSend} disabled={sendDisabled} label={ka.common.continue}>
          <Send size={24} color={T.white} strokeWidth={2.2} />
        </CircleBtn>
        <CircleBtn size={48} onPress={onAnatomy} label={ka.symptoms.browseAnatomy}>
          <Scan size={22} color={T.textPrimary} strokeWidth={2} />
        </CircleBtn>
      </View>
    </View>
  );
}

function CircleBtn({
  size,
  onPress,
  children,
  brand,
  disabled,
  label,
}: {
  size: number;
  onPress: () => void;
  children: React.ReactNode;
  brand?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={disabled ? undefined : onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: brand ? T.brand : T.cardBg,
        borderWidth: brand ? 0 : 1,
        borderColor: T.borderTertiary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        ...T.shadowXs,
      }}
    >
      {children}
    </Pressable>
  );
}
