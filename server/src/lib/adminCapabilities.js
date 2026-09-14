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
