import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { velvetField, type VelvetPalette } from '@/theme/velvet';

const H = 56;

type Props = TextInputProps & {
  palette: VelvetPalette;
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: LucideIcon;
  secure?: boolean;
};

/**
 * A text field pressed into velvet: a shallow trough with the label above. Focus lights a thin teal
 * line around the trough and the icon; an error draws it in red and puts the message under it.
 */
export const VelvetInput = forwardRef<TextInput, Props>(function VelvetInput(
  { palette: p, label, error, hint, icon: Icon, secure = false, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const ring = error ? p.danger : focused ? p.pulse : null;

  return (
    <View style={{ width: '100%' }}>
      {label ? (
        <Text style={{ marginBottom: 8, marginLeft: 4, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: p.ink2 }}>
          {label}
        </Text>
      ) : null}

      <View
        style={{
          minHeight: H,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 18,
          borderRadius: 18,
          backgroundColor: p.field,
          boxShadow: ring ? `${velvetField(p)}, 0px 0px 0px 1.5px ${ring}` : velvetField(p),
        }}
      >
        {Icon ? <Icon size={20} color={ring ?? p.inkOff} strokeWidth={2} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={p.inkOff}
          selectionColor={p.pulse}
          secureTextEntry={secure && !revealed}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            {
              flex: 1,
              minHeight: H,
              fontSize: 16,
              lineHeight: 22,
              fontFamily: 'NotoSansGeorgian_400Regular',
              color: p.text,
              paddingVertical: 0,
              ...(Platform.OS === 'web' ? { outlineWidth: 0, backgroundColor: 'transparent' } : null),
            },
            style,
          ]}
          {...rest}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? tx('პაროლის დამალვა', 'Hide password') : tx('პაროლის ჩვენება', 'Show password')}
            hitSlop={10}
            onPress={() => setRevealed((value) => !value)}
          >
            {revealed ? <EyeOff size={20} color={p.inkOff} strokeWidth={2} /> : <Eye size={20} color={p.inkOff} strokeWidth={2} />}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={{ marginTop: 6, marginLeft: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: p.danger }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ marginTop: 6, marginLeft: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: p.inkOff }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
