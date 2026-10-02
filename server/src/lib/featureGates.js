import { requireFeature } from './featureFlags.js';

/**
 * Admin „მოდულები“ gates that depend on the path or body inside a router. `req.path` is relative
 * to the mount point and express.json has already parsed JSON bodies; multipart uploads check
 * their `kind` inside the route (ai.routes.js /analyze-image). Tests: featureGates.test.js.
 */
export const aiFeatureGates = [
  requireFeature('medi', { match: (req) => req.path !== '/feedback' }),
  requireFeature('mediDoctor', { match: (req) => req.path === '/query' && req.body?.mode === 'DOCTOR' }),
  requireFeature('mediDeep', { match: (req) => req.path === '/query' && req.body?.mode === 'CONSILIUM' }),
  requireFeature('symptoms', { match: (req) => req.path === '/symptom-check' }),
  requireFeature('skin', { match: (req) => req.path === '/skincare' }),
  requireFeature('labs', { match: (req) => /^\/(extract|explain|align)-lab$/.test(req.path) }),
  requireFeature('weight', { match: (req) => req.path === '/weight-advice' }),
  requireFeature('medications', { match: (req) => req.path === '/medication-review' }),
];

export const assistantFeatureGates = [
  requireFeature('medi'),
  requireFeature('voice', { match: (req) => req.path === '/transcribe' || req.path === '/speak' }),
];

// Device syncs (/sync) stay open even when a tracker is paused: blocking them would make phones retry.
export const healthMetricsFeatureGates = [
  requireFeature('hydration', { match: (req) => req.path === '/hydration/goal' }),
];
