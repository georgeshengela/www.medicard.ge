import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  icon: React.ReactNode;
  value: React.ReactNode;
  label?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Icon well tint — defaults to brand wash. */
  wellColor?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Hub / Home stat: icon well on the left, value on top, caption below.
 * Pressable when `onPress` is given (wallet, streak info).
 */
export function QuestStatChip({ icon, value, label, onPress, accessibilityLabel, wellColor, style }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const body = (
    <>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: wellColor || (dark ? QUEST.wash.dark : QUEST.wash.light),
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 16,
              lineHeight: 22,
              letterSpacing: -0.2,
              color: colors.text100,
            }}
          >
            {value}
          </Text>
        ) : (
          value
        )}
        {label ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 11,
              lineHeight: 15,
              color: colors.text300,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </>
  );

  const box: ViewStyle = {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: QUEST.rowRadius,
    borderWidth: 1,
    borderColor: colors.bg300,
    backgroundColor: dark ? colors.surfaceRaised : colors.bg100,
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className="active:opacity-75"
        style={[box, style]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[box, style]}>{body}</View>;
}
