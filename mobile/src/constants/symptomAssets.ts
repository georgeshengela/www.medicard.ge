import type { ImageSourcePropType } from 'react-native';
import type { BodyPartId, BodySide, OrganId, SymptomGender } from '@/types/symptoms';

export const SYMPTOM_INTRO_ILLUSTRATION = require('../../assets/figma/symptoms/illustrations/intro-virus.png');

export const SYMPTOM_BODY_SOURCES: Record<SymptomGender, Record<BodySide, ImageSourcePropType>> = {
  MALE: {
    front: require('../../assets/figma/symptoms/bodies/male-front.png'),
    back: require('../../assets/figma/symptoms/bodies/male-back.png'),
  },
  FEMALE: {
    front: require('../../assets/figma/symptoms/bodies/female-front.png'),
    back: require('../../assets/figma/symptoms/bodies/female-back.png'),
  },
};

export const SYMPTOM_ORGAN_PNG: Partial<Record<OrganId, ImageSourcePropType>> = {
  heart: require('../../assets/figma/symptoms/organs/heart.png'),
  lung: require('../../assets/figma/symptoms/organs/lung.png'),
  liver: require('../../assets/figma/symptoms/organs/liver.png'),
  brain: require('../../assets/figma/symptoms/organs/brain.png'),
  kidney: require('../../assets/figma/symptoms/organs/kidney.png'),
  stomach: require('../../assets/figma/symptoms/organs/stomach.png'),
};

export const ORGAN_SHEET = require('../../assets/figma/symptoms/organs/sheet.png');
export const ANATOMY_SHEET = require('../../assets/figma/symptoms/parts/anatomy-sheet.png');

/** 2x export of Figma 8673:69673 (1592×618). */
export const ANATOMY_SHEET_SIZE = { w: 3184, h: 1236, scale: 2 } as const;
export const ANATOMY_TILE = { w: 176, h: 256 } as const;

export const BODY_PART_SHEET_COLS: Record<Exclude<BodyPartId, 'head'>, number> = {
  'lower-leg': 24,
  'upper-leg': 128,
  abs: 232,
  chest: 336,
  shoulder: 440,
  bicep: 544,
  forearm: 648,
  hand: 752,
  neck: 856,
  tricep: 960,
  hamstring: 1064,
  glute: 1168,
  calf: 1272,
  back: 1376,
  trap: 1480,
};

const PART_ROW_Y = {
  male: { idle: 24, selected: 168 },
  female: { idle: 312, selected: 455 },
} as const;

export function anatomyPartCrop(
  id: Exclude<BodyPartId, 'head'>,
  gender: SymptomGender,
  selected: boolean,
) {
  const scale = ANATOMY_SHEET_SIZE.scale;
  const x = BODY_PART_SHEET_COLS[id] * scale;
  const row = gender === 'FEMALE' ? PART_ROW_Y.female : PART_ROW_Y.male;
  const y = (selected ? row.selected : row.idle) * scale;
  return { x, y, w: ANATOMY_TILE.w, h: ANATOMY_TILE.h };
}

/** 2x export of Figma 8860:134805 (1240×88). Icons 48×48 at y=20. */
export const ORGAN_SHEET_SIZE = { w: 2480, h: 176, scale: 2 } as const;
export const ORGAN_TILE = 96;

export const ORGAN_SHEET_X: Record<OrganId, number> = {
  lung: 20,
  brain: 84,
  kidney: 148,
  heart: 212,
  stomach: 276,
  'small-intestine': 340,
  'large-intestine': 404,
  liver: 468,
  pancreas: 532,
  bladder: 596,
  gallbladder: 660,
  eye: 724,
  spine: 788,
  skin: 852,
  breast: 1108,
  genital: 1044,
};

export function organSheetCrop(id: OrganId, gender: SymptomGender) {
  const scale = ORGAN_SHEET_SIZE.scale;
  const x1x = id === 'genital' && gender === 'FEMALE' ? 1172 : ORGAN_SHEET_X[id];
  return { x: x1x * scale, y: 20 * scale, w: ORGAN_TILE, h: ORGAN_TILE };
}
