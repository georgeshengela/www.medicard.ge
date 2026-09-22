import policy from '../config/consumerRelease.json' with { type: 'json' };

// Historical billing configuration cannot change access in this product.
export function isFreeConsumerRelease(config = policy) {
  return true; // MEDICARD has no consumer tiers or paid unlocks.
}
export const FREE_CONSUMER_RELEASE = isFreeConsumerRelease();
export function freeConsumerPackage() {
  return {
    id: 'medicard-free-access', code: 'FREE', nameKa: 'უფასო წვდომა', nameEn: 'Free access',
    descriptionKa: 'ყველა ფუნქცია უფასოდ, კომერციული გამოყენების ლიმიტის გარეშე.',
    monthlyAiLimit: -1, dailyAiLimit: -1, unlimited: true, priceGel: 0, billingPeriod: 'monthly',
    active: true, sortOrder: 0,
    features: { doctorChat: true, consilium: true, labAnalysis: true, imaging: true, skin: true, skincare: true, medicationReview: true },
  };
}
export function freeConsumerUsage(usage = {}) {
  return { ...usage, used: 0, limit: -1, remaining: -1, unlimited: true, exceeded: false,
    resetAt: null, resetsInMs: 0, resetKind: null, periodStart: null, periodEnd: null, refilled: false, refilledKey: null };
}
