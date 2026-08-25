import type { Gender } from '@/lib/api';

/**
 * Onboarding phase 2 — avatar illustrations (Figma 8845:308989, selected state).
 */
export const AVATAR_IDS = [
  'avatar-1',
  'avatar-2',
  'avatar-3',
  'avatar-4',
  'avatar-5',
  'avatar-6',
  'avatar-7',
  'avatar-8',
  'avatar-9',
  'avatar-10',
  'avatar-11',
  'avatar-12',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

/** Six female avatars — shown when user gender is FEMALE. */
export const FEMALE_AVATAR_IDS = [
  'avatar-1',
  'avatar-4',
  'avatar-6',
  'avatar-7',
  'avatar-9',
  'avatar-12',
] as const satisfies readonly AvatarId[];

/** Six male avatars — shown when user gender is MALE. */
export const MALE_AVATAR_IDS = [
  'avatar-2',
  'avatar-3',
  'avatar-5',
  'avatar-8',
  'avatar-10',
  'avatar-11',
] as const satisfies readonly AvatarId[];

export const AVATAR_SOURCES: Record<AvatarId, number> = {
  'avatar-1': require('../../assets/figma/avatars/avatar-1.png'),
  'avatar-2': require('../../assets/figma/avatars/avatar-2.png'),
  'avatar-3': require('../../assets/figma/avatars/avatar-3.png'),
  'avatar-4': require('../../assets/figma/avatars/avatar-4.png'),
  'avatar-5': require('../../assets/figma/avatars/avatar-5.png'),
  'avatar-6': require('../../assets/figma/avatars/avatar-6.png'),
  'avatar-7': require('../../assets/figma/avatars/avatar-7.png'),
  'avatar-8': require('../../assets/figma/avatars/avatar-8.png'),
  'avatar-9': require('../../assets/figma/avatars/avatar-9.png'),
  'avatar-10': require('../../assets/figma/avatars/avatar-10.png'),
  'avatar-11': require('../../assets/figma/avatars/avatar-11.png'),
  'avatar-12': require('../../assets/figma/avatars/avatar-12.png'),
};

export function isAvatarId(value: string | null | undefined): value is AvatarId {
  return !!value && (AVATAR_IDS as readonly string[]).includes(value);
}

export function avatarsForGender(gender: Gender | null | undefined): readonly AvatarId[] {
  if (gender === 'FEMALE') return FEMALE_AVATAR_IDS;
  if (gender === 'MALE') return MALE_AVATAR_IDS;
  return AVATAR_IDS;
}

export function defaultAvatarForGender(gender: Gender | null | undefined): AvatarId {
  if (gender === 'FEMALE') return FEMALE_AVATAR_IDS[0];
  if (gender === 'MALE') return MALE_AVATAR_IDS[0];
  return 'avatar-1';
}

export function normalizeAvatarForGender(
  avatarId: string | null | undefined,
  gender: Gender | null | undefined,
): AvatarId {
  const pool = avatarsForGender(gender);
  if (typeof avatarId === 'string' && isAvatarId(avatarId) && (pool as readonly string[]).includes(avatarId)) {
    return avatarId;
  }
  return defaultAvatarForGender(gender);
}
