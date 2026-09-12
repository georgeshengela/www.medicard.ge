/**
 * Cycle product modes.
 * Mode changes presentation / user goal. It does not change cycle arithmetic.
 * Live: CYCLE_TRACKING, TRYING_TO_CONCEIVE, PREGNANCY, PERIMENOPAUSE, POSTPARTUM.
 */

import { OBSERVATION_CATEGORIES, PRODUCT_MODES, UI_GROUPS } from './cycleObservationRegistry.js';
import {
  presentationCapabilitiesForProfileMode,
  supportsCycleCapability,
} from './cycleModeCapabilityMatrix.js';

export { PRODUCT_MODES };
export { presentationCapabilitiesForProfileMode, supportsCycleCapability };

export const LIVE_CYCLE_MODE = 'TRACK_PERIOD';

export const PROFILE_MODE_TO_PRODUCT = Object.freeze({
  TRACK_PERIOD: PRODUCT_MODES.CYCLE_TRACKING,
  TRY_TO_CONCEIVE: PRODUCT_MODES.TRYING_TO_CONCEIVE,
  PREGNANCY: PRODUCT_MODES.PREGNANCY,
  PERIMENOPAUSE: PRODUCT_MODES.PERIMENOPAUSE,
  POSTPARTUM: PRODUCT_MODES.POSTPARTUM,
});

