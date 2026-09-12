import React from 'react';
import { View } from 'react-native';
import type { GardenStage } from '@/lib/mediWorld/types';

const PALETTE: Record<string, { stem: string; leaf: string; bloom: string }> = {
  pulse_fern: { stem: '#0F766E', leaf: '#14B8A6', bloom: '#99F6E4' },
  dew_lily: { stem: '#0369A1', leaf: '#38BDF8', bloom: '#E0F2FE' },
  moon_moss: { stem: '#5B21B6', leaf: '#A78BFA', bloom: '#EDE9FE' },
  heart_bloom: { stem: '#9F1239', leaf: '#FB7185', bloom: '#FBCFE8' },
  orbit_vine: { stem: '#4338CA', leaf: '#818CF8', bloom: '#FDE68A' },
};

const STAGE_SCALE: Record<GardenStage, number> = {
  seed: 0.42,
  sprout: 0.62,
  bloom: 0.82,
  radiant: 1,
};

const LEAVES: Record<GardenStage, number> = {
  seed: 0,
  sprout: 1,
  bloom: 3,
  radiant: 5,
};

type Props = {
  catalogKey: string;
  stage: GardenStage;
  size?: number;
  reducedMotion?: boolean;
  accessibilityLabel?: string;
};

export function GardenPlantVisual({ catalogKey, stage, size = 72, reducedMotion, accessibilityLabel }: Props) {
  const palette = PALETTE[catalogKey] || PALETTE.pulse_fern;
  const scale = STAGE_SCALE[stage];
  const leafCount = LEAVES[stage];
  const box = size;
  const plantH = Math.round(box * scale);
  const isLily = catalogKey === 'dew_lily';
  const isMoss = catalogKey === 'moon_moss';
  const isVine = catalogKey === 'orbit_vine';
  const isHeart = catalogKey === 'heart_bloom';

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel || `${catalogKey} ${stage}`}
      style={{ width: box, height: box, alignItems: 'center', justifyContent: 'flex-end' }}
    >
      {stage === 'seed' ? (
        <View
          style={{
            width: isMoss ? 16 : 12,
            height: isMoss ? 10 : 10,
            borderRadius: isLily ? 2 : 8,
            backgroundColor: palette.stem,
            marginBottom: 6,
          }}
        />
      ) : null}
      {stage !== 'seed' ? (
        <View style={{ width: box, height: plantH, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View
            style={{
              width: isVine ? 4 : 5,
              height: plantH * (isMoss ? 0.35 : 0.7),
              borderRadius: 4,
              backgroundColor: palette.stem,
              position: 'absolute',
              bottom: 4,
              transform: isVine && !reducedMotion ? [{ rotate: '12deg' }] : undefined,
            }}
          />
          {Array.from({ length: leafCount }).map((_, i) => {
            const left = i % 2 === 0;
            const w = isLily ? 16 : isHeart ? 14 : 12 + i * 2;
            const h = isMoss ? 8 : isLily ? 10 : 7 + i;
            return (
              <View
                key={`leaf-${i}`}
                style={{
                  position: 'absolute',
                  bottom: 10 + i * (isMoss ? 6 : 8),
                  left: left ? 18 : undefined,
                  right: left ? undefined : 18,
                  width: w,
                  height: h,
                  borderRadius: isLily ? 10 : isHeart ? 8 : isMoss ? 4 : 6,
                  backgroundColor: palette.leaf,
                  transform: [{ rotate: left ? '-28deg' : '28deg' }],
                }}
              />
            );
          })}
          {stage === 'bloom' || stage === 'radiant' ? (
            <View
              style={{
                position: 'absolute',
                top: isMoss ? 8 : 2,
                width: isHeart ? 18 : isLily ? 16 : 14,
                height: isHeart ? 16 : isLily ? 12 : 14,
                borderRadius: isHeart ? 6 : isLily ? 8 : 10,
                backgroundColor: palette.bloom,
              }}
            />
          ) : null}
          {stage === 'radiant' && catalogKey === 'orbit_vine' ? (
            <>
              <View style={{ position: 'absolute', top: 6, left: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.bloom }} />
              <View style={{ position: 'absolute', top: 18, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.bloom }} />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
