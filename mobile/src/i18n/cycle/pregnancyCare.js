/**
 * Georgian (and English) copy for Phase 32 prenatal care planner.
 * Keys stay language-neutral in the catalog. Product UI is Georgian-first.
 * Informational wording only — no “required test” / treatment orders.
 */

import { appLang } from '../locale.js';

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

export const PREGNANCY_CARE_COPY_EN = Object.freeze({
  title: 'Pregnancy care plan',
  cta: 'See your care plan',
  nextLabel: 'Relevant now',
  windowLabel: (from, to) => `Weeks ${from}–${to}`,
  weekRange: (from, to) => `Often discussed around weeks ${from}–${to}`,
  commonlyDiscussed: 'Often discussed around this time',
  clinicianMayDiffer: 'Your doctor’s plan may differ.',
  disclaimer:
    'This plan is for information and does not replace the schedule your pregnancy care team recommends.',
  regionalNote: 'What’s offered and when can vary by country and clinic.',
  outsideWindow: 'Your planned date is outside this information window.',
  windowPassed: 'This time window has passed',
  windowPassedHint: 'Your doctor’s plan may differ.',
  reviewRequired:
    'Your reference date needs review — your personal window and “next step” aren’t shown. Below is a general information list.',
  noActiveEpisode: 'There’s no active pregnancy episode — no personal plan is created.',
  sectionNow: 'Now',
  sectionUpcoming: 'Coming up',
  sectionMyPlan: 'My plan',
  sectionPassed: 'Window passed',
  sectionDismissed: 'Hidden from my plan',
  sectionCompleted: 'Done',
  statusPlanned: 'Planned',
  statusCompleted: 'Done',
  statusDismissed: 'Hidden',
  statusNotApplicable: 'Doesn’t apply to me',
  statusInWindow: 'In this period',
  statusUpcoming: 'Coming up',
  markPlanned: 'Plan',
  markCompleted: 'Mark as done',
  markDismiss: 'Hide from my plan',
  markNotApplicable: 'Doesn’t apply to me',
  restore: 'Return to plan',
  plannedDate: 'Planned date',
  plannedTime: 'Planned time',
  plannedTimeAdd: 'Add time',
  plannedTimeChange: 'Change time',
  plannedTimeClear: 'Remove time',
  plannedTimeHint: 'Optional. If you don’t set a time, the plan keeps just the date.',
  plannedTimeNeedDate: 'Set a planned date first, then a time.',
  plannedPlace: 'Visit location',
  plannedPlaceHint: 'Optional. You enter the location — not a verified clinic.',
  plannedPlacePlaceholder: 'e.g. CHC MontLégia — Radiologie',
  plannedPlaceClear: 'Remove location',
  plannedPlaceNeedDate: 'Set a planned date first, then a location.',
  plannedPlaceTooLong: 'The location is too long.',
  completedDate: 'Date done',
  note: 'Private note',
  noteHint: 'Only for you. Never shared with a partner, Medi or the doctor summary.',
  noteTooLong: 'The note is too long.',
  dateHint: 'e.g. 2026-09-11',
  save: 'Save',
  sources: 'Sources',
  sourcesReviewed: (date) => `Reviewed ${date}`,
  whyHeading: 'Why it may be discussed',
  timingHeading: 'Typical timing',
  userStateHeading: 'My status',
  onlineRequired: 'Saving the plan needs an internet connection. The catalog is available offline.',
  saveFailed: 'Couldn’t save. Check your internet connection and try again.',
  openSource: 'Open',
  categoryAppointment: 'Visit',
  categoryUltrasound: 'Ultrasound',
  categoryLab: 'Lab test',
  categoryScreening: 'Screening',
  categoryVaccination: 'Vaccination discussion',
  categoryEducation: 'Education',
  categoryBirthPlanning: 'Birth planning',
  honesty: 'This is an information plan — not a medical order and not a diagnosis.',
  completedMeansUser: 'Done means you marked it — not a test result.',
  remindMe: 'Remind me',
  reminder: 'Reminder',
  reminderOff: 'Off',
  reminderOn: 'On',
  reminderNeedDate: 'Set your planned date first.',
  reminderNeedSave: 'Save the planned date first, then turn on the reminder.',
  reminderSameDay: 'On the day',
  reminderOneDay: '1 day before the planned date',
  reminderThreeDays: '3 days before the planned date',
  reminderPast: 'No reminder is sent for a past date.',
  reminderDeviceOff:
    'Notifications are off on this device. Your plan is saved, but no notification will be sent.',
  reminderPrefOnDeviceOff: 'The reminder is on in your plan, but notifications are off on this device.',
  reminderHint: 'A reminder for care you planned — not a medical deadline.',
  reminderTiming: 'Reminder time',
  reminderByDate: 'By date',
  reminderByTime: 'At planned time',
  reminderExactHint: 'The reminder uses the date and time you set.',
  reminderAtTime: 'At the planned time',
  reminder30Min: '30 minutes before',
  reminder1Hour: '1 hour before',
  reminder2Hours: '2 hours before',
  reminderPreview: (clock) => `Reminder: ${clock}`,
  reminderPastFire: 'The chosen reminder time has already passed.',
  reminderExactInvalidated: 'The planned time was removed, so the timed reminder was turned off.',
  reminderNonexistentTime: 'The chosen local time doesn’t exist on this day.',
  calendarTitle: 'Calendar',
  calendarHint: 'Add to your calendar — not a medical deadline and not a reminder.',
  calendarAdd: 'Add to calendar',
  calendarOpen: 'Open in calendar',
  calendarUpdate: 'Update',
  calendarRemove: 'Remove from calendar',
  calendarAdded: 'Added to calendar',
  calendarUpdated: 'Calendar updated',
  calendarRemoved: 'Removed from calendar',
  calendarMissing: 'No longer in your calendar',
  calendarDateDiffers: 'The date saved in your calendar differs from the current planned date.',
  calendarTimeDiffers: 'The time in your calendar differs from the current planned time.',
  calendarAddAllDay: 'Add to calendar, all day',
  calendarAddTimed: 'Add to calendar, at planned time',
  calendarPermission: 'Calendar access is needed to add the entry you chose.',
  calendarPermissionDenied: 'Calendar access wasn’t granted. The entry wasn’t added.',
  calendarRevoked: 'Calendar access is no longer available. Medicard can’t change this entry.',
  calendarFailed: 'Couldn’t add to your calendar.',
  calendarGenericTitle: 'Generic title',
  calendarDetailedTitle: 'Detailed title',
  calendarTitleHint:
    'By default the title is “Medicard — planned visit”. A detailed title is used only if you choose it.',
  calendarUpdateHint:
    'Updating changes the entry Medicard added. If you edited it in your calendar, this will overwrite it.',
  calendarPast: 'No new export is created for a past date.',
  calendarPastTime: 'No new export is created for a time that has already passed today.',
  calendarNeedDate: 'Set your planned date first.',
  care_first_booking_title: 'First pregnancy care visit',
  care_first_booking_desc:
    'The first meeting with your pregnancy care team often happens in the first trimester. It usually covers your history, tests and next steps.',
  care_first_booking_why:
    'The WHO 2016 model names a first contact before 12 weeks; NHS and ACOG also discuss an earlier first visit. This is a window for an initial assessment — not confirmation that any specific test is required.',
  care_first_trimester_labs_title: 'First trimester blood tests',
  care_first_trimester_labs_desc:
    'At the first visit, blood group, Rh status, and screening for anemia and infections are often discussed. Protocols vary by clinic.',
  care_first_trimester_labs_why:
    'NHS and NICE describe first-visit blood tests as part of routine antenatal care. This plan does not confirm any result.',
  care_dating_ultrasound_title: 'Dating ultrasound',
  care_dating_ultrasound_desc:
    'In many systems the first ultrasound is offered at about 11–14 weeks to refine the pregnancy calendar. WHO notes one ultrasound before 24 weeks.',
  care_dating_ultrasound_why:
    'The NICE/NHS dating scan window is usually at the end of the first trimester; the WHO recommendation is broader (before 24 weeks). Marking it done does not mean a diagnosis.',
  care_aneuploidy_title: 'Discussing aneuploidy screening',
  care_aneuploidy_desc:
    'Combined screening or NIPT may be offered. This is screening — not a diagnostic test and not a mandatory exam.',
  care_aneuploidy_why:
    'ACOG and NHS describe prenatal genetic screening that may be offered. Availability and timing vary by system.',
  care_aneuploidy_disclaimer: 'NIPT and other screening may be offered — they are not mandatory tests.',
  care_anatomy_ultrasound_title: 'Anatomy ultrasound',
  care_anatomy_ultrasound_desc:
    'Often offered at about 18–22 weeks to review the baby’s anatomy. Marking it done doesn’t mean every change was found or that the result is “normal”.',
  care_anatomy_ultrasound_why:
    'The NHS 20-week (usually 18–21) anomaly scan and the ACOG anatomy scan (~18–22) name this period. The plan only stores that you marked it done.',
  care_gdm_title: 'Gestational diabetes screening window',
  care_gdm_desc:
    'Glucose screening is often discussed at 24–28 weeks. Timing and protocols vary. The plan does not confirm a result or give treatment advice.',
  care_gdm_why:
    'ACOG often names a 24–28 week window; NHS/NICE consider the test when the chance is higher. This is a screening discussion — not a diagnosis.',
  care_gdm_disclaimer: 'Screening timing and protocols may vary. Results and treatment stay with your doctor.',
  care_rh_title: 'Discussing blood group and Rh status',
  care_rh_title_short: 'Blood group / Rh',
  care_rh_desc:
    'Blood group and Rh status are often reviewed during pregnancy. Preventive medication is only your doctor’s decision — this plan doesn’t prescribe it.',
  care_rh_why:
    'NHS antenatal care also describes reviewing blood group and Rh around 28 weeks. Anti-D or any other medication is not part of this plan.',
  care_rh_disclaimer: 'This plan does not prescribe anti-D or any other medication.',
  care_vaccination_title: 'Vaccination discussion',
  care_vaccination_desc:
    'Vaccination is often discussed during pregnancy. This plan does not prescribe a specific vaccine or set the timing for you.',
  care_vaccination_why:
    'NHS names pregnancy vaccinations (for example seasonal flu and whooping cough) as topics to discuss. Regional schedules vary — this is only a discussion.',
  care_vaccination_disclaimer: 'This is a discussion — not a vaccine prescription.',
  care_third_trimester_title: 'Third trimester follow-up visits',
  care_third_trimester_desc:
    'Routine contacts often continue in late pregnancy. How often you have visits is individual — there is no single universal schedule.',
  care_third_trimester_why:
    'The WHO 2016 model also names later contacts; ACOG 2025 stresses an individual frequency. That’s why this is a window — not “every 2 weeks”.',
  care_gbs_title: 'Group B strep (GBS) screening',
  care_gbs_desc:
    'Some systems offer GBS screening in late pregnancy. The NHS doesn’t do it routinely. It depends on where you are.',
  care_gbs_why:
    'ACOG describes GBS screening in late pregnancy; the NHS states plainly that routine testing isn’t done. That’s why this item depends on your region.',
  care_gbs_disclaimer: 'GBS screening is not routine in every country.',
  care_birth_planning_title: 'Birth planning',
  care_birth_planning_desc:
    'In the third trimester, where you’ll give birth and your birth plan are often discussed. This is an organizational step — not a medical order.',
  care_birth_planning_why:
    'NHS antenatal care includes discussing where you’ll give birth and your birth plan in late pregnancy.',
  care_postpartum_title: 'Getting ready for after birth and newborn care',
  care_postpartum_desc:
    'In late pregnancy, newborn care and preparing for the first weeks are often discussed. This is not a hospital bag list.',
  care_postpartum_why:
    'WHO and NHS also cover education and postpartum preparation in antenatal contacts. This is only a discussion.',
});

/** Copy for the active app language. */
export function pregnancyCareCopyTable() {
  return appLang() === 'en' ? PREGNANCY_CARE_COPY_EN : PREGNANCY_CARE_COPY_KA;
}

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
  const value = pregnancyCareCopyTable()[key];
  return typeof value === 'string' ? value : '';
}

export function pregnancyCareCategoryLabel(category) {
  return pregnancyCareCopy(CATEGORY_LABEL[category]) || '';
}
