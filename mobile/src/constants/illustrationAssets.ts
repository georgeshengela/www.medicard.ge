import type { ImageSourcePropType } from 'react-native';
import type { Gender } from '@/lib/api';

/** PNG slices from `body.svg` (npm run figma:body:svg). */
const BODY_TYPE_ASSETS = {
  male: {
    ECTOMORPH: {
      unselected: require('../../assets/figma/body-types/male-ectomorph-unselected.png'),
      selected: require('../../assets/figma/body-types/male-ectomorph-selected.png'),
    },
    MESOMORPH: {
      unselected: require('../../assets/figma/body-types/male-mesomorph-unselected.png'),
      selected: require('../../assets/figma/body-types/male-mesomorph-selected.png'),
    },
    ENDOMORPH: {
      unselected: require('../../assets/figma/body-types/male-endomorph-unselected.png'),
      selected: require('../../assets/figma/body-types/male-endomorph-selected.png'),
    },
  },
  female: {
    ECTOMORPH: {
      unselected: require('../../assets/figma/body-types/female-ectomorph-unselected.png'),
      selected: require('../../assets/figma/body-types/female-ectomorph-selected.png'),
    },
    MESOMORPH: {
      unselected: require('../../assets/figma/body-types/female-mesomorph-unselected.png'),
      selected: require('../../assets/figma/body-types/female-mesomorph-selected.png'),
    },
    ENDOMORPH: {
      unselected: require('../../assets/figma/body-types/female-endomorph-unselected.png'),
      selected: require('../../assets/figma/body-types/female-endomorph-selected.png'),
    },
  },
} as const;

export type BodyTypeKey = keyof typeof BODY_TYPE_ASSETS.male;

/** PNG slices from assessment + illustration exports (npm run figma:illustration:svg). */
export const ILLUSTRATION_SOURCES = {
  mood: {
    AWFUL: require('../../assets/figma/illustrations/mood-awful.png'),
    SAD: require('../../assets/figma/illustrations/mood-sad.png'),
    NEUTRAL: require('../../assets/figma/illustrations/mood-neutral.png'),
    HAPPY: require('../../assets/figma/illustrations/mood-happy.png'),
    GREAT: require('../../assets/figma/illustrations/mood-great.png'),
  },
  smoking: {
    CURRENT: require('../../assets/figma/illustrations/smoking-current.png'),
    FORMER: require('../../assets/figma/illustrations/smoking-former.png'),
    NEVER: require('../../assets/figma/illustrations/smoking-never.png'),
  },
  bodyScan: require('../../assets/figma/body-types/male-mesomorph-unselected.png'),
} as const satisfies Record<string, unknown>;

export type MoodKey = keyof typeof ILLUSTRATION_SOURCES.mood;
export const MOOD_KEYS = ['AWFUL', 'SAD', 'NEUTRAL', 'HAPPY', 'GREAT'] as const satisfies readonly MoodKey[];

function bodyGenderKey(gender: Gender | null | undefined): 'male' | 'female' {
  return gender === 'FEMALE' ? 'female' : 'male';
}

export function bodyTypeImage(
  gender: Gender | null | undefined,
  type: string,
  selected = false,
): ImageSourcePropType | null {
  const g = bodyGenderKey(gender);
  const row = BODY_TYPE_ASSETS[g][type as BodyTypeKey];
  if (!row) return null;
  return selected ? row.selected : row.unselected;
}

export function moodImage(key: string): ImageSourcePropType | null {
  return ILLUSTRATION_SOURCES.mood[key as MoodKey] ?? null;
}

export function smokingImage(key: string): ImageSourcePropType | null {
  return (ILLUSTRATION_SOURCES.smoking as Record<string, ImageSourcePropType>)[key] ?? null;
}
