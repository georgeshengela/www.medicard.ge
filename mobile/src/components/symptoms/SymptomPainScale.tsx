import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { PAIN_LEVELS } from '@/constants/symptomCatalog';

/** Mild on the left, worst on the right (owner 2026-10-04 redesign: reads like any scale). */
const VISUAL_LEVELS = [1, 2, 3, 4, 5] as const;
/** One calm colour per level: teal → lime → amber → orange → rose. */
const LEVEL_COLOR: Record<number, string> = { 1: '#0D9488', 2: '#65A30D', 3: '#D97706', 4: '#EA580C', 5: '#E11D48' };

type Props = {
  value: number | null;
  onChange: (level: number) => void;
};

export function SymptomPainScale({ value, onChange }: Props) {
  const T = useFigmaSymptoms();
  const active = PAIN_LEVELS.find((p) => p.level === value);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        {VISUAL_LEVELS.map((level) => {
          const on = value === level;
          const color = LEVEL_COLOR[level];
          return (
            <Pressable
              key={level}
              onPress={() => onChange(level)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={PAIN_LEVELS.find((p) => p.level === level)?.labelKa}
              style={{
                flex: 1,
                height: 52,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: on ? color : 'transparent',
                backgroundColor: on ? `${color}1F` : T.cardBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PainFace kind={level} color={on ? color : T.textSecondary} />
            </Pressable>
          );
        })}
      </View>
      <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: active ? LEVEL_COLOR[active.level] : T.textMuted }}>
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