export const CYCLE_MODE_CAPABILITIES = Object.freeze({
  [PRODUCT_MODES.CYCLE_TRACKING]: {
    live: true,
    visibleObservationGroups: [
      UI_GROUPS.PHYSICAL,
      UI_GROUPS.ENERGY,
      UI_GROUPS.MOOD,
      UI_GROUPS.DIGESTION,
      UI_GROUPS.SKIN,
      UI_GROUPS.FERTILITY,
      UI_GROUPS.PRIVATE,
    ],
    visibleObservationCategories: [
      OBSERVATION_CATEGORIES.MENSTRUAL,
      OBSERVATION_CATEGORIES.PHYSICAL,
      OBSERVATION_CATEGORIES.PAIN,
      OBSERVATION_CATEGORIES.MOOD,
      OBSERVATION_CATEGORIES.ENERGY,
      OBSERVATION_CATEGORIES.SLEEP,
      OBSERVATION_CATEGORIES.DIGESTION,
      OBSERVATION_CATEGORIES.SKIN,
      OBSERVATION_CATEGORIES.HEADACHE,
      OBSERVATION_CATEGORIES.DISCHARGE,
      OBSERVATION_CATEGORIES.FERTILITY,
      OBSERVATION_CATEGORIES.SEXUAL_HEALTH,
      OBSERVATION_CATEGORIES.PREGNANCY_TEST,
      OBSERVATION_CATEGORIES.FREE_TEXT,
      OBSERVATION_CATEGORIES.CUSTOM_TAG,
    ],
    predictionFeatures: ['nextPeriod', 'ovulationEstimate', 'fertileWindowEstimate', 'latePeriod'],
    journalSections: ['predictionHistory', 'periodHistory', 'pain', 'symptoms', 'moods'],
    notificationTypes: ['period', 'ovulationEstimate', 'fertileWindowEstimate', 'latePeriod'],
    engineUsesObservations: ['flow'],
    ...presentationCapabilitiesForProfileMode('TRACK_PERIOD'),
  },
  [PRODUCT_MODES.TRYING_TO_CONCEIVE]: {
    live: true,
    visibleObservationGroups: [
      UI_GROUPS.PHYSICAL,
      UI_GROUPS.ENERGY,
      UI_GROUPS.MOOD,
      UI_GROUPS.DIGESTION,
      UI_GROUPS.SKIN,
      UI_GROUPS.FERTILITY,
      UI_GROUPS.PRIVATE,
    ],
    visibleObservationCategories: [
      OBSERVATION_CATEGORIES.MENSTRUAL,
      OBSERVATION_CATEGORIES.PHYSICAL,
      OBSERVATION_CATEGORIES.PAIN,
      OBSERVATION_CATEGORIES.MOOD,
      OBSERVATION_CATEGORIES.ENERGY,
      OBSERVATION_CATEGORIES.SLEEP,
      OBSERVATION_CATEGORIES.DIGESTION,
      OBSERVATION_CATEGORIES.SKIN,
      OBSERVATION_CATEGORIES.HEADACHE,
      OBSERVATION_CATEGORIES.DISCHARGE,
      OBSERVATION_CATEGORIES.FERTILITY,
      OBSERVATION_CATEGORIES.SEXUAL_HEALTH,
      OBSERVATION_CATEGORIES.PREGNANCY_TEST,
      OBSERVATION_CATEGORIES.FREE_TEXT,
      OBSERVATION_CATEGORIES.CUSTOM_TAG,
    ],
    predictionFeatures: ['nextPeriod', 'ovulationEstimate', 'fertileWindowEstimate', 'latePeriod'],
    journalSections: ['predictionHistory', 'periodHistory', 'opk', 'bbt', 'mucus', 'pregnancyTests'],
    notificationTypes: ['period', 'ovulationEstimate', 'fertileWindowEstimate', 'latePeriod', 'opk', 'bbt'],
    engineUsesObservations: ['flow'],
    ...presentationCapabilitiesForProfileMode('TRY_TO_CONCEIVE'),
    futureOnly: ['conceptionProbability', 'confirmedOvulation'],
  },
  [PRODUCT_MODES.PREGNANCY]: {
    live: true,
    visibleObservationGroups: [
      UI_GROUPS.PHYSICAL,
      UI_GROUPS.ENERGY,
      UI_GROUPS.MOOD,
      UI_GROUPS.DIGESTION,
      UI_GROUPS.SKIN,
      UI_GROUPS.PRIVATE,
    ],
    visibleObservationCategories: [
      OBSERVATION_CATEGORIES.MENSTRUAL,
      OBSERVATION_CATEGORIES.PHYSICAL,
      OBSERVATION_CATEGORIES.PAIN,
      OBSERVATION_CATEGORIES.MOOD,
      OBSERVATION_CATEGORIES.ENERGY,
      OBSERVATION_CATEGORIES.SLEEP,
      OBSERVATION_CATEGORIES.DIGESTION,
      OBSERVATION_CATEGORIES.SKIN,
      OBSERVATION_CATEGORIES.HEADACHE,
      OBSERVATION_CATEGORIES.DISCHARGE,
      OBSERVATION_CATEGORIES.PREGNANCY_TEST,
      OBSERVATION_CATEGORIES.FREE_TEXT,
      OBSERVATION_CATEGORIES.CUSTOM_TAG,
    ],
    predictionFeatures: [],
    journalSections: ['pregnancyContext', 'pregnancyHistory', 'periodHistory', 'predictionHistory', 'observationTrends'],
    notificationTypes: [],
    engineUsesObservations: ['flow'],
    ...presentationCapabilitiesForProfileMode('PREGNANCY'),
    futureOnly: ['pregnancyLikelihood', 'lossRecoveryState'],
  },
  [PRODUCT_MODES.PERIMENOPAUSE]: {
    live: true,
    visibleObservationGroups: [
      UI_GROUPS.PHYSICAL,
      UI_GROUPS.ENERGY,
      UI_GROUPS.MOOD,
      UI_GROUPS.DIGESTION,
      UI_GROUPS.SKIN,
      UI_GROUPS.PRIVATE,
    ],
    visibleObservationCategories: [
      OBSERVATION_CATEGORIES.MENSTRUAL,
      OBSERVATION_CATEGORIES.PHYSICAL,
      OBSERVATION_CATEGORIES.PAIN,
      OBSERVATION_CATEGORIES.MOOD,
      OBSERVATION_CATEGORIES.ENERGY,
      OBSERVATION_CATEGORIES.SLEEP,
      OBSERVATION_CATEGORIES.DIGESTION,
      OBSERVATION_CATEGORIES.SKIN,
      OBSERVATION_CATEGORIES.HEADACHE,
      OBSERVATION_CATEGORIES.DISCHARGE,
      OBSERVATION_CATEGORIES.SEXUAL_HEALTH,
      OBSERVATION_CATEGORIES.FREE_TEXT,
      OBSERVATION_CATEGORIES.CUSTOM_TAG,
    ],
    predictionFeatures: ['nextPeriod'],
    journalSections: ['bleedingHistory', 'cycleVariability', 'bodyChanges', 'periodHistory', 'predictionHistory'],
    notificationTypes: [],
    engineUsesObservations: ['flow'],
    ...presentationCapabilitiesForProfileMode('PERIMENOPAUSE'),
    futureOnly: ['perimenopauseDiagnosis'],
  },
  [PRODUCT_MODES.POSTPARTUM]: {
    live: true,
    visibleObservationGroups: [
      UI_GROUPS.PHYSICAL,
      UI_GROUPS.ENERGY,
      UI_GROUPS.MOOD,
      UI_GROUPS.DIGESTION,
      UI_GROUPS.SKIN,
      UI_GROUPS.PRIVATE,
    ],
    visibleObservationCategories: [
      OBSERVATION_CATEGORIES.MENSTRUAL,
      OBSERVATION_CATEGORIES.PHYSICAL,
      OBSERVATION_CATEGORIES.PAIN,
      OBSERVATION_CATEGORIES.MOOD,
      OBSERVATION_CATEGORIES.ENERGY,
      OBSERVATION_CATEGORIES.SLEEP,
      OBSERVATION_CATEGORIES.DIGESTION,
      OBSERVATION_CATEGORIES.SKIN,
      OBSERVATION_CATEGORIES.HEADACHE,
      OBSERVATION_CATEGORIES.FREE_TEXT,
      OBSERVATION_CATEGORIES.CUSTOM_TAG,
    ],
    predictionFeatures: [],
    journalSections: ['postpartumHistory', 'pain', 'symptoms', 'moods'],
    notificationTypes: [],
    engineUsesObservations: ['flow'],
    ...presentationCapabilitiesForProfileMode('POSTPARTUM'),
    futureOnly: ['postpartumRecoveryScore', 'returnOfFertility', 'breastfeedingFertility', 'epds'],
  },
});

