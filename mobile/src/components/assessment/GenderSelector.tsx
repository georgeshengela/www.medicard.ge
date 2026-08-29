import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAssessment } from '@/constants/assessmentLayout';
import { ka } from '@/i18n/ka';
import type { Gender } from '@/lib/api';
import { lightColors } from '@/theme/colors';

const OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'MALE', label: ka.auth.genderMale, icon: '♂' },
  { value: 'FEMALE', label: ka.auth.genderFemale, icon: '♀' },
  { value: 'OTHER', label: ka.auth.genderOther, icon: '⚧' },
];

type Props = {
  gender: Gender | null;
  genderOther: string;
  onChange: (patch: { gender?: Gender | null; genderOther?: string }) => void;
};

/** Figma gender — 3 square cards + optional other text area. */
export function GenderSelector({ gender, genderOther, onChange }: Props) {
  const ASSESSMENT = useAssessment();
  return (
    <View style={{ width: '100%', gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {OPTIONS.map(({ value, label, icon }) => {
          const active = gender === value;
          return (
            <Pressable
              key={value}
              onPress={() => onChange({ gender: value })}
              style={{
                flex: 1,
                minHeight: 108,
                borderRadius: ASSESSMENT.cardRadius,
                borderWidth: active ? 2 : 1,
                borderColor: active ? lightColors.primary200 : ASSESSMENT.border,
                backgroundColor: active ? `${lightColors.primary200}10` : ASSESSMENT.surface,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 16,
                paddingHorizontal: 8,
              }}
            >
              <Text style={{ fontSize: 28, color: active ? lightColors.primary100 : ASSESSMENT.muted }}>{icon}</Text>
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  color: active ? lightColors.primary100 : ASSESSMENT.text,
                  textAlign: 'center',
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {gender === 'OTHER' ? (
        <TextInput
          value={genderOther}
          onChangeText={(genderOther) => onChange({ genderOther })}
          multiline
          maxLength={300}
          placeholder={ka.assessment.genderOtherPlaceholder}
          placeholderTextColor={ASSESSMENT.faint}
          style={{
            minHeight: 120,
            borderWidth: 1,
            borderColor: ASSESSMENT.border,
            borderRadius: ASSESSMENT.cardRadius,
            padding: 16,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 14,
            color: ASSESSMENT.text,
            textAlignVertical: 'top',
          }}
        />
      ) : null}
    </View>
  );
}
