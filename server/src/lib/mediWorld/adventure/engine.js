/**
 * Medi World Phase 41 — pure deterministic Adventure engine.
 * No LLM. No currency. Never mutates canonical Quest targets.
 */

import {
  ADVENTURE_RULESET_ID,
  MAX_SWAPS_PER_DAY,
  capabilityByKey,
} from './registry.js';
import { narrativeKeyForPlan } from './narrative.js';

function compareKey(a, b) {
  return String(a).localeCompare(String(b));
}

function scoreCapability(cap, input, assignedKeys) {
  let score = 0;
  if (assignedKeys.has(cap.key)) score += 1000;
  const recentCategories = input.recentCategories || [];
  if (recentCategories.includes(cap.energyType)) score -= 40;
  const outcome = input.recentOutcomes?.[cap.key] || { completed: 0, missed: 0 };
  if ((outcome.missed || 0) >= 2) score -= 15;
  if ((outcome.completed || 0) >= 1) score += 8;
  if ((input.newlyEnabled || []).includes(cap.key)) score += 5;
  if (cap.slots.includes('anchor')) score += 2;
  if (cap.key === 'companion.care_moment' && input.intensity === 'active') score -= 4;
  return score;
}

function sortEligible(eligible, input, assignedKeys) {
  return [...eligible].sort((a, b) => {
    const diff = scoreCapability(b, input, assignedKeys) - scoreCapability(a, input, assignedKeys);
    if (diff !== 0) return diff;
    return compareKey(a.key, b.key);
  });
}

function requiredCount(input, eligibleCount) {
  if (eligibleCount <= 1) return 1;
  if (input.intensity === 'gentle' || (input.recentMissStreak || 0) >= 2) return 1;
  return 2;
}

function wantsChoice(input, eligibleCount, required) {
  if (!input.allowVariety) return false;
  if (input.intensity === 'gentle') return false;
  if ((input.recentMissStreak || 0) >= 2) return false;
  const leftover = eligibleCount - required;
  if (leftover < 2) return false;
  if (input.intensity === 'active') return true;
  return leftover >= 2 && (input.recentCompleteStreak || 0) >= 0;
}

/**
 * @param {object} input
 * @returns {{
 *   slots: Array<object>,
 *   restDay: boolean,
 *   reasonCodes: string[],
 *   narrativeKey: string,
 *   rulesetVersion: string,
 * }}
 */
