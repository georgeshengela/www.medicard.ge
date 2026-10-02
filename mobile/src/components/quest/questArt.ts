// Medi Quest → generated 3D artwork (constants/appArt.ts, components/run/runArt.ts).
// One place maps every Quest concept to its picture; components render it with RN Image.
import type { ImageSourcePropType } from 'react-native';
import { COIN_ART, QUEST_ART, REFERRAL_ART } from '@/constants/appArt';
import { RUN_GIFT, RUN_ICON } from '@/components/run/runArt';

export { COIN_ART };

export const QUEST_STREAK_ART: ImageSourcePropType = RUN_ICON.streak;
export const QUEST_TROPHY_ART: ImageSourcePropType = RUN_ICON.trophy;
export const QUEST_STEPS_ART: ImageSourcePropType = RUN_ICON.steps;
export const QUEST_GIFT_ART: ImageSourcePropType = RUN_GIFT;
export const QUEST_XP_ART: ImageSourcePropType = QUEST_ART.xp;

/** Mission kind (QuestAccentKind). */
export function missionArt(kind: string | null | undefined): ImageSourcePropType {
  switch (kind) {
    case 'hydration':
      return QUEST_ART.hydration;
    case 'medi':
      return QUEST_ART.medi;
    case 'weekly':
      return QUEST_ART.weekly;
    default:
      return QUEST_ART.movement;
  }
}

/** Achievement medallion: key/secret first, then category. */
export function achievementArt(item: { key?: string | null; category?: string | null; secret?: boolean; unlocked?: boolean }): ImageSourcePropType {
  if (item.secret && !item.unlocked) return QUEST_ART.secret;
  if (item.key === 'COMEBACK') return QUEST_ART.comeback;
  switch (item.category) {
    case 'STREAK':
      return RUN_ICON.streak;
    case 'MOVEMENT':
      return QUEST_ART.movement;
    case 'HYDRATION':
      return QUEST_ART.hydration;
    case 'MEDI':
      return QUEST_ART.medi;
    case 'WEEKLY':
      return QUEST_ART.weekly;
    case 'LEVEL':
      return QUEST_ART.level;
    case 'COINS':
      return QUEST_ART.coins;
    case 'SPECIAL':
      return QUEST_ART.special;
    default:
      return RUN_ICON.trophy;
  }
}

/** Store reward by type (StoreReward.type); profile-style perks get their own badge. */
export function rewardArt(reward: { type?: string | null; key?: string | null; entitlementKey?: string | null; imageUrl?: string | null }): ImageSourcePropType {
  // Store prizes carry their own art (server/public/rewards/*.webp).
  if (reward.imageUrl && /^https:\/\//.test(reward.imageUrl)) return { uri: reward.imageUrl };
  switch (reward.type) {
    case 'DIGITAL_PERK': {
      const hint = `${reward.key ?? ''} ${reward.entitlementKey ?? ''}`.toUpperCase();
      return hint.includes('PROFILE_STYLE') || hint.includes('STYLE.PROFILE') ? QUEST_ART.reward_style : QUEST_ART.reward_theme;
    }
    case 'COUPON_CODE':
      return QUEST_ART.reward_coupon;
    case 'PARTNER_VOUCHER':
      return QUEST_ART.reward_voucher;
    case 'PREMIUM_ACCESS':
      return QUEST_ART.reward_premium;
    default:
      return RUN_GIFT;
  }
}

/** Wallet ledger row by RewardLedger.sourceType (see lib/quest/rewardsLogic walletSourceLabel). */
export function ledgerArt(sourceType: string | null | undefined): ImageSourcePropType {
  switch (String(sourceType || '')) {
    case 'QUEST':
      return QUEST_ART.ledger_quest;
    case 'ACHIEVEMENT':
      return RUN_ICON.trophy;
    case 'REFERRAL':
      return REFERRAL_ART.hero;
    case 'HUNT': // MEDIRUN gift found through the pulse
      return RUN_GIFT;
    case 'REWARD_REDEMPTION':
      return QUEST_ART.reward_voucher;
    case 'SYSTEM':
    case 'ADMIN_ADJUSTMENT':
      return COIN_ART;
    default:
      return QUEST_ART.coins;
  }
}

const SYMBOL_ART: Record<string, ImageSourcePropType> = {
  'pose.wave': QUEST_ART.eq_wave,
  'pose.focused': QUEST_ART.eq_focused,
  'pose.proud': QUEST_ART.eq_proud,
  'pose.resting': QUEST_ART.eq_resting,
  'pose.curious': QUEST_ART.eq_curious,
  'accessory.pin': QUEST_ART.eq_pin,
  'accessory.visor': QUEST_ART.eq_visor,
  'accessory.scarf': QUEST_ART.eq_scarf,
  'accessory.orbit': QUEST_ART.eq_orbit,
  'accessory.badge': QUEST_ART.eq_badge,
};

/** Emblem centre symbol by cosmetic visual key (pose.* / accessory.*). */
export function symbolArt(visualKey: string | null | undefined): ImageSourcePropType {
  return SYMBOL_ART[visualKey ?? ''] ?? QUEST_ART.movement;
}

/** Emblem corner decoration by cosmetic visual key (decor.*). */
export function decorationArt(visualKey: string | null | undefined): ImageSourcePropType {
  const decor = visualKey ?? '';
  if (decor.includes('plant')) return QUEST_ART.dec_plant;
  if (decor.includes('lamp')) return QUEST_ART.dec_lamp;
  if (decor.includes('frame')) return QUEST_ART.dec_frame;
  if (decor.includes('window')) return QUEST_ART.dec_window;
  if (decor.includes('shelf')) return QUEST_ART.dec_shelf;
  return RUN_GIFT;
}
