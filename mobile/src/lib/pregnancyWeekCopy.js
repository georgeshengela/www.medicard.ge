/**
 * Georgian copy for pregnancy week catalog keys.
 * Medical numbers stay in pregnancyWeekData.js. Do not put sentences in the dataset.
 */

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

export function pregnancyComparisonName(key) {
  return PREGNANCY_COMPARISON_KA[key] || null;
}

export function pregnancyComparisonLine(key) {
  return PREGNANCY_COMPARISON_LINE_KA[key] || null;
}

export function pregnancyFactText(key) {
  return PREGNANCY_FACT_KA[key] || null;
}
