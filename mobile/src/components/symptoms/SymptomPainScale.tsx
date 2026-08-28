import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { PAIN_LEVELS } from '@/constants/symptomCatalog';

/** Figma order: emotion-depressed → overjoyed (worst pain on the left). */
const VISUAL_LEVELS = [5, 4, 3, 2, 1] as const;

type Props = {
  value: number | null;
  onChange: (level: number) => void;
};

export function SymptomPainScale({ value, onChange }: Props) {
  const active = PAIN_LEVELS.find((p) => p.level === value);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {VISUAL_LEVELS.map((level) => {
          const on = value === level;
          return (
            <Pressable
              key={level}
              onPress={() => onChange(level)}
              accessibilityRole="button"
              accessibilityLabel={PAIN_LEVELS.find((p) => p.level === level)?.labelKa}
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? T.brand : T.borderTertiary,
                backgroundColor: on ? T.brandSoft : T.cardBg,
                alignItems: 'center',
                justifyContent: 'center',
                ...T.shadowXs,
              }}
            >
              <PainFace kind={level} color={on ? T.brand : T.textSecondary} />
            </Pressable>
          );
        })}
      </View>
      <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: T.textSecondary }}>
        {active?.labelKa ?? '—'}
      </Text>
    </View>
  );
}

function PainFace({ kind, color }: { kind: number; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        d="M12 2.25C17.385 2.25 21.75 6.615 21.75 12S17.385 21.75 12 21.75 2.25 17.385 2.25 12 6.615 2.25 12 2.25Zm0 1.5C7.444 3.75 3.75 7.444 3.75 12S7.444 20.25 12 20.25 20.25 16.556 20.25 12 16.556 3.75 12 3.75Z"
        fill={color}
      />
      {kind >= 4 ? (
        <>
          <Path d="M9.97 7.47a.75.75 0 0 1 1.06 1.06L9.56 10l1.47 1.47a.75.75 0 1 1-1.06 1.06L8.5 11.06l-1.47 1.47a.75.75 0 0 1-1.06-1.06L7.44 10 5.97 8.53a.75.75 0 0 1 1.06-1.06L8.5 8.94l1.47-1.47Z" fill={color} />
          <Path d="M16.97 7.47a.75.75 0 0 1 1.06 1.06L16.56 10l1.47 1.47a.75.75 0 1 1-1.06 1.06L15.5 11.06l-1.47 1.47a.75.75 0 1 1-1.06-1.06L14.44 10l-1.47-1.47a.75.75 0 0 1 1.06-1.06L15.5 8.94l1.47-1.47Z" fill={color} />
        </>
      ) : (
        <>
          <Path d="M8 9.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" fill={color} />
          <Path d="M16 9.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" fill={color} />
        </>
      )}
      {kind === 5 ? (
        <Path fillRule="evenodd" d="M12 13.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Zm0 1.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" fill={color} />
      ) : kind === 4 ? (
        <Path d="M8.2 16.4c.3-.7 1.6-1.65 3.8-1.65s3.5.95 3.8 1.65a.75.75 0 1 1-1.4.5c-.12-.32-.9-.9-2.4-.9s-2.28.58-2.4.9a.75.75 0 1 1-1.4-.5Z" fill={color} />
      ) : kind === 3 ? (
        <Path d="M8.5 16.25h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1 0-1.5Z" fill={color} />
      ) : kind === 2 ? (
        <Path d="M8.2 17.35c.3.55 1.6 1.4 3.8 1.4s3.5-.85 3.8-1.4a.75.75 0 1 0-1.36-.62c-.12.22-.9.77-2.44.77s-2.32-.55-2.44-.77a.75.75 0 1 0-1.36.62Z" fill={color} />
      ) : (
        <Path d="M8 16.85c.55 1.15 2.1 2.4 4 2.4s3.45-1.25 4-2.4a.75.75 0 1 0-1.38-.58c-.32.74-1.4 1.48-2.62 1.48s-2.3-.74-2.62-1.48A.75.75 0 1 0 8 16.85Z" fill={color} />
      )}
    </Svg>
  );
}
