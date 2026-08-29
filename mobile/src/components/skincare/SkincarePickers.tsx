import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Droplet, Droplets, Heart, Layers, Sparkles } from 'lucide-react-native';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';

const CHECK = 20;

const TYPE_ICONS = [Sparkles, Droplets, Droplet, Layers, Heart] as const;

type TypeProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SkincareTypeList({ value, onChange }: TypeProps) {
  const FIGMA = useFigmaChat();
  const types = ka.modules.skincare.skinTypes;
  const hints = ka.modules.skincare.skinTypeHints;

  return (
    <View style={{ gap: 8 }}>
      {types.map((type, index) => {
        const Icon = TYPE_ICONS[index] ?? Sparkles;
        const active = value === type;
        return (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (type !== value) pickerSelectionTick();
              onChange(type);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: FIGMA.white,
              borderWidth: 1,
              borderColor: active ? FIGMA.brand : FIGMA.border,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              ...FIGMA.shadowXs,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                backgroundColor: active ? FIGMA.brandQuaternary : FIGMA.cardBg,
                borderWidth: 1,
                borderColor: active ? FIGMA.brandBorderLight : FIGMA.borderTertiary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={22} color={FIGMA.brand} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA.textPrimary,
                }}
              >
                {type}
              </Text>
              {hints[index] ? (
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 13,
                    lineHeight: 18,
                    color: FIGMA.textSecondary,
                  }}
                >
                  {hints[index]}
                </Text>
              ) : null}
            </View>
            <View
              style={{
                width: CHECK,
                height: CHECK,
                borderRadius: 4,
                backgroundColor: active ? FIGMA.brand : FIGMA.white,
                borderWidth: active ? 0 : 1,
                borderColor: FIGMA.borderTertiary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {active ? <CheckMark /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SkincareConcernGrid({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (concern: string) => void;
}) {
  const FIGMA = useFigmaChat();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {ka.modules.skincare.concerns.map((concern) => {
        const active = selected.includes(concern);
        return (
          <Pressable
            key={concern}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            onPress={() => {
              pickerSelectionTick();
              onToggle(concern);
            }}
            style={{
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: active ? FIGMA.brand : FIGMA.border,
              backgroundColor: active ? FIGMA.brand : FIGMA.white,
              ...FIGMA.shadowXs,
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                lineHeight: 20,
                color: active ? FIGMA.textOnBrand : FIGMA.textSecondary,
              }}
            >
              {concern}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CheckMark() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M1.875 6.75L4.5 9.375L10.5 3.375"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
