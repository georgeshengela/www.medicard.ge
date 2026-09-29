import React, { forwardRef, useState } from 'react';
import { Platform, Text, TextInput, View, type TextInputProps } from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import Svg, { Rect } from 'react-native-svg';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { formatGeorgianMobile, georgianLocalDigits, isGeorgianMobile } from '@/lib/phoneFormat';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

type Props = {
  label?: string;
  /** Local digits only (up to 9, e.g. `555123456`). */
  value: string;
  onChange: (localDigits: string) => void;
  error?: string | null;
  hint?: string;
} & Pick<TextInputProps, 'autoFocus' | 'onSubmitEditing' | 'returnKeyType' | 'editable'>;

/**
 * Georgian mobile field for auth screens: a fixed 🇬🇪 +995 prefix, the number grouped as the
 * person types (`555 12 34 56`), pasted `+995…` numbers cleaned up, and a check once it is valid.
 */
export const AuthPhoneField = forwardRef<TextInput, Props>(function AuthPhoneField(
  { label, value, onChange, error, hint, ...rest },
  ref,
) {
  const colors = useThemeColors();
  const auth = useFigmaAuth();
  const [focused, setFocused] = useState(false);
  const valid = isGeorgianMobile(value);
  const borderColor = error ? colors.danger : focused ? auth.primaryBg : auth.inputBorder;

  return (
    <View style={{ width: '100%' }}>
      {label ? (
        <Text
          style={{
            marginBottom: 8,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: auth.labelSize,
            lineHeight: 20,
            color: auth.labelColor,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: auth.inputMinHeight + 4,
          borderRadius: auth.inputRadius,
          borderWidth: focused ? 1.5 : 1,
          borderColor,
          backgroundColor: auth.inputBg,
          overflow: 'hidden',
          ...FIGMA_AUTH_SHADOW,
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'stretch',
            flexShrink: 0,
            paddingLeft: 16,
            paddingRight: 14,
            borderRightWidth: 1,
            borderRightColor: auth.inputBorder,
          }}
        >
          <View style={{ width: 24, height: 16, flexShrink: 0 }}>
            <GeorgiaFlag />
          </View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 17, lineHeight: 24, color: auth.fieldText }}>
            +995
          </Text>
        </View>

        <TextInput
          ref={ref}
          value={formatGeorgianMobile(value)}
          onChangeText={(text) => onChange(georgianLocalDigits(text))}
          placeholder="5XX XX XX XX"
          placeholderTextColor={auth.placeholder}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={16}
          accessibilityLabel={`${label ?? tx('ტელეფონის ნომერი', 'Phone number')}, +995`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            minWidth: 0,
            paddingHorizontal: 14,
            paddingVertical: 0,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 18,
            lineHeight: 24,
            letterSpacing: 0.5,
            color: auth.fieldText,
            ...(Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none', backgroundColor: 'transparent' } as object) : null),
          }}
          {...rest}
        />

        {valid ? (
          <View style={{ paddingRight: 14, flexShrink: 0 }}>
            <CircleCheck size={22} color={auth.primaryBg} strokeWidth={2.2} />
          </View>
        ) : null}
      </View>

      {error ? (
        <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: colors.danger }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: colors.text300 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/** The Georgian five-cross flag, drawn (emoji flags render as "GE" on some systems). */
function GeorgiaFlag() {
  const red = '#E8112D';
  const small = (x: number, y: number) => (
    <React.Fragment key={`${x}-${y}`}>
      <Rect x={x - 0.6} y={y - 2.2} width={1.2} height={4.4} fill={red} />
      <Rect x={x - 2.2} y={y - 0.6} width={4.4} height={1.2} fill={red} />
    </React.Fragment>
  );
  return (
    <Svg width={24} height={16} viewBox="0 0 30 20">
      <Rect x={0} y={0} width={30} height={20} rx={2.5} fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={0.6} />
      <Rect x={13} y={0} width={4} height={20} fill={red} />
      <Rect x={0} y={8} width={30} height={4} fill={red} />
      {[small(6.5, 4), small(23.5, 4), small(6.5, 16), small(23.5, 16)]}
    </Svg>
  );
}
