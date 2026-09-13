import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import type { GardenStage } from '@/lib/mediWorld/types';

export function gardenStageIndex(stage: GardenStage) {
  if (stage === 'seed') return 1;
  if (stage === 'sprout') return 2;
  return 3;
}

export function GardenPlotGlyph({
  catalogKey,
  size = 64,
}: {
  catalogKey: string;
  size?: number;
}) {
  if (catalogKey === 'dew_lily') {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Ellipse cx="50" cy="80" rx="34" ry="11" fill="#BBCAC6" />
        <Ellipse cx="50" cy="78" rx="28" ry="8" fill="#D7EDE9" />
        <Path d="M50 35C42 46 32 60 38 72C42 75 58 75 62 72C68 60 58 46 50 35Z" fill="#A6F1E4" />
        <Path d="M50 42C46 50 40 60 44 68C47 70 53 70 56 68C60 60 54 50 50 42Z" fill="#E8FEFA" />
        <Path d="M34 52C28 60 32 70 42 72C36 67 33 60 34 52Z" fill="#6EF8E5" />
        <Path d="M66 52C72 60 68 70 58 72C64 67 67 60 66 52Z" fill="#6EF8E5" />
      </Svg>
    );
  }
  if (catalogKey === 'heart_bloom') {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Ellipse cx="50" cy="82" rx="28" ry="8" fill="#D2E7E3" />
        <Path d="M50 42C44 48 38 62 46 72C50 74 54 74 56 71C63 60 56 47 50 42Z" fill="#FE7D66" />
        <Path d="M36 50C30 58 35 68 44 71C38 65 36 57 36 50Z" fill="#FFB4A6" />
        <Path d="M64 50C70 58 65 68 56 71C62 65 64 57 64 50Z" fill="#FFB4A6" />
        <Circle cx="50" cy="62" r="6" fill="#A53B29" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx="50" cy="85" rx="30" ry="8" fill="#D2E7E3" />
      <Path d="M50 82V25" stroke="#006A60" strokeLinecap="round" strokeWidth="4" />
      <Path d="M50 70C62 65 72 68 76 74" stroke="#00B7A6" strokeLinecap="round" strokeWidth="4" />
      <Path d="M50 70C38 65 28 68 24 74" stroke="#00B7A6" strokeLinecap="round" strokeWidth="4" />
      <Path d="M50 56C64 50 74 52 80 58" stroke="#006A60" strokeLinecap="round" strokeWidth="4.5" />
      <Path d="M50 56C36 50 26 52 20 58" stroke="#006A60" strokeLinecap="round" strokeWidth="4.5" />
      <Path d="M50 40C60 33 68 35 73 39" stroke="#176A60" strokeLinecap="round" strokeWidth="4" />
      <Path d="M50 40C40 33 32 35 27 39" stroke="#176A60" strokeLinecap="round" strokeWidth="4" />
      <Circle cx="50" cy="22" r="5" fill="#4CDBC9" />
    </Svg>
  );
}
