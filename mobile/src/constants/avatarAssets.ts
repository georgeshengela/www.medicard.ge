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

export function defaultAvatarForGender(gender: string | null | undefined): AvatarId {
  if (gender === 'FEMALE') return 'avatar-4';
  if (gender === 'MALE') return 'avatar-2';
  return 'avatar-1';
}
