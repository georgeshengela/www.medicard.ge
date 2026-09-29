/**
 * Georgian copy for pregnancy week catalog keys.
 * Medical numbers stay in pregnancyWeekData.js. Do not put sentences in the dataset.
 * English tables follow the app language (`isEn()`); the Georgian exports stay for callers/tests.
 */

import { isEn } from '../i18n/locale.js';

export const PREGNANCY_COMPARISON_KA = Object.freeze({
  poppy_seed: 'ყაყაჩოს თესლი',
  sesame: 'ქუნჯუტი',
  blueberry: 'მოცვი',
  raspberry: 'ჟოლო',
  strawberry: 'მარწყვი',
  lime: 'ლაიმი',
  lemon: 'ლიმონი',
  kiwi: 'კივი',
  avocado: 'ავოკადო',
  pear: 'მსხალი',
  mango: 'მანგო',
  banana: 'ბანანი',
  eggplant: 'ბადრიჯანი',
  coconut: 'ქოქოსი',
  pineapple: 'ანანასი',
  watermelon: 'საზამთრო',
});

/** Genitive-ish line: "დაახლოებით ჟოლოს ზომაა" */
export const PREGNANCY_COMPARISON_LINE_KA = Object.freeze({
  poppy_seed: 'დაახლოებით ყაყაჩოს თესლის ზომაა',
  sesame: 'დაახლოებით ქუნჯუტის ზომაა',
  blueberry: 'დაახლოებით მოცვის ზომაა',
  raspberry: 'დაახლოებით ჟოლოს ზომაა',
  strawberry: 'დაახლოებით მარწყვის ზომაა',
  lime: 'დაახლოებით ლაიმის ზომაა',
  lemon: 'დაახლოებით ლიმონის ზომაა',
  kiwi: 'დაახლოებით კივის ზომაა',
  avocado: 'დაახლოებით ავოკადოს ზომაა',
  pear: 'დაახლოებით მსხლის ზომაა',
  mango: 'დაახლოებით მანგოს ზომაა',
  banana: 'დაახლოებით ბანანის ზომაა',
  eggplant: 'დაახლოებით ბადრიჯნის ზომაა',
  coconut: 'დაახლოებით ქოქოსის ზომაა',
  pineapple: 'დაახლოებით ანანასის ზომაა',
  watermelon: 'დაახლოებით საზამთროს ზომაა',
});

export const PREGNANCY_FACT_KA = Object.freeze({
  informational_dating:
    'ორსულობის კვირა საცნობი თარიღიდან ითვლება. ეს არ არის ულტრაბგერის დათარიღება.',
  microscopic_scale: 'ამ ეტაპზე განვითარება მიკროსკოპულ დონეზეა და ზომის შედარება ჯერ არ არის საიმედო.',
  neural_fold_forming: 'ნერვული მილი ყალიბდება.',
  heart_tube_forming: 'გულის მილი ყალიბდება.',
  limb_buds_appearing: 'კიდურების კვირტები ჩნდება.',
  body_shape_forming: 'სხეულის ძირითადი ფორმა ყალიბდება.',
  limb_structures_forming: 'კიდურების ადრეული სტრუქტურები ყალიბდება.',
  facial_features_forming: 'სახის სტრუქტურები ყალიბდება.',
  fingers_forming: 'თითები ყალიბდება.',
  major_organs_forming: 'ძირითადი ორგანოები ყალიბდება.',
  fetal_period_begins: 'ემბრიონული პერიოდიდან ნაყოფის პერიოდზე გადასვლა იწყება.',
  organs_in_place: 'ძირითადი ორგანოები უკვე განლაგებულია და შემდგომ იზრდება.',
  ossification_beginning: 'ძვლების გამაგრება იწყება.',
  skin_thin: 'კანი ჯერ თხელია.',
  movement_developing: 'მოძრაობა ვითარდება. ეს არ ნიშნავს, რომ მოძრაობა აუცილებლად იგრძნობა.',
  ears_in_position: 'ყურები უფრო დამახასიათებელ ადგილასაა.',
  lung_airways_branching: 'ფილტვების სასუნთქი გზები იტოტება.',
  vernix_forming: 'კანის დამცავი შრე (ვერნიქსი) ყალიბდება.',
  hearing_structures_present: 'სმენის სტრუქტურები ყალიბდება. ეს არ ნიშნავს, რომ ნაყოფი აუცილებლად გისმენს.',
  hair_appearing: 'თმა იწყებს გამოჩენას.',
  skin_less_transparent: 'კანი ნაკლებად გამჭვირვალე ხდება.',
  lungs_continuing: 'ფილტვები აგრძელებს განვითარებას.',
  eyes_can_open: 'ქუთუთოები შეიძლება გაიხსნას.',
  fat_accumulating: 'ცხიმოვანი შრე გროვდება.',
  bones_hardening: 'ძვლები მაგრდება.',
  lungs_maturing: 'ფილტვები აგრძელებს მომწიფებას.',
  term_window: 'სრული ვადის ფანჯარა იწყება. განვითარება ინდივიდუალურია.',
});

