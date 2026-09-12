/**
 * Georgian copy for Phase 21 pregnancy timeline.
 * Keys stay language-neutral in the dataset. Product UI is Georgian-first.
 * Do not put localized prose in the server domain model.
 */

export const PREGNANCY_TIMELINE_COPY_KA = Object.freeze({
  journey: 'ორსულობის გზა',
  cta: 'ნახე ორსულობის გზა',
  trimester1: 'პირველი ტრიმესტრი',
  trimester2: 'მეორე ტრიმესტრი',
  trimester3: 'მესამე ტრიმესტრი',
  trimesterWeeks: (from, to) => `${from}–${to} კვირა`,
  weekOf40: (n) => `კვირა ${n} / 40`,
  progressHint: 'კალენდარული მდებარეობა 40-კვირიან ხაზზე — არა განვითარების შეფასება.',
  past: 'ადრე',
  current: 'ახლა',
  upcoming: 'შემდეგ',
  typicallyAround: (n) => `ჩვეულებრივ ${n} კვირის გარშემო`,
  next: 'შემდეგი ეტაპი',
  beyondTerm: 'სტანდარტული 40-კვირიანი ხაზის მიღმა',
  beyondHint: 'სავარაუდო თარიღი რჩება შეფასებად.',
  review: 'საცნობი თარიღი გადასახედია — გზის პოზიცია არ გამოჩნდება.',
  sources: 'წყაროები',
  sourcesBody:
    'ეტაპები დაფუძნებულია NHS, ACOG, WHO და Williams Obstetrics მასალებზე. ეს ზოგადი სასწავლო გზაა — არა პირადი სამედიცინო გეგმა.',
  estimatedDueEnd: 'სავარაუდო მშობიარობის თარიღი',
  honesty: 'ეს არის ზოგადი სასწავლო გზა — არა პირადი სამედიცინო გეგმა და არა დიაგნოზი.',
  hiddenEnded: 'აქტიური ორსულობის გზა ამ ეპიზოდზე არ ჩანს.',
  hiddenMode: 'ორსულობის გზა მხოლოდ ორსულობის რეჟიმში ჩანს.',
  weekOpen: 'ნახე ამ კვირის განვითარება',
  nowMarker: (week, day) => `ახლა · ${week} კვირა + ${day} დღე`,
  categoryStage: 'ეტაპი',
  categoryDevelopment: 'განვითარება',
  categoryMaternal: 'ცვლილება',
  categoryClinical: 'საინფორმაციო ფანჯარა',
  ms_early_title: 'ადრეული ორსულობის კალენდარი',
  ms_early_body: 'ამ კვირებში ორსულობის კალენდარი უკვე ითვლება საცნობი თარიღიდან. ეს არ ადასტურებს ორსულობას.',
  ms_heart_title: 'გულის მილის რიტმი',
  ms_heart_body: 'ამ პერიოდში გულის მილი ჩვეულებრივ იწყებს რიტმულ შეკუმშვას. დრო განსხვავდება.',
  ms_embryo_title: 'ემბრიონული პერიოდი',
  ms_embryo_body: 'ემბრიონული პერიოდი ჩვეულებრივ ამ კვირების გარშემო სრულდება. ეს კალენდარული აღწერაა და არ ადასტურებს განვითარებას.',
  ms_t1_end_title: 'პირველი ტრიმესტრი ჩვეულებრივ სრულდება',
  ms_t1_end_body: 'ამ კონვენციით პირველი ტრიმესტრი 12 კვირის ბოლოს სრულდება. კლინიკური საზღვრები შეიძლება განსხვავდებოდეს.',
  ms_t2_start_title: 'მეორე ტრიმესტრი ჩვეულებრივ იწყება',
  ms_t2_start_body: 'ამ კონვენციით მე-13 კვირიდან მეორე ტრიმესტრი იწყება. ყველა კლინიკა ერთსა და იმავე საზღვარს არ იყენებს.',
  ms_move_title: 'მოძრაობის შეგრძნება',
  ms_move_body: 'მოძრაობა ზოგჯერ ამ კვირების გარშემო იგრძნობა. პირველი შეგრძნების დრო განსხვავდება.',
  ms_anatomy_title: 'ანატომიური ულტრაბგერა',
  ms_anatomy_body: 'ანატომიური ულტრაბგერა ხშირად 18–21 კვირაზე ინიშნება. ეს არ არის პირადი დანიშვნა.',
  ms_mid_title: 'კალენდარული შუაწერტილი',
  ms_mid_body: '40-კვირიან კალენდარზე ეს დაახლოებით შუაა. ეს არ ნიშნავს, რომ განვითარება ნახევარზეა.',
  ms_glucose_title: 'გლუკოზის სკრინინგი',
  ms_glucose_body: 'გლუკოზის სკრინინგი ხშირად 24–28 კვირაზე განიხილება. ეს არ არის პირადი მითითება.',
  ms_t3_start_title: 'მესამე ტრიმესტრი ჩვეულებრივ იწყება',
  ms_t3_start_body: 'ამ კონვენციით მე-27 კვირიდან მესამე ტრიმესტრი იწყება. კლინიკური საზღვრები შეიძლება განსხვავდებოდეს.',
  ms_later_title: 'გვიანი ორსულობა',
  ms_later_body: 'ორსულობის გვიანი პერიოდი ამ კვირებიდან იწყება კალენდარზე. ეს არ არის შედეგის პროგნოზი.',
  ms_gbs_title: 'B ჯგუფის სტრეპტოკოკის შემოწმება',
  ms_gbs_body: 'ეს შემოწმება ხშირად 36–37 კვირაზე ინიშნება. ეს არ არის პირადი დანიშვნა.',
  ms_term_title: 'სავარაუდო ვადა',
  ms_term_body: '40-კვირიანი კალენდარი აქ სრულდება. სავარაუდო თარიღი შეფასებაა და არ არის გარანტია.',
  src_nhs_weeks: 'NHS, ორსულობა კვირების მიხედვით',
  src_nhs_trimesters: 'NHS, ტრიმესტრების კვირები',
  src_acog_fetus: 'ACOG, ნაყოფის განვითარება',
  src_nhs_20_scan: 'NHS, 20-კვირიანი ულტრაბგერა',
  src_acog_gdm: 'ACOG, გესტაციური დიაბეტი',
  src_acog_gbs: 'ACOG, B ჯგუფის სტრეპტოკოკი',
  src_who_anc: 'WHO, ანტენატალური ზრუნვის რეკომენდაციები',
  src_williams: 'Williams Obstetrics',
});

