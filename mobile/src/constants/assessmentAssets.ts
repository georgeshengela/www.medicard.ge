import type { ImageSourcePropType } from 'react-native';

/** PNG slices from `Comprehensive Health Assessment.svg` (import-assessment-svg.mjs). */
export const ASSESSMENT_FRAME_SOURCES: Record<string, ImageSourcePropType> = {
  '01-intro': require('../../assets/figma/assessment/01-intro.png'),
  '02-name': require('../../assets/figma/assessment/02-overview.png'),
  '05-goals': require('../../assets/figma/assessment/05-height.png'),
  '06-birthdate': require('../../assets/figma/assessment/06-weight.png'),
  '07-gender': require('../../assets/figma/assessment/07-bmi.png'),
  '08-body-type': require('../../assets/figma/assessment/08-activity.png'),
  '09-weight': require('../../assets/figma/assessment/09-exercise.png'),
  '10-height': require('../../assets/figma/assessment/10-sleep-quality.png'),
  '11-blood-type': require('../../assets/figma/assessment/11-sleep-hours.png'),
  '12-fitness': require('../../assets/figma/assessment/12-stress.png'),
  '13-sleep': require('../../assets/figma/assessment/13-smoking.png'),
  '14-smoking': require('../../assets/figma/assessment/14-alcohol.png'),
  '15-mood': require('../../assets/figma/assessment/15-diet.png'),
  '16-diet': require('../../assets/figma/assessment/16-water.png'),
  '17-meds-gate': require('../../assets/figma/assessment/17-conditions.png'),
  '18-meds-list': require('../../assets/figma/assessment/18-medications.png'),
  '19-allergies': require('../../assets/figma/assessment/20-family.png'),
  '20-conditions-gate': require('../../assets/figma/assessment/21-blood-type.png'),
  '21-conditions-list': require('../../assets/figma/assessment/22-voice-a.png'),
  '22-checkup': require('../../assets/figma/assessment/25-voice-processing.png'),
  '27-complete': require('../../assets/figma/assessment/31-complete.png'),
};

export function assessmentFrameForStep(stepKey: string): ImageSourcePropType | null {
  return ASSESSMENT_FRAME_SOURCES[stepKey] ?? null;
}