export function productModeFromProfile(mode) {
  return PROFILE_MODE_TO_PRODUCT[mode] || PRODUCT_MODES.CYCLE_TRACKING;
}

export function modeCapabilities(productMode) {
  return CYCLE_MODE_CAPABILITIES[productMode] || CYCLE_MODE_CAPABILITIES[PRODUCT_MODES.CYCLE_TRACKING];
}

export function isLiveProductMode(productMode) {
  return Boolean(modeCapabilities(productMode).live);
}

export function isTtcProfileMode(mode) {
  return mode === 'TRY_TO_CONCEIVE';
}

export function isPregnancyProfileMode(mode) {
  return mode === 'PREGNANCY';
}

export function isPerimenopauseProfileMode(mode) {
  return mode === 'PERIMENOPAUSE';
}

export function isPostpartumProfileMode(mode) {
  return mode === 'POSTPARTUM';
}

/**
 * Mode string for Cycle CYCLE_WELLNESS user prompts.
 * PERIMENOPAUSE stays mapped to TRACK_PERIOD (Phase 24 freeze — not a diagnosis).
 * POSTPARTUM is not an AI-supported Cycle mode: omit context rather than remap.
 */
export function profileModeForAiPrompt(mode) {
  if (isPostpartumProfileMode(mode)) return null;
  if (mode === 'PERIMENOPAUSE') return 'TRACK_PERIOD';
  return mode;
}

export function isCycleAiContextSupported(mode) {
  return profileModeForAiPrompt(mode) != null;
}

/**
 * General Medi / onboarding extras: omit POSTPARTUM so it is not sent as
 * POSTPARTUM or as a fake TRACK_PERIOD. Other modes keep their stored value.
 */
export function cycleModeForPatientAiContext(mode) {
  if (!mode || isPostpartumProfileMode(mode)) return null;
  return mode;
}

export function capabilitiesForProfileMode(mode) {
  const product = productModeFromProfile(mode);
  const cap = modeCapabilities(product);
  const presentation = presentationCapabilitiesForProfileMode(mode);
  return {
    live: Boolean(cap.live),
    ...presentation,
    engineUsesObservations: cap.engineUsesObservations || ['flow'],
    futureOnly: cap.futureOnly || [],
  };
}
