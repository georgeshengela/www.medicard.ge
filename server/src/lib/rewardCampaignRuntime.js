/**
 * Phase 8 — lightweight campaign eligibility (no admin CRUD imports).
 */
import { CAMPAIGN_STATUSES, PARTNER_STATUSES } from './rewardCampaignDefs.js';

export function isCampaignLive(campaign, now = new Date()) {
  if (!campaign || campaign.status !== CAMPAIGN_STATUSES.ACTIVE) return false;
  if (campaign.startsAt && new Date(campaign.startsAt) > now) return false;
  if (campaign.endsAt && new Date(campaign.endsAt) <= now) return false;
  return true;
}

/** Best-effort reason when no live campaign is found for a reward. */
export async function explainMissingLiveCampaign(db, rewardId, now = new Date()) {
  if (typeof db.rewardCampaign?.findMany !== 'function') {
    return { code: 'REWARD_CAMPAIGN_INACTIVE', message: 'კამპანია მიუწვდომელია.' };
  }
  const rows = await db.rewardCampaign.findMany({
    where: { rewardDefinitionId: rewardId },
    include: { partner: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (!rows.length) {
    return { code: 'REWARD_CAMPAIGN_INACTIVE', message: 'კამპანია მიუწვდომელია.' };
  }
  for (const c of rows) {
    if (c.partner?.status !== PARTNER_STATUSES.ACTIVE) {
      return { code: 'REWARD_PARTNER_INACTIVE', message: 'პარტნიორი მიუწვდომელია.' };
    }
    if (c.status === CAMPAIGN_STATUSES.ACTIVE && c.startsAt && new Date(c.startsAt) > now) {
      return { code: 'REWARD_CAMPAIGN_NOT_STARTED', message: 'კამპანია ჯერ არ დაწყებულა.' };
    }
    if (c.status === CAMPAIGN_STATUSES.ACTIVE && c.endsAt && new Date(c.endsAt) <= now) {
      return { code: 'REWARD_CAMPAIGN_ENDED', message: 'კამპანია დასრულებულია.' };
    }
  }
  return { code: 'REWARD_CAMPAIGN_INACTIVE', message: 'კამპანია მიუწვდომელია.' };
}

export async function findLiveCampaignForReward(db, rewardId, now = new Date()) {
  if (typeof db.rewardCampaign?.findMany !== 'function') return null;
  const rows = await db.rewardCampaign.findMany({
    where: { rewardDefinitionId: rewardId, status: CAMPAIGN_STATUSES.ACTIVE },
    include: { partner: true },
    orderBy: { sortOrder: 'asc' },
  });
  for (const c of rows) {
    if (c.partner?.status !== PARTNER_STATUSES.ACTIVE) continue;
    if (isCampaignLive(c, now)) return c;
  }
  return null;
}
