import React, { useState } from 'react';
import { Image, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { Pill } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

type Props = {
  uri: string | null | undefined;
  size?: number;
  style?: StyleProp<ImageStyle>;
  rounded?: number;
};

export function PharmacyProductImage({ uri, size = 88, style, rounded = 16 }: Props) {
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const showImage = uri && !failed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.bg300,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          resizeMode="contain"
          style={[{ width: size - 8, height: size - 8 }, style]}
        />
      ) : (
        <Pill size={Math.round(size * 0.34)} color={colors.primary200} strokeWidth={2.2} />
      )}
    </View>
  );
}
