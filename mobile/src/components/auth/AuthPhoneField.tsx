import React, { forwardRef, useState } from 'react';
import { Platform, Text, TextInput, View, type TextInputProps } from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import Svg, { Rect } from 'react-native-svg';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { formatGeorgianMobile, georgianLocalDigits, isGeorgianMobile } from '@/lib/phoneFormat';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

type Props = {
  label?: string;
  /** Local digits only (up to 9, e.g. `555123456`). */
  value: string;
  onChange: (localDigits: string) => void;
  error?: string | null;
  hint?: string;
  /** Velvet screens (sign-in, password reset): a light trough, the +995 prefix on a raised chip. */
  palette?: VelvetPalette;
} & Pick<TextInputProps, 'autoFocus' | 'onSubmitEditing' | 'returnKeyType' | 'editable'>;

/**
 * Georgian mobile field for auth screens: a fixed 🇬🇪 +995 prefix, the number grouped as the
 * person types (`555 12 34 56`), pasted `+995…` numbers cleaned up, and a check once it is valid.
 */
export const AuthPhoneField = forwardRef<TextInput, Props>(function AuthPhoneField(
  { label, value, onChange, error, hint, palette: p, ...rest },
  ref,
) {
  const colors = useThemeColors();
  const auth = useFigmaAuth();
  const [focused, setFocused] = useState(false);
  const valid = isGeorgianMobile(value);
  const borderColor = error ? colors.danger : focused ? auth.primaryBg : auth.inputBorder;
  const ring = p ? (error ? p.danger : focused ? p.pulse : null) : null;
  const ink = p ? p.text : auth.fieldText;

  return (
    <View style={{ width: '100%' }}>
      {label ? (
        <Text
          style={{
            marginBottom: 8,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: p ? 14 : auth.labelSize,
            lineHeight: 20,
            color: p ? p.ink2 : auth.labelColor,
            marginLeft: p ? 4 : 0,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={
          p
            ? {
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 56,
                paddingLeft: 7,
                borderRadius: 18,
                backgroundColor: p.field,
                boxShadow: ring ? `${velvetField(p)}, 0px 0px 0px 1.5px ${ring}` : velvetField(p),
              }
            : {
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: auth.inputMinHeight + 4,
                borderRadius: auth.inputRadius,
                borderWidth: focused ? 1.5 : 1,
                borderColor,
                backgroundColor: auth.inputBg,
                overflow: 'hidden',
                ...FIGMA_AUTH_SHADOW,
              }
        }
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={
            p
              ? { height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, paddingHorizontal: 12, borderRadius: 14, backgroundColor: p.surface, boxShadow: velvetLift(p) }
              : {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  alignSelf: 'stretch',
                  flexShrink: 0,
                  paddingLeft: 16,
                  paddingRight: 14,
                  borderRightWidth: 1,
                  borderRightColor: auth.inputBorder,
                }
          }
        >
          <View style={{ width: 24, height: 16, flexShrink: 0 }}>
            <GeorgiaFlag />
          </View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: p ? 15 : 17, lineHeight: p ? 20 : 24, color: p ? p.ink : auth.fieldText }}>
            +995
          </Text>
        </View>

        <TextInput
          ref={ref}
          value={formatGeorgianMobile(value)}
          onChangeText={(text) => onChange(georgianLocalDigits(text))}
          placeholder="5XX XX XX XX"
          placeholderTextColor={p ? p.inkOff : auth.placeholder}
          selectionColor={p?.pulse}
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
            minHeight: p ? 56 : undefined,
            color: ink,
            ...(Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none', backgroundColor: 'transparent' } as object) : null),
          }}
          {...rest}
        />

        {valid ? (
          <View style={{ paddingRight: 14, flexShrink: 0 }}>
            <CircleCheck size={22} color={p ? p.pulse : auth.primaryBg} strokeWidth={2.2} />
          </View>
        ) : null}
      </View>

      {error ? (
        <Text style={{ marginTop: 8, marginLeft: p ? 4 : 0, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: p ? p.danger : colors.danger }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ marginTop: 8, marginLeft: p ? 4 : 0, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: p ? p.inkOff : colors.text300 }}>
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
