import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { LabBodyGender, LabSystemId } from '@/lib/labBody';

/**
 * The symptom checker's organ drawings for MEDILAB's systems (owner 2026-10-10: „ჩვენი ორგანოების
 * სურათები“). PNGs are the same art with the white square removed (assets/lab/organs); blood, thyroid,
 * vitamins and the test tube have no drawing there, so they are drawn here in the same pen — rose
 * outline, blush fill, a teal accent.
 */
const PNG: Partial<Record<LabSystemId, ImageSourcePropType>> = {
  heart: require('../../../assets/lab/organs/heart.png'),
  liver: require('../../../assets/lab/organs/liver.png'),
  kidney: require('../../../assets/lab/organs/kidney.png'),
  sugar: require('../../../assets/lab/organs/pancreas.png'),
};
const HORMONES: Record<LabBodyGender, ImageSourcePropType> = {
  FEMALE: require('../../../assets/lab/organs/genital-female.png'),
  MALE: require('../../../assets/lab/organs/genital-male.png'),
};

const ROSE = '#F43F5E';
const BLUSH = '#FFE4E6';
const TEAL = '#14B8A6';
const MINT = '#CCFBF1';

export function LabOrganArt({ system, gender, size = 44 }: { system: LabSystemId; gender: LabBodyGender; size?: number }) {
  const png = system === 'hormones' ? HORMONES[gender] : PNG[system];
  if (png) return <Image source={png} style={{ width: size, height: size }} resizeMode="contain" accessible={false} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {system === 'blood' ? (
        <>
          <Path d="M24 7c5.5 7.6 11 13.6 11 20.4C35 33.8 30.1 39 24 39s-11-5.2-11-11.6C13 20.6 18.5 14.6 24 7Z" fill={BLUSH} stroke={ROSE} strokeWidth={1.4} strokeLinejoin="round" />
          <Path d="M18.6 28.5c.3 3 2.4 5.3 5.2 5.9" fill="none" stroke={TEAL} strokeWidth={1.4} strokeLinecap="round" />
          <Ellipse cx={27.5} cy={25} rx={3} ry={2.2} fill="#FDCFD5" stroke={ROSE} strokeWidth={1.1} />
        </>
      ) : system === 'thyroid' ? (
        <>
          <Rect x={21.3} y={8} width={5.4} height={32} rx={2.7} fill={MINT} stroke={TEAL} strokeWidth={1.3} />
          <Path d="M22 22c-1.5-6-4.5-9-7.6-8.3-3.2.7-4.4 5-3.6 10.2.9 5.6 4.2 9 7.4 8.6 2.7-.4 4.2-3.6 3.8-6.7" fill={BLUSH} stroke={ROSE} strokeWidth={1.4} strokeLinejoin="round" />
          <Path d="M26 22c1.5-6 4.5-9 7.6-8.3 3.2.7 4.4 5 3.6 10.2-.9 5.6-4.2 9-7.4 8.6-2.7-.4-4.2-3.6-3.8-6.7" fill={BLUSH} stroke={ROSE} strokeWidth={1.4} strokeLinejoin="round" />
          <Path d="M20 26.5h8" stroke={ROSE} strokeWidth={1.4} strokeLinecap="round" />
        </>
      ) : system === 'vitamins' ? (
        <>
          <Path d="M17.6 33.9a7 7 0 0 1 0-9.9l8.5-8.5a7 7 0 0 1 9.9 9.9l-8.5 8.5a7 7 0 0 1-9.9 0Z" fill={BLUSH} stroke={ROSE} strokeWidth={1.4} />
          <Path d="M21.85 19.75l9.9 9.9-4.25 4.25a7 7 0 0 1-9.9-9.9Z" fill={MINT} stroke={TEAL} strokeWidth={1.4} strokeLinejoin="round" />
          <Path d="M28.5 18.6l2.6-2.6" stroke={ROSE} strokeWidth={1.3} strokeLinecap="round" />
          <Circle cx={13} cy={14} r={1.6} fill={TEAL} />
          <Circle cx={36.5} cy={36} r={1.3} fill={ROSE} />
        </>
      ) : (
        <>
          <Path d="M19 8h10M20.5 8v23.5a3.5 3.5 0 0 0 7 0V8" fill="none" stroke={ROSE} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M20.5 22h7v9.5a3.5 3.5 0 0 1-7 0Z" fill={BLUSH} stroke={ROSE} strokeWidth={1.4} strokeLinejoin="round" />
          <Path d="M20.5 14h3.5M20.5 18h2.5" stroke={TEAL} strokeWidth={1.3} strokeLinecap="round" />
          <Circle cx={32.5} cy={30} r={2} fill={MINT} stroke={TEAL} strokeWidth={1.2} />
          <Circle cx={15.5} cy={26} r={1.5} fill="#FDCFD5" stroke={ROSE} strokeWidth={1} />
        </>
      )}
    </Svg>
  );
}
