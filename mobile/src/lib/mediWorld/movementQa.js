'use strict';

/**
 * Development-only Movement QA arms.
 * Impossible in production store builds (__DEV__ is false).
 * Not shown in ordinary navigation. Native samples still come from expo-location;
 * this only overwrites accuracy after toFix().
 */

let inaccurateArmed = false;

function isMovementQaAllowed() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function armMovementInaccurateOnce() {
  if (!isMovementQaAllowed()) return false;
  inaccurateArmed = true;
  return true;
}

function applyMovementQaFix(fix) {
  if (!fix || !isMovementQaAllowed() || !inaccurateArmed) return fix;
  inaccurateArmed = false;
  return { ...fix, accuracy: 80, approximate: true };
}

function resetMovementQa() {
  inaccurateArmed = false;
}

function isMovementInaccurateArmed() {
  return inaccurateArmed === true;
}

module.exports = {
  isMovementQaAllowed,
  armMovementInaccurateOnce,
  applyMovementQaFix,
  resetMovementQa,
  isMovementInaccurateArmed,
};
