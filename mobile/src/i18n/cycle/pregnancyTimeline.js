/**
 * Georgian (and English) copy for Phase 21 pregnancy timeline.
 * Keys stay language-neutral in the dataset. Product UI is Georgian-first.
 * Do not put localized prose in the server domain model.
 */

import { appLang } from '../locale.js';

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
    'ეტაპები დაფუძნებულია NHS-ის, ACOG-ისა და WHO-ს მასალებზე. ეს ზოგადი სასწავლო გზაა — არა პირადი სამედიცინო გეგმა.',
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
});

export const PREGNANCY_TIMELINE_COPY_EN = Object.freeze({
  journey: 'Pregnancy journey',
  cta: 'See your pregnancy journey',
  trimester1: 'First trimester',
  trimester2: 'Second trimester',
  trimester3: 'Third trimester',
  trimesterWeeks: (from, to) => `Weeks ${from}–${to}`,
  weekOf40: (n) => `Week ${n} / 40`,
  progressHint: 'Your calendar position on a 40-week line — not an assessment of development.',
  past: 'Earlier',
  current: 'Now',
  upcoming: 'Later',
  typicallyAround: (n) => `Typically around week ${n}`,
  next: 'Next milestone',
  beyondTerm: 'Beyond the standard 40-week line',
  beyondHint: 'The estimated date remains an estimate.',
  review: 'Your reference date needs review — your position on the journey won’t be shown.',
  sources: 'Sources',
  sourcesBody:
    'Milestones are based on NHS, ACOG and WHO materials. This is a general learning journey — not a personal medical plan.',
  estimatedDueEnd: 'Estimated due date',
  honesty: 'This is a general learning journey — not a personal medical plan and not a diagnosis.',
  hiddenEnded: 'An active pregnancy journey isn’t shown for this episode.',
  hiddenMode: 'The pregnancy journey is only shown in pregnancy mode.',
  weekOpen: 'See this week’s development',
  nowMarker: (week, day) => `Now · ${week} ${week === 1 ? 'week' : 'weeks'} + ${day} ${day === 1 ? 'day' : 'days'}`,
  categoryStage: 'Stage',
  categoryDevelopment: 'Development',
  categoryMaternal: 'Change',
  categoryClinical: 'Information window',
  ms_early_title: 'Early pregnancy calendar',
  ms_early_body: 'In these weeks the pregnancy calendar already counts from the reference date. This does not confirm pregnancy.',
  ms_heart_title: 'Heart tube rhythm',
  ms_heart_body: 'Around this time the heart tube usually starts to contract rhythmically. Timing varies.',
  ms_embryo_title: 'Embryonic period',
  ms_embryo_body: 'The embryonic period usually ends around these weeks. This is a calendar description and does not confirm development.',
  ms_t1_end_title: 'The first trimester usually ends',
  ms_t1_end_body: 'By this convention the first trimester ends at the end of week 12. Clinical boundaries may differ.',
  ms_t2_start_title: 'The second trimester usually begins',
  ms_t2_start_body: 'By this convention the second trimester begins in week 13. Not every clinic uses the same boundary.',
  ms_move_title: 'Feeling movement',
  ms_move_body: 'Movement is sometimes felt around these weeks. When you first feel it varies.',
  ms_anatomy_title: 'Anatomy ultrasound',
  ms_anatomy_body: 'The anatomy ultrasound is often scheduled at 18–21 weeks. This is not a personal appointment.',
  ms_mid_title: 'Calendar midpoint',
  ms_mid_body: 'This is about halfway on the 40-week calendar. It doesn’t mean development is halfway.',
  ms_glucose_title: 'Glucose screening',
  ms_glucose_body: 'Glucose screening is often discussed at 24–28 weeks. This is not personal advice.',
  ms_t3_start_title: 'The third trimester usually begins',
  ms_t3_start_body: 'By this convention the third trimester begins in week 27. Clinical boundaries may differ.',
  ms_later_title: 'Later pregnancy',
  ms_later_body: 'The later part of pregnancy begins around these weeks on the calendar. This is not a prediction of the outcome.',
  ms_gbs_title: 'Group B strep check',
  ms_gbs_body: 'This check is often scheduled at 36–37 weeks. This is not a personal appointment.',
  ms_term_title: 'Estimated due date',
  ms_term_body: 'The 40-week calendar ends here. The estimated date is an estimate, not a guarantee.',
  src_nhs_weeks: 'NHS, pregnancy week by week',
  src_nhs_trimesters: 'NHS, trimester weeks',
  src_acog_fetus: 'ACOG, fetal development',
  src_nhs_20_scan: 'NHS, 20-week scan',
  src_acog_gdm: 'ACOG, gestational diabetes',
  src_acog_gbs: 'ACOG, group B strep',
  src_who_anc: 'WHO, antenatal care recommendations',
});

/** Copy for the active app language. */
export function timelineCopyTable() {
  return appLang() === 'en' ? PREGNANCY_TIMELINE_COPY_EN : PREGNANCY_TIMELINE_COPY_KA;
}

export function timelineCopy(key) {
  const value = timelineCopyTable()[key];
  return typeof value === 'string' ? value : '';
}

export function timelineTrimesterLabel(trimester) {
  if (trimester === 1) return timelineCopyTable().trimester1;
  if (trimester === 2) return timelineCopyTable().trimester2;
  if (trimester === 3) return timelineCopyTable().trimester3;
  return '';
}

export function timelineStatusLabel(status) {
  if (status === 'PAST') return timelineCopyTable().past;
  if (status === 'CURRENT') return timelineCopyTable().current;
  if (status === 'UPCOMING') return timelineCopyTable().upcoming;
  return '';
}

export function timelineCategoryLabel(category) {
  if (category === 'PREGNANCY_STAGE') return timelineCopyTable().categoryStage;
  if (category === 'GENERAL_DEVELOPMENT') return timelineCopyTable().categoryDevelopment;
  if (category === 'MATERNAL_CHANGE') return timelineCopyTable().categoryMaternal;
  if (category === 'CLINICAL_WINDOW') return timelineCopyTable().categoryClinical;
  return '';
}
