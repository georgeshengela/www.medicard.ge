import React from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';

type HotspotStyle = Pick<ViewStyle, 'left' | 'top'>;

type Props = {
  selected: boolean;
  onPress: () => void;
  label?: string;
  style: HotspotStyle;
};

export function SymptomHotspot({ selected, onPress, label, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={{
        position: 'absolute',
        width: 20,
        height: 20,
        marginLeft: -10,
        marginTop: -10,
        alignItems: 'center',
        ...style,
      }}
    >
      {selected && label ? (
        <View style={{ alignItems: 'center', position: 'absolute', bottom: 24, zIndex: 2, minWidth: 48 }}>
          <View
            style={{
              backgroundColor: T.white,
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 14,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '700', color: T.textPrimary, textAlign: 'center' }}>
              {label}
            </Text>
          </View>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 8,
              borderRightWidth: 8,
              borderTopWidth: 8,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: T.white,
            }}
          />
        </View>
      ) : null}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: T.white,
          backgroundColor: selected ? T.brand : 'rgba(0,0,0,0.3)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.white }} />
      </View>
    </Pressable>
  );
}
