/**
 * Comprehensive Health Assessment — matches `Comprehensive Health Assessment.svg`
 * (Figma section 11369:92319, 31 frames left-to-right).
 */
export type AssessmentStepType =
  | 'intro'
  | 'legal-name'
  | 'health-goals'
  | 'birthdate'
  | 'gender'
  | 'body-type'
  | 'weight'
  | 'height'
  | 'blood-type'
  | 'fitness-level'
  | 'sleep-level'
  | 'smoking'
  | 'mood'
  | 'diet-habits'
  | 'medications-gate'
  | 'medications-list'
  | 'allergies'
  | 'conditions-gate'
  | 'conditions-list'
  | 'checkup-frequency'
  | 'complete';

export type AssessmentStep = {
  key: string;
  figmaId: string;
  type: AssessmentStepType;
  titleKey: string;
  bodyKey?: string;
  skippable?: boolean;
};

/** Frame order from exported SVG slices (see scripts/figma/import-assessment-svg.mjs). */
export const ASSESSMENT_STEPS: AssessmentStep[] = [
  { key: '01-intro', figmaId: '9217:164373', type: 'intro', titleKey: 'introTitle', bodyKey: 'introBody' },
  { key: '02-name', figmaId: '9217:164410', type: 'legal-name', titleKey: 'nameTitle', bodyKey: 'nameBody' },
  { key: '05-goals', figmaId: '9217:164456', type: 'health-goals', titleKey: 'goalsTitle', bodyKey: 'goalsBody' },
  { key: '06-birthdate', figmaId: '9217:164472', type: 'birthdate', titleKey: 'birthdateTitle', bodyKey: 'birthdateBody' },
  { key: '07-gender', figmaId: '9217:164488', type: 'gender', titleKey: 'genderTitle', bodyKey: 'genderBody' },
  { key: '08-body-type', figmaId: '9217:164506', type: 'body-type', titleKey: 'bodyTypeTitle', bodyKey: 'bodyTypeBody', skippable: true },
  { key: '09-weight', figmaId: '9217:164526', type: 'weight', titleKey: 'weightTitle', bodyKey: 'weightBody', skippable: true },
  { key: '10-height', figmaId: '9217:164587', type: 'height', titleKey: 'heightTitle', bodyKey: 'heightBody', skippable: true },
  { key: '11-blood-type', figmaId: '9217:164607', type: 'blood-type', titleKey: 'bloodTypeTitle', bodyKey: 'bloodTypeBody', skippable: true },
  { key: '12-fitness', figmaId: '9217:164626', type: 'fitness-level', titleKey: 'fitnessTitle', bodyKey: 'fitnessBody', skippable: true },
  { key: '13-sleep', figmaId: '9217:164657', type: 'sleep-level', titleKey: 'sleepTitle', bodyKey: 'sleepBody', skippable: true },
  { key: '14-smoking', figmaId: '11332:64167', type: 'smoking', titleKey: 'smokingTitle', bodyKey: 'smokingBody', skippable: true },
  { key: '15-mood', figmaId: '9217:164703', type: 'mood', titleKey: 'moodTitle', bodyKey: 'moodBody', skippable: true },
  { key: '16-diet', figmaId: '9217:164726', type: 'diet-habits', titleKey: 'dietTitle', bodyKey: 'dietBody', skippable: true },
  { key: '17-meds-gate', figmaId: '9217:164789', type: 'medications-gate', titleKey: 'medsGateTitle', bodyKey: 'medsGateBody', skippable: true },
  { key: '18-meds-list', figmaId: '9217:164803', type: 'medications-list', titleKey: 'medsListTitle', bodyKey: 'medsListBody', skippable: true },
  { key: '19-allergies', figmaId: '9217:164840', type: 'allergies', titleKey: 'allergiesTitle', bodyKey: 'allergiesBody', skippable: true },
  { key: '20-conditions-gate', figmaId: '9217:164822', type: 'conditions-gate', titleKey: 'conditionsGateTitle', bodyKey: 'conditionsGateBody', skippable: true },
  { key: '21-conditions-list', figmaId: '9217:164855', type: 'conditions-list', titleKey: 'conditionsListTitle', bodyKey: 'conditionsListBody', skippable: true },
  { key: '22-checkup', figmaId: '9217:164958', type: 'checkup-frequency', titleKey: 'checkupTitle', bodyKey: 'checkupBody', skippable: true },
  { key: '27-complete', figmaId: '9217:165096', type: 'complete', titleKey: 'completeTitle', bodyKey: 'completeBody' },
];

export const ACTIVE_ASSESSMENT_STEPS = ASSESSMENT_STEPS;

export function assessmentProgressFraction(activeIndex: number): number {
  const total = ACTIVE_ASSESSMENT_STEPS.length;
  if (total <= 1) return 0;
  return Math.min(1, Math.max(0, activeIndex / (total - 1)));
}

export function assessmentProgressState(activeIndex: number) {
  const fraction = assessmentProgressFraction(activeIndex);
  return {
    visible: true,
    fraction,
    activeSegment: Math.floor(fraction * 6),
    activeFill: (fraction * 6) % 1 || (fraction >= 1 ? 1 : 0.5),
  };
}
