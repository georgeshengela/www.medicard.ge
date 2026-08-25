import React, { forwardRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { FIGMA_AUTH, FIGMA_AUTH_SHADOW } from '@/constants/figmaAuthLayout';
import { useThemeColors } from '@/theme/colors';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: LucideIcon;
  secure?: boolean;
  /** Nightingale auth field — Figma InputFieldBase. */
  figma?: boolean;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, icon: Icon, secure = false, figma = false, style, ...rest },
  ref,
) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? colors.danger : focused ? FIGMA_AUTH.primaryBg : figma ? FIGMA_AUTH.inputBorder : colors.bg300;

  const fieldStyle = figma
    ? {
        minHeight: FIGMA_AUTH.inputMinHeight,
        borderRadius: FIGMA_AUTH.inputRadius,
        backgroundColor: FIGMA_AUTH.inputBg,
        borderWidth: 1,
        borderColor,
        paddingHorizontal: FIGMA_AUTH.inputPaddingX,
        paddingVertical: FIGMA_AUTH.inputPaddingY,
        ...FIGMA_AUTH_SHADOW,
      }
    : {
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor,
        paddingHorizontal: 16,
      };

  return (
    <View style={{ width: '100%' }}>
      {label ? (
        <Text
          style={{
            marginBottom: 8,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: figma ? FIGMA_AUTH.labelSize : 14,
            lineHeight: 20,
            color: figma ? FIGMA_AUTH.labelColor : colors.text100,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View style={[{ flexDirection: 'row', alignItems: 'center' }, fieldStyle]}>
        {Icon ? (
          <Icon size={20} color={focused ? FIGMA_AUTH.primaryBg : '#6B7280'} strokeWidth={2} />
        ) : null}

        <TextInput
          ref={ref}
          placeholderTextColor={figma ? '#4B5563' : colors.text300}
          secureTextEntry={secure && !revealed}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              flex: 1,
              fontSize: 16,
              lineHeight: 22,
              fontFamily: 'NotoSansGeorgian_400Regular',
              color: '#1F2937',
              paddingVertical: 0,
              marginLeft: Icon ? 8 : 0,
            },
            style,
          ]}
          {...rest}
        />

        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'}
            hitSlop={10}
            onPress={() => setRevealed((value) => !value)}
          >
            {revealed ? (
              <EyeOff size={20} color="#6B7280" strokeWidth={2} />
            ) : (
              <Eye size={20} color="#6B7280" strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.danger }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
