import React, { useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { Pill } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

type Props = {
  uri: string | null | undefined;
  size?: number;
  style?: StyleProp<ImageStyle>;
  rounded?: number;
  /** `cover` fills the frame (crops). `contain` letterboxes inside it. */
  fit?: 'contain' | 'cover';
};

export function PharmacyProductImage({ uri, size = 88, style, rounded = 16, fit = 'contain' }: Props) {
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const showImage = uri && !failed;
  const fill = fit === 'cover';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.bg300,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          resizeMode={fit}
          style={[{ width: fill ? size : size - 8, height: fill ? size : size - 8 }, style]}
        />
      ) : (
        <Pill size={Math.round(size * 0.32)} color={colors.primary200} strokeWidth={2.2} />
      )}
    </View>
  );
}
