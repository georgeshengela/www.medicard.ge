import { COMPANION_STAGES } from './catalog.js';

/** Visual maturity stage from authoritative quest level. No persisted avatar level. */
export function resolveCompanionStage(level) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  for (const stage of COMPANION_STAGES) {
    if (stage.maxLevel == null) {
      if (n >= stage.minLevel) return stage.key;
      continue;
    }
    if (n >= stage.minLevel && n <= stage.maxLevel) return stage.key;
  }
  return 'STAGE_1';
}
