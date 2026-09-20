import { pregnancyIllustrationWeek } from './pregnancyIllustrationStages';

const ASSETS: Record<number, number> = {
  6: require('../../assets/pregnancy-development/week-06.png'),
  8: require('../../assets/pregnancy-development/week-08.png'),
  12: require('../../assets/pregnancy-development/week-12.png'),
  16: require('../../assets/pregnancy-development/week-16.png'),
  20: require('../../assets/pregnancy-development/week-20.png'),
  24: require('../../assets/pregnancy-development/week-24.png'),
  32: require('../../assets/pregnancy-development/week-32.png'),
  38: require('../../assets/pregnancy-development/week-38.png'),
};
export function pregnancyDevelopmentAsset(week: number) {
  const stage = pregnancyIllustrationWeek(week);
  return stage == null ? null : { source: ASSETS[stage], stage };
}