export const PREGNANCY_COMPARISON_EN = Object.freeze({
  poppy_seed: 'poppy seed',
  sesame: 'sesame seed',
  blueberry: 'blueberry',
  raspberry: 'raspberry',
  strawberry: 'strawberry',
  lime: 'lime',
  lemon: 'lemon',
  kiwi: 'kiwi',
  avocado: 'avocado',
  pear: 'pear',
  mango: 'mango',
  banana: 'banana',
  eggplant: 'eggplant',
  coconut: 'coconut',
  pineapple: 'pineapple',
  watermelon: 'watermelon',
});

export const PREGNANCY_COMPARISON_LINE_EN = Object.freeze({
  poppy_seed: 'About the size of a poppy seed',
  sesame: 'About the size of a sesame seed',
  blueberry: 'About the size of a blueberry',
  raspberry: 'About the size of a raspberry',
  strawberry: 'About the size of a strawberry',
  lime: 'About the size of a lime',
  lemon: 'About the size of a lemon',
  kiwi: 'About the size of a kiwi',
  avocado: 'About the size of an avocado',
  pear: 'About the size of a pear',
  mango: 'About the size of a mango',
  banana: 'About the size of a banana',
  eggplant: 'About the size of an eggplant',
  coconut: 'About the size of a coconut',
  pineapple: 'About the size of a pineapple',
  watermelon: 'About the size of a watermelon',
});

export const PREGNANCY_FACT_EN = Object.freeze({
  informational_dating:
    'Pregnancy weeks are counted from a reference date. This is not ultrasound dating.',
  microscopic_scale: 'At this stage development is microscopic, and size comparisons are not reliable yet.',
  neural_fold_forming: 'The neural tube is forming.',
  heart_tube_forming: 'The heart tube is forming.',
  limb_buds_appearing: 'Limb buds are appearing.',
  body_shape_forming: 'The basic body shape is forming.',
  limb_structures_forming: 'Early limb structures are forming.',
  facial_features_forming: 'Facial structures are forming.',
  fingers_forming: 'Fingers are forming.',
  major_organs_forming: 'The major organs are forming.',
  fetal_period_begins: 'The shift from the embryonic period to the fetal period is beginning.',
  organs_in_place: 'The major organs are in place and keep growing.',
  ossification_beginning: 'Bones are starting to harden.',
  skin_thin: 'The skin is still thin.',
  movement_developing: 'Movement is developing. This does not mean you will necessarily feel it.',
  ears_in_position: 'The ears are moving closer to their usual position.',
  lung_airways_branching: 'The airways in the lungs are branching.',
  vernix_forming: 'A protective skin coating (vernix) is forming.',
  hearing_structures_present: 'Hearing structures are forming. This does not mean the baby can necessarily hear you.',
  hair_appearing: 'Hair is starting to appear.',
  skin_less_transparent: 'The skin is becoming less transparent.',
  lungs_continuing: 'The lungs keep developing.',
  eyes_can_open: 'The eyelids may open.',
  fat_accumulating: 'A layer of fat is building up.',
  bones_hardening: 'Bones are hardening.',
  lungs_maturing: 'The lungs keep maturing.',
  term_window: 'The full-term window begins. Development is individual.',
});

export function pregnancyComparisonName(key) {
  return (isEn() ? PREGNANCY_COMPARISON_EN : PREGNANCY_COMPARISON_KA)[key] || null;
}

export function pregnancyComparisonLine(key) {
  return (isEn() ? PREGNANCY_COMPARISON_LINE_EN : PREGNANCY_COMPARISON_LINE_KA)[key] || null;
}

export function pregnancyFactText(key) {
  return (isEn() ? PREGNANCY_FACT_EN : PREGNANCY_FACT_KA)[key] || null;
}
