import { COMPARISON_KEYS } from './pregnancyWeekData.js';

export const PREGNANCY_SIZE_ASSETS = Object.freeze({
  poppy_seed: require('../../assets/pregnancy-size/poppy_seed.webp'),
  sesame: require('../../assets/pregnancy-size/sesame.webp'),
  blueberry: require('../../assets/pregnancy-size/blueberry.webp'),
  raspberry: require('../../assets/pregnancy-size/raspberry.webp'),
  strawberry: require('../../assets/pregnancy-size/strawberry.webp'),
  lime: require('../../assets/pregnancy-size/lime.webp'),
  lemon: require('../../assets/pregnancy-size/lemon.webp'),
  kiwi: require('../../assets/pregnancy-size/kiwi.webp'),
  avocado: require('../../assets/pregnancy-size/avocado.webp'),
  pear: require('../../assets/pregnancy-size/pear.webp'),
  mango: require('../../assets/pregnancy-size/mango.webp'),
  banana: require('../../assets/pregnancy-size/banana.webp'),
  eggplant: require('../../assets/pregnancy-size/eggplant.webp'),
  coconut: require('../../assets/pregnancy-size/coconut.webp'),
  pineapple: require('../../assets/pregnancy-size/pineapple.webp'),
  watermelon: require('../../assets/pregnancy-size/watermelon.webp'),
  placeholder: require('../../assets/pregnancy-size/placeholder.webp'),
});

export function pregnancySizeAsset(key) {
  if (key && PREGNANCY_SIZE_ASSETS[key]) return PREGNANCY_SIZE_ASSETS[key];
  return PREGNANCY_SIZE_ASSETS.placeholder;
}

export function pregnancySizeAssetKeys() {
  return [...COMPARISON_KEYS, 'placeholder'];
}
