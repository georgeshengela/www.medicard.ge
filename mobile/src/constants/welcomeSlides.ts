/**
 * All 12 Welcome Screen frames from Figma (Nightingale v3, light, 375×812).
 * Refresh PNGs: npm run figma:welcome (needs FIGMA_TOKEN in .env)
 */
export type WelcomeSlideKind = 'landing' | 'carousel';

export type WelcomeSlideDef = {
  key: string;
  figmaId: string;
  kind: WelcomeSlideKind;
  frame: number;
  titleKey: string;
  bodyKey: string;
};

export const WELCOME_SLIDES: WelcomeSlideDef[] = [
  { key: '01-landing', figmaId: '9217:161540', kind: 'landing', frame: require('../../assets/figma/welcome/01-landing.png'), titleKey: 'landingTitle', bodyKey: 'landingBody' },
  { key: '02-health-score', figmaId: '9217:161680', kind: 'carousel', frame: require('../../assets/figma/welcome/02-health-score.png'), titleKey: 'healthScoreTitle', bodyKey: 'healthScoreBody' },
  { key: '03-metrics', figmaId: '9217:161767', kind: 'carousel', frame: require('../../assets/figma/welcome/03-metrics.png'), titleKey: 'metricsTitle', bodyKey: 'metricsBody' },
  { key: '04-assessment', figmaId: '11331:164794', kind: 'carousel', frame: require('../../assets/figma/welcome/04-assessment.png'), titleKey: 'assessmentTitle', bodyKey: 'assessmentBody' },
  { key: '05-doctor', figmaId: '9217:161791', kind: 'carousel', frame: require('../../assets/figma/welcome/05-doctor.png'), titleKey: 'doctorTitle', bodyKey: 'doctorBody' },
  { key: '06-pharmacy', figmaId: '11331:165057', kind: 'carousel', frame: require('../../assets/figma/welcome/06-pharmacy.png'), titleKey: 'pharmacyTitle', bodyKey: 'pharmacyBody' },
  { key: '07-medications', figmaId: '9217:161816', kind: 'carousel', frame: require('../../assets/figma/welcome/07-medications.png'), titleKey: 'medicationsTitle', bodyKey: 'medicationsBody' },
  { key: '08-lab', figmaId: '11331:165357', kind: 'carousel', frame: require('../../assets/figma/welcome/08-lab.png'), titleKey: 'labTitle', bodyKey: 'labBody' },
  { key: '09-wellness', figmaId: '9217:161998', kind: 'carousel', frame: require('../../assets/figma/welcome/09-wellness.png'), titleKey: 'wellnessTitle', bodyKey: 'wellnessBody' },
  { key: '10-family', figmaId: '9217:162053', kind: 'carousel', frame: require('../../assets/figma/welcome/10-family.png'), titleKey: 'familyTitle', bodyKey: 'familyBody' },
  { key: '11-insights', figmaId: '11331:165501', kind: 'carousel', frame: require('../../assets/figma/welcome/11-insights.png'), titleKey: 'insightsTitle', bodyKey: 'insightsBody' },
  { key: '12-achievements', figmaId: '9217:162120', kind: 'carousel', frame: require('../../assets/figma/welcome/12-achievements.png'), titleKey: 'achievementsTitle', bodyKey: 'achievementsBody' },
];

export const WELCOME_SLIDE_COUNT = WELCOME_SLIDES.length;
