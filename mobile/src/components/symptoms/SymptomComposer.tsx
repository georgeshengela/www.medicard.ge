import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PersonStanding, Search, Settings, Sparkles } from 'lucide-react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';

type Props = {
  score: number;
  onFocusInput: () => void;
  onSend: () => void;
  onAnatomy: () => void;
  onSettings?: () => void;
  sendDisabled?: boolean;
};

export function SymptomComposer({ score, onFocusInput, onSend, onAnatomy, onSettings, sendDisabled }: Props) {
  const fill = Math.max(2.5, Math.min(100, score));

  return (
    <View style={{ backgroundColor: T.white }}>
      <View style={{ padding: 16, gap: 16, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Sparkles size={24} color={T.sparkle} fill={T.sparkle} strokeWidth={1.6} />
          <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: T.textPrimary, textAlign: 'center' }}>
            {ka.symptoms.findingScore}
          </Text>
        </View>

        <View style={{ width: '100%', height: 8, borderRadius: 999, backgroundColor: T.track, overflow: 'hidden' }}>
          <View style={{ width: `${fill}%`, height: '100%', backgroundColor: T.brand, borderRadius: 999 }} />
        </View>

        <Text style={{ fontSize: 14, lineHeight: 22, color: T.textSecondary, textAlign: 'center', width: '100%' }}>
          {ka.symptoms.findingHint}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 16 }}>
        <CircleBtn size={48} onPress={onAnatomy} label={ka.symptoms.browseAnatomy}>
          <PersonStanding size={24} color={T.textPrimary} strokeWidth={1.8} />
        </CircleBtn>
        <CircleBtn size={64} primary onPress={sendDisabled ? onFocusInput : onSend} label={ka.common.continue}>
          <Search size={32} color={T.textPrimary} strokeWidth={1.8} />
        </CircleBtn>
        <CircleBtn
          size={48}
          onPress={onSettings ?? onSend}
          disabled={onSettings ? false : sendDisabled}
          label={ka.symptoms.detailsTitle}
        >
          <Settings size={24} color={T.textPrimary} strokeWidth={1.8} />
        </CircleBtn>
      </View>
    </View>
  );
}

function CircleBtn({
  size,
  onPress,
  children,
  primary,
  disabled,
  label,
}: {
  size: number;
  onPress: () => void;
  children: React.ReactNode;
  primary?: boolean;
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
        backgroundColor: primary ? T.composerPrimary : T.cardBg,
        borderWidth: primary ? 0 : 1,
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
