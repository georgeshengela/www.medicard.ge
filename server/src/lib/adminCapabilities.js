/**
 * Phase 8 — Admin capability checks.
 * Legacy admins with capabilities=null|undefined get full access.
 */

export const REWARDS_CAPABILITIES = Object.freeze([
  'REWARDS_VIEW',
  'REWARDS_MANAGE',
  'PARTNERS_VIEW',
  'PARTNERS_MANAGE',
  'REWARD_CODES_MANAGE',
  'REDEMPTIONS_VIEW',
  'REDEMPTIONS_MANAGE',
  'REWARDS_ANALYTICS_VIEW',
]);

export const MEDIPULSI_CAPABILITIES = Object.freeze(['MEDIPULSI_VIEW','MEDIPULSI_MANAGE','MEDIPULSI_REVIEW']);
export const NUTRITION_CAPABILITIES = Object.freeze(['NUTRITION_VIEW', 'NUTRITION_MANAGE']);
export const QA_CAPABILITIES = Object.freeze(['QA_VIEW', 'QA_MANAGE']);
export const COMMUNITY_CAPABILITIES = Object.freeze(['COMMUNITY_VIEW', 'COMMUNITY_MANAGE']);

export function normalizeCapabilities(raw) {
  if (raw == null) return null; // full access
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];
  }
  return [];
}

export function adminHasCapability(admin, capability) {
  const caps = normalizeCapabilities(admin?.capabilities);
  if (caps == null) return true;
  return caps.includes(String(capability));
}

export function requireAdminCapability(capability) {
  return function capabilityGuard(req, res, next) {
    if (!req.admin) {
      return res.status(401).json({ error: 'ადმინისტრატორის ავტორიზაცია საჭიროა.' });
    }
    if (!adminHasCapability(req.admin, capability)) {
      return res.status(403).json({
        error: 'არ გაქვთ ამ მოქმედების უფლება.',
        code: 'ADMIN_CAPABILITY_DENIED',
        capability,
      });
    }
    return next();
  };
}

export function requireAnyAdminCapability(...capabilities) {
  return function capabilityGuard(req, res, next) {
    if (!req.admin) {
      return res.status(401).json({ error: 'ადმინისტრატორის ავტორიზაცია საჭიროა.' });
    }
    if (capabilities.some((capability) => adminHasCapability(req.admin, capability))) {
      return next();
    }
    return res.status(403).json({
      error: 'არ გაქვთ ამ მოქმედების უფლება.',
      code: 'ADMIN_CAPABILITY_DENIED',
      capability: capabilities[0],
    });
  };
}

/** Support inbox (#/support): VIEW reads threads and attachments; MANAGE replies, assigns, changes status, edits snippets. */
export const SUPPORT_CAPABILITIES = Object.freeze(['SUPPORT_VIEW', 'SUPPORT_MANAGE']);

/** MEDICOACH (#/trainers): VIEW reads applications, certificates and gyms; MANAGE verifies/suspends trainers and edits gyms. */
export const TRAINER_CAPABILITIES = Object.freeze(['TRAINER_VIEW', 'TRAINER_MANAGE']);

/** Home news cards (#/news): everyone may read the list; MANAGE creates, edits, publishes and archives. */
export const NEWS_CAPABILITIES = Object.freeze(['NEWS_MANAGE']);

/** MEDIVET usage (#/pets): VIEW reads the counts, the pet list (names, species, owner contact) and Medi Vet topic counts. */
export const PETS_CAPABILITIES = Object.freeze(['PETS_VIEW']);

/** MEDIFAMILY usage (#/family): VIEW reads aggregate counts only — never a child's name, birth date or health value. */
export const FAMILY_CAPABILITIES = Object.freeze(['FAMILY_VIEW']);

/** Module usage pages (MEDICYCLE, MEDIPILL, MEDILAB, MEDIFOOD, MEDIQUEST, MEDICOACH, Medi): counts, people with a name and contact, no health values. */
export const PRODUCT_USAGE_CAPABILITIES = Object.freeze(['PRODUCT_USAGE_VIEW']);

/** MEDISLEEP (#/sleep): VIEW reads usage counts and the catalogue; MANAGE edits sounds (uploads), advice and module settings. */
export const SLEEP_CAPABILITIES = Object.freeze(['SLEEP_VIEW', 'SLEEP_MANAGE']);

/** MEDIHOROSCOPE (#/horoscope): VIEW reads readings, library, generator log and usage counts; MANAGE edits texts, writes again and changes settings. */
export const HOROSCOPE_CAPABILITIES = Object.freeze(['HOROSCOPE_VIEW', 'HOROSCOPE_MANAGE']);

/** MEDIBOOK (#/book): VIEW reads claims, the catalogue and booking counts; MANAGE approves/rejects claims and edits or hides businesses. */
export const BOOK_CAPABILITIES = Object.freeze(['BOOK_VIEW', 'BOOK_MANAGE']);
