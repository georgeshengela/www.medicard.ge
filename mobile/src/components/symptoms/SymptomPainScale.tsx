import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { PAIN_LEVELS } from '@/constants/symptomCatalog';

const FACES = ['😫', '😣', '😐', '🙂', '😊'] as const;

type Props = {
  value: number | null;
  onChange: (level: number) => void;
};

export function SymptomPainScale({ value, onChange }: Props) {
  const active = PAIN_LEVELS.find((p) => p.level === value);

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {PAIN_LEVELS.map((p) => {
          const on = value === p.level;
          return (
            <Pressable
              key={p.level}
              onPress={() => onChange(p.level)}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxWidth: 56,
                borderRadius: 999,
                borderWidth: on ? 2 : 1,
                borderColor: on ? T.brand : T.borderTertiary,
                backgroundColor: on ? T.brandSoft : T.white,
                alignItems: 'center',
                justifyContent: 'center',
                ...T.shadowXs,
              }}
            >
              <Text style={{ fontSize: 22 }}>{FACES[p.level - 1]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 20, color: T.textSecondary, textAlign: 'center' }}>
        {active?.labelKa ?? '—'}
      </Text>
    </View>
  );
}
