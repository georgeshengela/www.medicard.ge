/**
 * Mode-aware Cycle history / empty-state copy.
 *
 * Presentation only. Does not classify bleeding, change forecast math,
 * or scatter profile.mode enum checks through UI files.
 *
 * Unknown / pending mode must not fall back to TRACK_PERIOD menstrual copy.
 */

import {
  CYCLE_PROFILE_MODES,
  presentationCapabilitiesForProfileMode,
} from './cycleModeCapabilityMatrix.js';

const MENSTRUAL_ASSUMPTION_RE = /მენსტრუაც/;
const LOCHIA_RE = /ლოხია|lochia/i;
const HEMORRHAGE_RE = /ჰემორაგ|სისხლდენა მასიური|postpartum hemorrhage|\bPPH\b/i;
const RETURN_OF_PERIOD_RE = /მენსტრუაცია დაბრუნ|ციკლი განახლ|პირველი მენსტრუაცია მშობიარობის/i;

export function cyclePresentationModeKnown(mode) {
  return CYCLE_PROFILE_MODES.includes(mode);
}

/**
 * @param {string|null|undefined} mode
 */
export function cycleHistoryPresentation(mode) {
  if (!cyclePresentationModeKnown(mode)) {
    return {
      ready: false,
      showPeriodHistory: false,
      showPredictionHistory: false,
      showClassicJournalEmpty: false,
      showPmsPattern: false,
      showPostpartumJournal: false,
      usePostpartumBleedLabel: false,
      hideMenstrualEmpty: true,
    };
  }
  const caps = presentationCapabilitiesForProfileMode(mode);
  const postpartum = Boolean(caps.showPostpartumTracking);
  return {
    ready: true,
    showPeriodHistory: !postpartum,
    showPredictionHistory: !postpartum,
    showClassicJournalEmpty: !postpartum,
    showPmsPattern: !postpartum && Boolean(caps.showClassicCycleOverview),
    showPostpartumJournal: postpartum,
    usePostpartumBleedLabel: postpartum,
    hideMenstrualEmpty: postpartum,
  };
}

export function cycleLoggedBleedLabel(mode, copy) {
  const presentation = cycleHistoryPresentation(mode);
  if (!presentation.ready) return copy.logged;
  return presentation.usePostpartumBleedLabel ? copy.postpartumBleeding : copy.legendPeriod;
}

export function cycleJournalEmptyStrings(mode, copy) {
  const presentation = cycleHistoryPresentation(mode);
  if (!presentation.ready) return { pending: true, strings: [] };
  const strings = [];
  if (presentation.showPostpartumJournal) {
    strings.push(copy.postpartumJournalTitle, copy.postpartumJournalEmpty);
    if (copy.postpartumAddLog) strings.push(copy.postpartumAddLog);
  }
  if (presentation.showClassicJournalEmpty) {
    strings.push(copy.journalEmptyTitle, copy.journalEmptyBody);
  }
  return { pending: false, strings };
}

export function cycleSummaryEmptyStrings(mode, copy) {
  const presentation = cycleHistoryPresentation(mode);
  if (!presentation.ready) return { pending: true, strings: [] };
  if (!presentation.showPeriodHistory) return { pending: false, strings: [] };
  return {
    pending: false,
    strings: [copy.periodHistoryEmpty, copy.periodHistoryEmptyHint, copy.addMissedPeriod],
  };
}

export function copyContainsMenstrualAssumption(text) {
  return MENSTRUAL_ASSUMPTION_RE.test(String(text || ''));
}

export function copyContainsForbiddenPostpartumBleedClass(text) {
  const value = String(text || '');
  return LOCHIA_RE.test(value) || HEMORRHAGE_RE.test(value) || RETURN_OF_PERIOD_RE.test(value);
}

export function assertPostpartumEmptyCopySafe(strings) {
  for (const value of strings || []) {
    if (copyContainsMenstrualAssumption(value)) {
      throw new Error(`menstrual assumption in postpartum empty copy: ${value}`);
    }
    if (copyContainsForbiddenPostpartumBleedClass(value)) {
      throw new Error(`unsafe postpartum bleed classification: ${value}`);
    }
  }
}