export function planAdventure(input) {
  const eligible = [...(input.eligible || [])].filter((row) => row && row.active !== false);
  const assignedKeys = new Set((input.assignedQuests || []).map((row) => row.capabilityKey).filter(Boolean));
  const reasonCodes = [];

  if (input.restDay) {
    const restPool = eligible.filter((row) => row.restCompatible);
    if (!restPool.length) {
      reasonCodes.push('REST_DAY', 'NO_COMPATIBLE_ACTION');
      return {
        slots: [],
        restDay: true,
        reasonCodes,
        narrativeKey: narrativeKeyForPlan({ restDay: true, empty: true, intensity: input.intensity }),
        rulesetVersion: ADVENTURE_RULESET_ID,
      };
    }
    const ordered = sortEligible(restPool, input, assignedKeys);
    const pick = ordered[0];
    reasonCodes.push('REST_DAY', 'REST_SMALLEST_PATH');
    return {
      slots: [
        {
          slotKey: 'anchor',
          optionKey: 'a',
          capabilityKey: pick.key,
          required: false,
          selected: true,
        },
      ],
      restDay: true,
      reasonCodes,
      narrativeKey: narrativeKeyForPlan({ restDay: true, empty: false, intensity: input.intensity }),
      rulesetVersion: ADVENTURE_RULESET_ID,
    };
  }

  if (!eligible.length) {
    reasonCodes.push('NO_COMPATIBLE_ACTION');
    return {
      slots: [],
      restDay: false,
      reasonCodes,
      narrativeKey: narrativeKeyForPlan({ restDay: false, empty: true, intensity: input.intensity }),
      rulesetVersion: ADVENTURE_RULESET_ID,
    };
  }

  const ordered = sortEligible(eligible, input, assignedKeys);
  const size = requiredCount(input, ordered.length);
  if (ordered.length === 1) reasonCodes.push('ONE_CAPABILITY_HONEST');
  if ((input.recentMissStreak || 0) >= 2) reasonCodes.push('REDUCED_PRESSURE_AFTER_MISS');
  if ((input.recentCompleteStreak || 0) >= 2) reasonCodes.push('VARIETY_AFTER_COMPLETION');

  const slots = [];
  const used = new Set();
  const anchor = ordered[0];
  slots.push({
    slotKey: 'anchor',
    optionKey: 'a',
    capabilityKey: anchor.key,
    required: true,
    selected: true,
  });
  used.add(anchor.key);
  reasonCodes.push(assignedKeys.has(anchor.key) ? 'ANCHOR_ASSIGNED_QUEST' : 'ANCHOR_BEST_ELIGIBLE');

  if (size >= 2) {
    const different = ordered.find((row) => !used.has(row.key) && row.energyType !== anchor.energyType);
    const fallback = ordered.find((row) => !used.has(row.key));
    const balance = different || fallback;
    if (balance) {
      slots.push({
        slotKey: 'balance',
        optionKey: 'a',
        capabilityKey: balance.key,
        required: true,
        selected: true,
      });
      used.add(balance.key);
      reasonCodes.push(
        balance.energyType !== anchor.energyType ? 'BALANCE_DIFFERENT_CATEGORY' : 'BALANCE_LIMITED_VARIETY',
      );
    }
  }

  if (wantsChoice(input, ordered.length, slots.filter((row) => row.required).length)) {
    const remaining = ordered.filter((row) => !used.has(row.key));
    if (remaining.length >= 2) {
      slots.push({
        slotKey: 'choice',
        optionKey: 'a',
        capabilityKey: remaining[0].key,
        required: false,
        selected: false,
      });
      slots.push({
        slotKey: 'choice',
        optionKey: 'b',
        capabilityKey: remaining[1].key,
        required: false,
        selected: false,
      });
      reasonCodes.push('CHOICE_OPTIONAL_VARIETY');
    } else {
      reasonCodes.push('CHOICE_SKIPPED_NO_ALTERNATIVE');
    }
  }

  return {
    slots,
    restDay: false,
    reasonCodes,
    narrativeKey: narrativeKeyForPlan({
      restDay: false,
      empty: false,
      intensity: input.intensity,
      hasChoice: slots.some((row) => row.slotKey === 'choice'),
      slotCount: slots.filter((row) => row.slotKey !== 'choice' || row.optionKey === 'a').length,
    }),
    rulesetVersion: ADVENTURE_RULESET_ID,
  };
}

export function planReplacement({ currentKey, usedKeys, eligible, recentCategories = [] }) {
  const current = capabilityByKey(currentKey);
  const used = new Set(usedKeys || []);
  const pool = (eligible || []).filter((row) => row && row.active !== false && row.key !== currentKey);
  const unused = pool.filter((row) => !used.has(row.key));
  const candidates = unused.length ? unused : pool;
  if (!candidates.length) {
    return { ok: false, reasonCode: 'NO_ALTERNATIVE' };
  }
  const different = current
    ? candidates.filter((row) => row.energyType !== current.energyType)
    : candidates;
  const ranked = [...(different.length ? different : candidates)].sort((a, b) => {
    const aRecent = recentCategories.includes(a.energyType) ? 1 : 0;
    const bRecent = recentCategories.includes(b.energyType) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent;
    return compareKey(a.key, b.key);
  });
  return {
    ok: true,
    capabilityKey: ranked[0].key,
    reasonCode: unused.length ? 'SWAP_ALTERNATIVE' : 'SWAP_ONLY_REPEAT_AVAILABLE',
  };
}

export { MAX_SWAPS_PER_DAY };
