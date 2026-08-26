import React from 'react';
import { Image, type ImageSourcePropType, View } from 'react-native';

type Crop = { x: number; y: number; w: number; h: number };

type Props = {
  source: ImageSourcePropType;
  sheet: { w: number; h: number };
  crop: Crop;
  width: number;
  height: number;
};

/** Crop a sprite atlas tile by overflowing a larger Image inside a clipped box. */
export function SymptomSprite({ source, sheet, crop, width, height }: Props) {
  const scaleX = width / crop.w;
  const scaleY = height / crop.h;
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Image
        source={source}
        style={{
          position: 'absolute',
          width: sheet.w * scaleX,
          height: sheet.h * scaleY,
          left: -crop.x * scaleX,
          top: -crop.y * scaleY,
        }}
        resizeMode="stretch"
      />
    </View>
  );
}
