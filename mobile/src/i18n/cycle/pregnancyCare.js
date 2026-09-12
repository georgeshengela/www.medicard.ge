/**
 * Georgian copy for Phase 32 prenatal care planner.
 * Keys stay language-neutral in the catalog. Product UI is Georgian-first.
 * Informational wording only — no “required test” / treatment orders.
 */

export const PREGNANCY_CARE_COPY_KA = Object.freeze({
  title: 'ორსულობის მოვლის გეგმა',
  cta: 'ნახე მოვლის გეგმა',
  nextLabel: 'ახლა აქტუალური',
  windowLabel: (from, to) => `${from}–${to} კვირა`,
  weekRange: (from, to) => `ხშირად განიხილება ${from}–${to} კვირის გარშემო`,
  commonlyDiscussed: 'ხშირად განიხილება ამ პერიოდში',
  clinicianMayDiffer: 'შენი ექიმის გეგმა შეიძლება განსხვავდებოდეს.',
  disclaimer:
    'ეს გეგმა საინფორმაციოა და არ ცვლის შენი ორსულობის გუნდის რეკომენდებულ განრიგს.',
  regionalNote: 'შეთავაზება და დრო შეიძლება განსხვავდებოდეს ქვეყნისა და კლინიკის მიხედვით.',
  outsideWindow: 'შენი დაგეგმილი თარიღი ამ საინფორმაციო ფანჯრის გარეთაა.',
  windowPassed: 'ამ დროის ფანჯარა გასულია',
  windowPassedHint: 'შენი ექიმის გეგმა შეიძლება განსხვავდებოდეს.',
  reviewRequired:
    'საცნობი თარიღი გადასახედია — პირადი ფანჯარა და „შემდეგი ნაბიჯი“ არ ჩანს. ქვემოთ ზოგადი საინფორმაციო სიაა.',
  noActiveEpisode: 'აქტიური ორსულობის ეპიზოდი არ არის — პირადი გეგმა არ იქმნება.',
  sectionNow: 'ახლა',
  sectionUpcoming: 'შემდეგ',
  sectionMyPlan: 'ჩემი გეგმა',
  sectionPassed: 'ფანჯარა გასულია',
  sectionDismissed: 'დამალული ჩემი გეგმიდან',
  sectionCompleted: 'დასრულებული',
  statusPlanned: 'დაგეგმილი',
  statusCompleted: 'დასრულებული',
  statusDismissed: 'დამალული',
  statusNotApplicable: 'ჩემთვის არ ეხება',
  statusInWindow: 'ამ პერიოდში',
  statusUpcoming: 'წინ არის',
  markPlanned: 'დაგეგმვა',
  markCompleted: 'დასრულებულად მონიშვნა',
  markDismiss: 'დამალვა ჩემი გეგმიდან',
  markNotApplicable: 'ჩემთვის არ ეხება',
  restore: 'დაბრუნება გეგმაში',
  plannedDate: 'დაგეგმილი თარიღი',
  plannedTime: 'დაგეგმილი დრო',
  plannedTimeAdd: 'დროის დამატება',
  plannedTimeChange: 'დროის შეცვლა',
  plannedTimeClear: 'დროის წაშლა',
  plannedTimeHint: 'არასავალდებულო. თუ დროს არ მიუთითებ, გეგმა მხოლოდ თარიღით რჩება.',
  plannedTimeNeedDate: 'ჯერ მიუთითე დაგეგმილი თარიღი, შემდეგ დრო.',
  plannedPlace: 'ვიზიტის ადგილი',
  plannedPlaceHint: 'არასავალდებულო. შენ მიუთითე ადგილი — არა დადასტურებული კლინიკა.',
  plannedPlacePlaceholder: 'მაგ. CHC MontLégia — Radiologie',
  plannedPlaceClear: 'ადგილის წაშლა',
  plannedPlaceNeedDate: 'ჯერ მიუთითე დაგეგმილი თარიღი, შემდეგ ადგილი.',
  plannedPlaceTooLong: 'ადგილი ძალიან გრძელია.',
  completedDate: 'დასრულების თარიღი',
  note: 'პირადი შენიშვნა',
  noteHint: 'მხოლოდ შენთვის. არ გადაეცემა პარტნიორს, Medi-ს ან ექიმის რეზიუმეს.',
  noteTooLong: 'შენიშვნა ძალიან გრძელია.',
  dateHint: 'მაგ. 2026-09-11',
  save: 'შენახვა',
  sources: 'წყაროები',
  sourcesReviewed: (date) => `გადახედილია ${date}`,
  whyHeading: 'რატომ შეიძლება განიხილებოდეს',
  timingHeading: 'საერთო დრო',
  userStateHeading: 'ჩემი მდგომარეობა',
  onlineRequired: 'გეგმის შენახვა ონლაინ კავშირს საჭიროებს. კატალოგი ოფლაინაც იხილება.',
  saveFailed: 'შენახვა ვერ მოხერხდა. შეამოწმე ინტერნეტთან კავშირი და ხელახლა სცადე.',
  openSource: 'გახსნა',
  categoryAppointment: 'ვიზიტი',
  categoryUltrasound: 'ულტრაბგერა',
  categoryLab: 'ანალიზი',
  categoryScreening: 'სკრინინგი',
  categoryVaccination: 'ვაქცინაციის განხილვა',
  categoryEducation: 'განათლება',
  categoryBirthPlanning: 'მშობიარობის დაგეგმვა',
  honesty: 'ეს არის საინფორმაციო გეგმა — არა სამედიცინო დანიშნულება და არა დიაგნოზი.',
  completedMeansUser: 'დასრულებული ნიშნავს, რომ შენ მონიშნე — არა ტესტის შედეგი.',
  remindMe: 'შემახსენე',
  reminder: 'შეხსენება',
  reminderOff: 'გამორთული',
  reminderOn: 'ჩართული',
  reminderNeedDate: 'ჯერ მიუთითე შენი დაგეგმილი თარიღი.',
  reminderNeedSave: 'ჯერ შეინახე დაგეგმილი თარიღი, შემდეგ ჩართე შეხსენება.',
  reminderSameDay: 'იმავე დღეს',
  reminderOneDay: 'დაგეგმილ თარიღამდე 1 დღით ადრე',
  reminderThreeDays: 'დაგეგმილ თარიღამდე 3 დღით ადრე',
  reminderPast: 'წარსულ თარიღზე შეხსენება არ გაიგზავნება.',
  reminderDeviceOff:
    'მოწყობილობის შეტყობინებები გამორთულია. გეგმა შენახულია, მაგრამ შეტყობინება არ გაიგზავნება.',
  reminderPrefOnDeviceOff: 'შეხსენება ჩართულია შენს გეგმაში, მაგრამ მოწყობილობის შეტყობინებები გამორთულია.',
  reminderHint: 'შენ მიერ დაგეგმილი მოვლის შეხსენება — არა სამედიცინო ვადა.',
  reminderTiming: 'შეხსენების დრო',
  reminderByDate: 'თარიღით',
  reminderByTime: 'დაგეგმილი დროით',
  reminderExactHint: 'შეხსენება გამოიყენებს შენ მიერ მითითებულ თარიღსა და დროს.',
  reminderAtTime: 'დაგეგმილ დროს',
  reminder30Min: '30 წუთით ადრე',
  reminder1Hour: '1 საათით ადრე',
  reminder2Hours: '2 საათით ადრე',
  reminderPreview: (clock) => `შეხსენება: ${clock}`,
  reminderPastFire: 'არჩეული შეხსენების დრო უკვე გასულია.',
  reminderExactInvalidated: 'დაგეგმილი დრო წაიშალა, ამიტომ დროითი შეხსენება გამოირთო.',
  reminderNonexistentTime: 'არჩეული ადგილობრივი დრო ამ დღეს არ არსებობს.',
  calendarTitle: 'კალენდარი',
  calendarHint: 'დამატება შენს კალენდარში — არა სამედიცინო ვადა და არა შეხსენება.',
  calendarAdd: 'კალენდარში დამატება',
  calendarOpen: 'კალენდარში გახსნა',
  calendarUpdate: 'განახლება',
  calendarRemove: 'კალენდარიდან წაშლა',
  calendarAdded: 'დაემატა კალენდარში',
  calendarUpdated: 'კალენდარი განახლდა',
  calendarRemoved: 'კალენდარიდან წაიშალა',
  calendarMissing: 'კალენდარში აღარ არის',
  calendarDateDiffers: 'კალენდარში შენახული თარიღი განსხვავდება მიმდინარე დაგეგმილი თარიღისგან.',
  calendarTimeDiffers: 'კალენდარში დაგეგმილი დრო განსხვავდება მიმდინარე დროისგან.',
  calendarAddAllDay: 'კალენდარში დამატება, მთელი დღე',
  calendarAddTimed: 'კალენდარში დამატება, დაგეგმილი დროით',
  calendarPermission: 'კალენდარში შენ მიერ არჩეული ჩანაწერის დასამატებლად საჭიროა კალენდარზე წვდომა.',
  calendarPermissionDenied: 'კალენდარზე წვდომა არ არის მიცემული. ჩანაწერი არ დაემატა.',
  calendarRevoked: 'კალენდარზე წვდომა აღარ არის. Medicard ამ ჩანაწერს ვერ შეცვლის.',
  calendarFailed: 'კალენდარში დამატება ვერ მოხერხდა.',
  calendarGenericTitle: 'ზოგადი სახელი',
  calendarDetailedTitle: 'დეტალური სახელი',
  calendarTitleHint: 'ნაგულისხმევად იწერება „Medicard — დაგეგმილი ვიზიტი“. დეტალური სახელი მხოლოდ თუ შენ აირჩევ.',
  calendarUpdateHint: 'განახლება შეცვლის Medicard-ის მიერ დამატებულ ჩანაწერს. თუ კალენდარში ხელით შეცვალე, ეს გადააწერს.',
  calendarPast: 'წარსულ თარიღზე ახალი ექსპორტი არ იქმნება.',
  calendarPastTime: 'დღევანდელ გასულ დროზე ახალი ექსპორტი არ იქმნება.',
  calendarNeedDate: 'ჯერ მიუთითე შენი დაგეგმილი თარიღი.',
  care_first_booking_title: 'ორსულობის პირველი სამედიცინო ვიზიტი',
  care_first_booking_desc:
    'პირველი შეხვედრა ორსულობის მოვლის გუნდთან ხშირად ხდება პირველ ტრიმესტრში. აქ ჩვეულებრივ განიხილება ისტორია, გამოკვლევები და შემდგომი ნაბიჯები.',
  care_first_booking_why:
    'WHO 2016 მოდელი პირველ კონტაქტს 12 კვირამდე ასახელებს; NHS და ACOG უფრო ადრე პირველ ვიზიტსაც განიხილავენ. ეს საწყისი შეფასების ფანჯარაა — არა დადასტურება, რომ კონკრეტული ტესტი აუცილებელია.',
  care_first_trimester_labs_title: 'პირველი ტრიმესტრის სისხლის ანალიზები',
  care_first_trimester_labs_desc:
    'პირველ ვიზიტზე ხშირად განიხილება სისხლის ჯგუფი, Rh სტატუსი, ანემიისა და ინფექციების სკრინინგი. პროტოკოლი კლინიკის მიხედვით იცვლება.',
  care_first_trimester_labs_why:
    'NHS და NICE პირველი ვიზიტის სისხლის ანალიზებს რუტინული ანტენატალური მოვლის ნაწილად აღწერენ. ეს გეგმა შედეგს არ ადასტურებს.',
  care_dating_ultrasound_title: 'დათარიღების ულტრაბგერა',
  care_dating_ultrasound_desc:
    'ბევრ სისტემაში პირველი ულტრაბგერა სთავაზობენ დაახლოებით 11–14 კვირაზე, ორსულობის კალენდრის დასაზუსტებლად. WHO აღნიშნავს ერთ ულტრაბგერას 24 კვირამდე.',
  care_dating_ultrasound_why:
    'NICE/NHS დათარიღების სკანის ფანჯარა ჩვეულებრივ პირველი ტრიმესტრის ბოლოსაა; WHO-ს რეკომენდაცია უფრო ფართოა (24 კვირამდე). დასრულება არ ნიშნავს დიაგნოზს.',
  care_aneuploidy_title: 'ანეუპლოიდიის სკრინინგის განხილვა',
  care_aneuploidy_desc:
    'კომბინირებული სკრინინგი ან NIPT შეიძლება შემოგთავაზონ. ეს სკრინინგია — არა დიაგნოსტიკური ტესტი და არა სავალდებულო გამოკვლევა.',
  care_aneuploidy_why:
    'ACOG და NHS აღწერენ პრენატალურ გენეტიკურ სკრინინგს, რომელიც შეიძლება შემოთავაზდეს. ხელმისაწვდომობა და დრო სისტემის მიხედვით იცვლება.',
  care_aneuploidy_disclaimer: 'NIPT და სხვა სკრინინგი შეიძლება შემოგთავაზონ — ეს არ არის სავალდებულო ტესტი.',
  care_anatomy_ultrasound_title: 'ანატომიის ულტრაბგერა',
  care_anatomy_ultrasound_desc:
    'ხშირად სთავაზობენ დაახლოებით 18–22 კვირაზე, ნაყოფის ანატომიის განხილვისთვის. დასრულება არ ნიშნავს, რომ ყველა ცვლილება გამოვლინდა ან რომ შედეგი „ნორმალურია“.',
  care_anatomy_ultrasound_why:
    'NHS 20-კვირიანი (ჩვეულებრივ 18–21) ანომალიის სკანი და ACOG ანატომიის სკანი (~18–22) ამ პერიოდს ასახელებენ. გეგმა მხოლოდ დასრულების ფაქტს ინახავს.',
  care_gdm_title: 'გესტაციური დიაბეტის სკრინინგის ფანჯარა',
  care_gdm_desc:
    '24–28 კვირაზე ხშირად განიხილება გლუკოზის სკრინინგი. დრო და პროტოკოლი განსხვავდება. გეგმა შედეგს არ ადასტურებს და მკურნალობის რჩევას არ იძლევა.',
  care_gdm_why:
    'ACOG ხშირად 24–28 კვირის ფანჯარას ასახელებს; NHS/NICE ტესტს უფრო მაღალი შანსისას განიხილავს. ეს სკრინინგის განხილვაა — არა დიაგნოზი.',
  care_gdm_disclaimer: 'სკრინინგის დრო და პროტოკოლი შეიძლება განსხვავდებოდეს. შედეგი და მკურნალობა ექიმთან რჩება.',
  care_rh_title: 'სისხლის ჯგუფისა და Rh სტატუსის განხილვა',
  care_rh_title_short: 'სისხლის ჯგუფი / Rh',
  care_rh_desc:
    'სისხლის ჯგუფი და Rh სტატუსი ხშირად გადაიხედება ორსულობის განმავლობაში. მედიკამენტური პროფილაქტიკა მხოლოდ ექიმის გადაწყვეტილებაა — ეს გეგმა მას არ ნიშნავს.',
  care_rh_why:
    'NHS ანტენატალურ მოვლაში სისხლის ჯგუფისა და Rh-ის გადახედვას ~28 კვირის გარშემოაც აღწერს. ანტი-D ან სხვა მედიკამენტი ამ გეგმაში არ შედის.',
  care_rh_disclaimer: 'ეს გეგმა არ ნიშნავს ანტი-D-ს ან სხვა მედიკამენტს.',
  care_vaccination_title: 'ვაქცინაციის განხილვა',
  care_vaccination_desc:
    'ორსულობის დროს ხშირად განიხილება ვაქცინაცია. ეს გეგმა არ ნიშნავს კონკრეტულ ვაქცინას და არ განსაზღვრავს დროს შენთვის.',
  care_vaccination_why:
    'NHS ორსულობის ვაქცინაციებს (მაგალითად სეზონური გრიპი, ყივანახველა) განხილვის საგნად ასახელებს. რეგიონული კალენდარი განსხვავდება — აქ მხოლოდ განხილვაა.',
  care_vaccination_disclaimer: 'ეს არის განხილვა — არა ვაქცინის დანიშნულება.',
  care_third_trimester_title: 'მესამე ტრიმესტრის შემდგომი ვიზიტები',
  care_third_trimester_desc:
    'გვიან ორსულობაში ხშირად გრძელდება რუტინული კონტაქტები. ვიზიტების სიხშირე ინდივიდუალურია და არ არის ერთი უნივერსალური განრიგი.',
  care_third_trimester_why:
    'WHO 2016 მოდელი გვიან კონტაქტებსაც ასახელებს; ACOG 2025 ხაზს უსვამს ინდივიდუალურ სიხშირეს. ამიტომ აქ ფანჯარაა — არა „ყოველ 2 კვირაში“.',
  care_gbs_title: 'B ჯგუფის სტრეპტოკოკის (GBS) სკრინინგი',
  care_gbs_desc:
    'ზოგ სისტემაში გვიან ორსულობაში სთავაზობენ GBS სკრინინგს. NHS-ზე რუტინულად არ კეთდება. ეს იურისდიქციაზეა დამოკიდებული.',
  care_gbs_why:
    'ACOG GBS სკრინინგს გვიან ორსულობაში აღწერს; NHS პირდაპირ წერს, რომ რუტინული ტესტი არ ტარდება. ამიტომ პუნქტი რეგიონზეა დამოკიდებული.',
  care_gbs_disclaimer: 'GBS სკრინინგი ყველა ქვეყანაში რუტინული არ არის.',
  care_birth_planning_title: 'მშობიარობის დაგეგმვა',
  care_birth_planning_desc:
    'მესამე ტრიმესტრში ხშირად განიხილება მშობიარობის ადგილი და გეგმა. ეს ორგანიზაციული ნაბიჯია — არა სამედიცინო ბრძანება.',
  care_birth_planning_why:
    'NHS ანტენატალური მოვლა მშობიარობის ადგილისა და გეგმის განხილვას გვიან ორსულობაში მოიცავს.',
  care_postpartum_title: 'მშობიარობის შემდგომი და ახალშობილის მოვლის მომზადება',
  care_postpartum_desc:
    'გვიან ორსულობაში ხშირად განიხილება ახალშობილის მოვლა და პირველი კვირების მომზადება. ეს არ არის საავადმყოფოს ჩანთის სია.',
  care_postpartum_why:
    'WHO და NHS ანტენატალურ კონტაქტებში განათლებასა და მშობიარობის შემდგომ მომზადებასაც განიხილავენ. აქ მხოლოდ განხილვაა.',
});

const CATEGORY_LABEL = {
  APPOINTMENT: 'categoryAppointment',
  ULTRASOUND: 'categoryUltrasound',
  LAB: 'categoryLab',
  SCREENING: 'categoryScreening',
  VACCINATION_DISCUSSION: 'categoryVaccination',
  EDUCATION: 'categoryEducation',
  BIRTH_PLANNING: 'categoryBirthPlanning',
};

export function pregnancyCareCopy(key) {
  if (!key) return '';
  const value = PREGNANCY_CARE_COPY_KA[key];
  return typeof value === 'string' ? value : '';
}

export function pregnancyCareCategoryLabel(category) {
  return pregnancyCareCopy(CATEGORY_LABEL[category]) || '';
}