export function timelineCopy(key) {
  const value = PREGNANCY_TIMELINE_COPY_KA[key];
  return typeof value === 'string' ? value : '';
}

export function timelineTrimesterLabel(trimester) {
  if (trimester === 1) return PREGNANCY_TIMELINE_COPY_KA.trimester1;
  if (trimester === 2) return PREGNANCY_TIMELINE_COPY_KA.trimester2;
  if (trimester === 3) return PREGNANCY_TIMELINE_COPY_KA.trimester3;
  return '';
}

export function timelineStatusLabel(status) {
  if (status === 'PAST') return PREGNANCY_TIMELINE_COPY_KA.past;
  if (status === 'CURRENT') return PREGNANCY_TIMELINE_COPY_KA.current;
  if (status === 'UPCOMING') return PREGNANCY_TIMELINE_COPY_KA.upcoming;
  return '';
}

export function timelineCategoryLabel(category) {
  if (category === 'PREGNANCY_STAGE') return PREGNANCY_TIMELINE_COPY_KA.categoryStage;
  if (category === 'GENERAL_DEVELOPMENT') return PREGNANCY_TIMELINE_COPY_KA.categoryDevelopment;
  if (category === 'MATERNAL_CHANGE') return PREGNANCY_TIMELINE_COPY_KA.categoryMaternal;
  if (category === 'CLINICAL_WINDOW') return PREGNANCY_TIMELINE_COPY_KA.categoryClinical;
  return '';
}
