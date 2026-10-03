/** Reviewed native entry points. Internal wizard/result screens are deliberately not entry points. */
export const ASSISTANT_GROUPS = Object.freeze([
  { id: 'daily', label: 'ყოველდღიური ჯანმრთელობა', icon: 'heart' },
  { id: 'treatment', label: 'წამლები და ვიზიტები', icon: 'pill' },
  { id: 'cycle', label: 'ციკლი და ორსულობა', icon: 'flower' },
  { id: 'analysis', label: 'კონსულტაცია და ანალიზი', icon: 'scan' },
  { id: 'activity', label: 'მოძრაობა და ჯილდოები', icon: 'footprints' },
  { id: 'pets', label: 'ჩემი ცხოველები', icon: 'paw' },
  { id: 'account', label: 'პროფილი და პარამეტრები', icon: 'settings' },
]);
const feature = (id, label, route, group, description, scopes = ['human']) => ({ id, label, route, group, description, scopes });
export const ASSISTANT_FEATURES = Object.freeze([
  feature('home', 'მთავარი გვერდი', '/(tabs)/home', 'daily', 'დღის მიმოხილვა და აპის ფუნქციები.'),
  feature('metrics', 'ჯანმრთელობის მაჩვენებლები', '/health-metrics', 'daily', 'ჩაწერე გაზომილი წონა, პულსი, წნევა, ძილი ან კალორიები.'),
  feature('hydration', 'ჰიდრატაცია', '/health-metrics/hydration', 'daily', 'წყლის აღრიცხვა, დღის პროგრესი და დღიური მიზანი.'),
  feature('hydration_history', 'წყლის ისტორია', '/health-metrics/hydration/history', 'daily', 'შენახული წყლის ჩანაწერების ნახვა.'),
  feature('hydration_calendar', 'წყლის კალენდარი', '/health-metrics/hydration/calendar', 'daily', 'ჰიდრატაციის მიმოხილვა დღეების მიხედვით.'),
  feature('hydration_log', 'სასმლის აღრიცხვა', '/health-metrics/hydration/log', 'daily', 'აირჩიე სასმელი, ჭურჭელი და მოცულობა.'),
  feature('weight', 'წონის კონტროლი', '/health-metrics/weight', 'daily', 'გაზომვები და წონის ცვლილება.'),
  feature('weight_history', 'წონის ისტორია', '/health-metrics/weight/history', 'daily', 'შენახული გაზომვები თარიღებით.'),
  feature('nutrition', 'კვება და მიზანი', '/nutrition', 'daily', 'დღის კალორიები, მაკრონუტრიენტები და შენახული კვების დღიური. არშეყვანილი საკვები უცნობია.'),
  feature('nutrition_diary', 'კვების ჩაწერა', '/nutrition/diary', 'daily', 'ფოტო, შტრიხკოდი, ეტიკეტი, ძებნა, შენახული საკვები ან სიტყვიერი აღწერა; პორციის გადამოწმება და შესწორება. ნათქვამი კვების ჩასაწერად nutrition_log მოქმედება.'),
  feature('nutrition_goal', 'კვების გეგმა', '/nutrition/goal', 'daily', 'წონის საერთო მიზანი, საჭირო მონაცემები, უსაფრთხოების გადამოწმება და დღის სამიზნე. კონკრეტული მიზნის გადასატანად nutrition_goal მოქმედება.'),
  feature('nutrition_plan', 'ჩემი რაციონი', '/nutrition/plan', 'daily', '7 დღის კერძები, ალტერნატივები და საყიდლების სია. მხოლოდ მივირთვი ღილაკი ან nutrition_eat წერს კვებას დღიურში.'),
  feature('nutrition_progress', 'კვების პროგრესი', '/nutrition/progress', 'daily', 'აღრიცხული კალორიებისა და წონის ცვლილება, არასრული დღეების ცალკე აღნიშვნით.'),
  feature('weight_goal', 'წონის მიზნის დამატება', '/health-metrics/weight/goal/target', 'daily', 'შენი სასურველი წონა და მიზნის ეტაპები.'),
  feature('weight_progress', 'წონის მიზნის პროგრესი', '/health-metrics/weight/goal', 'daily', 'არსებული მიზნის პროგრესი და მართვა.'),
  feature('steps', 'ნაბიჯები', '/health-metrics/steps', 'activity', 'ნაბიჯების სინქრონიზაცია ტელეფონის ნებართვით; ნაბიჯებს Medi არ იგონებს.'),
  feature('steps_history', 'ნაბიჯების ისტორია', '/health-metrics/steps/history', 'activity', 'დღეების მიხედვით შენახული აქტივობა.'),
  feature('steps_goal', 'ნაბიჯების მიზანი', '/health-metrics/steps/goal/set', 'activity', 'შენი დღიური მიზანი და ვადა.'),
  feature('steps_progress', 'ნაბიჯების მიზნის პროგრესი', '/health-metrics/steps/goal', 'activity', 'არსებული მიზნის ნახვა და მართვა.'),
  feature('week', 'კვირა მედისთან', '/week', 'daily', 'წყლის, ნაბიჯების, წონის, ძილისა და წამლის მიღების კვირის შეჯამება.'),
  feature('weather', 'ამინდი', '/weather', 'daily', 'შენახული მდებარეობის ამინდი; ახალ ადგილმდებარეობას მომხმარებელი თავად ადასტურებს.'),
  feature('medications', 'მედიკამენტები', '/medications', 'treatment', 'შეხსენებები, დოზების აღრიცხვა და არსებული წამლების მართვა.'),
  feature('medication_add', 'წამლის დეტალური დამატება', '/medications/add', 'treatment', 'არაყოველდღიური, საჭიროებისამებრ და სხვა რთული სქემები შეავსე ამ გვერდზე. დოზას მომხმარებელი უთითებს.'),
  feature('medication_reminders', 'წამლის შეხსენებები', '/medications/reminders', 'treatment', 'შეხსენებების დროები და რეჟიმები.'),
  feature('medication_calendar', 'მიღების კალენდარი', '/medications/reminders/calendar', 'treatment', 'მედიკამენტის მიღების კალენდარი.'),
  feature('medication_interactions', 'წამლების თავსებადობა', '/medications/interaction', 'treatment', 'გახსენი და ღილაკით დაიწყე არსებული წამლების AI განხილვა; ეს არ არის დანიშნულება.'),
  feature('visits', 'ექიმთან ვიზიტები', '/visits', 'treatment', 'შენი ვიზიტების პირადი კალენდარი; კლინიკაში რეალურ ჯავშანს არ აკეთებს.'),
  feature('visit_editor', 'ვიზიტის დეტალური დამატება', '/visits/editor', 'treatment', 'სპეციალისტი, ადგილი, თარიღი და შეხსენებები.'),
  feature('cycle', 'ციკლის მართვა', '/cycle', 'cycle', 'ციკლის მთავარი გვერდი და პირადი დაცვის განბლოკვა.'),
  feature('cycle_log', 'ციკლის მოკლე აღრიცხვა', '/cycle/log', 'cycle', 'დღის დაკვირვებები და სიმპტომები.'),
  feature('cycle_journal', 'ციკლის ჟურნალი', '/cycle/journal', 'cycle', 'შენახული ჩანაწერები და ისტორია.'),
  feature('cycle_trends', 'ციკლის ტენდენციები', '/cycle/trends', 'cycle', 'შენახულ დაკვირვებებზე დაფუძნებული ტენდენციები, არა დიაგნოზი.'),
  feature('cycle_summary', 'ციკლის ანგარიში', '/cycle/summary', 'cycle', 'შეჯამება, ექსპორტი და გაზიარება შენი არჩევანით.'),
  feature('cycle_settings', 'ციკლის რეჟიმები', '/cycle/settings/profile', 'cycle', 'ციკლის აღრიცხვა, დაორსულების მცდელობა, ორსულობა, პერიმენოპაუზა და მშობიარობის შემდგომი რეჟიმი.'),
  feature('pregnancy', 'ორსულობა', '/cycle/pregnancy', 'cycle', 'არსებული ორსულობის რეჟიმის მიმოხილვა; რეჟიმის ჩართვა შენს დადასტურებას მოითხოვს.'),
  feature('pregnancy_timeline', 'ორსულობის კვირები', '/cycle/pregnancy/timeline', 'cycle', 'ორსულობის ეტაპების მიმოხილვა.'),
  feature('pregnancy_care', 'ორსულობის მოვლის გეგმა', '/cycle/pregnancy/care-plan', 'cycle', 'ვიზიტების, მოვლის ეტაპებისა და შეხსენებების მართვა.'),
  feature('doctor', 'Medi ექიმი', '/chat/doctor', 'analysis', 'კონსულტაციის ჩათი. კონკრეტული ჩივილის გადაცემისთვის გამოიყენე consult.'),
  feature('consilium', 'ღრმა ანალიზი (კონსილიუმი)', '/chat/consilium', 'analysis', 'სპეციალისტების ერთობლივი AI განხილვა. ჩივილი გადაიტანე consult მოქმედებით.'),
  feature('symptoms', 'რა გაწუხებს დღეს?', '/symptoms', 'analysis', 'სიმპტომების შერჩევა, სხეულის რუკა და შეფასების ნაბიჯები.'),
  feature('symptoms_history', 'სიმპტომების ისტორია', '/symptoms/history', 'analysis', 'წინა შეფასებების ნახვა.'),
  feature('lab', 'ანალიზის სკანირება', '/lab/analyze', 'analysis', 'ატვირთე ლაბორატორიული დოკუმენტი ან გადაიღე ფოტო; ფაილს თავად ირჩევ.'),
  feature('imaging', 'სამედიცინო გამოსახულება', '/module/imaging', 'analysis', 'აირჩიე სამედიცინო გამოსახულება არსებული ანალიზის პროცესისთვის.'),
  feature('skin', 'კანის ანალიზი', '/module/skin', 'analysis', 'კანის ფოტოს დამატება და AI განხილვა.'),
  feature('skincare', 'კანის მოვლა', '/module/skincare', 'analysis', 'მოვლის არსებული პერსონალური პროცესი, ფოტოს შენი არჩევანით.'),
  feature('lab_history', 'ლაბორატორიული მაჩვენებლები', '/lab', 'analysis', 'შენახული ანალიზების მაჩვენებლები და ცვლილება.'),
  feature('records', 'ჩემი ბარათი', '/(tabs)/records', 'analysis', 'შენახული ანალიზები და კონსულტაციები; გახსენი კონკრეტული შედეგი.'),
  feature('pharmacy', 'აფთიაქი', '/pharmacy', 'treatment', 'კატალოგში ძებნა და არსებული შეთავაზებები; Medi არ ახორციელებს შეძენას.'),
  feature('run', 'MEDIRUN', '/run', 'activity', 'GPS გასეირნება, აღმოჩენები და პროგრესი. თამაში შესაძლებელია ყველგან; მისიები ჯერ თბილისზეა. დაწყება და საჩუქრის მიღება მოითხოვს რეალურ მოქმედებას.'),
  feature('quest', 'MEDIQUEST', '/medi-quest', 'activity', 'მისიები და პროგრესი. ჯილდოები ითვლება აპის წესებით, ხმოვანი მოთხოვნით არ გაიცემა.'),
  feature('quest_achievements', 'მიღწევები', '/medi-quest/achievements', 'activity', 'შენი მიღწევების კოლექცია.'),
  feature('quest_history', 'მისიების ისტორია', '/medi-quest/history', 'activity', 'შესრულებული მისიები და პროგრესი.'),
  feature('quest_wallet', 'ჯილდოების საფულე', '/medi-quest/wallet', 'activity', 'ქულებისა და მონეტების არსებული ბალანსი.'),
  feature('quest_rewards', 'ჯილდოების არჩევა', '/medi-quest/rewards', 'activity', 'ხელმისაწვდომი შეთავაზებები; გაცვლა და დადასტურება ხდება ჯილდოს გვერდზე.'),
  feature('quest_mine', 'ჩემი ჯილდოები', '/medi-quest/rewards/mine', 'activity', 'მიღებული ჯილდოები და მათი პირობები.'),
  feature('pets', 'ჩემი ცხოველები', '/pets', 'pets', 'ცხოველების პროფილები, წონა, მოვლა და MEDIVET.', ['human', 'pet']),
  feature('pet_add', 'ცხოველის დეტალური დამატება', '/pets/new', 'pets', 'ცხოველის შექმნის ეტაპები და ფოტოს არჩევა.', ['human', 'pet']),
  feature('profile', 'ჩემი პროფილი', '/(tabs)/profile', 'account', 'პირადი მონაცემები და პარამეტრები. თემის შეცვლა, გასვლა და ანგარიშის წაშლა კეთდება აქ შენივე მოქმედებით.', ['human', 'pet']),
  feature('health_profile', 'ჯანმრთელობის პროფილი', '/(tabs)/profile', 'account', 'ჯანმრთელობის მონაცემები; შევსება შესაძლებელია Medi-სთან profile_update-ით.'),
  feature('settings', 'აპის პარამეტრები', '/(tabs)/profile', 'account', 'თემა და ანგარიშის პარამეტრები. Medi არ ცვლის პაროლს და არ შლის ანგარიშს.', ['human', 'pet']),
  feature('permissions', 'ნებართვები', '/profile/permissions', 'account', 'კამერა, მდებარეობა და ჯანმრთელობის ნებართვები მხოლოდ შენი დაჭერით. მიკროფონის ნებართვა Medi-ს საუბრის ღილაკიდან მოითხოვება.', ['human', 'pet']),
  feature('notifications', 'შეტყობინებები', '/profile/notifications', 'account', 'შეტყობინებების პარამეტრები.', ['human', 'pet']),
  feature('ai_sharing', 'AI მონაცემების გაზიარება', '/(tabs)/profile', 'account', 'პროფილში აირჩიე AI მონაცემების გაზიარება თანხმობის სანახავად ან შესაცვლელად.', ['human', 'pet']),
  feature('ai_settings', 'AI და კონფიდენციალურობა', '/profile/ai-data', 'account', 'AI-სთვის მონაცემების გაზიარების თანხმობა, მიმღებები და გაუქმება.', ['human', 'pet']),
  feature('privacy', 'კონფიდენციალურობა', '/profile/privacy', 'account', 'მონაცემების გამოყენების პირობები და საკონტაქტო ინფორმაცია.', ['human', 'pet']),
  feature('terms', 'გამოყენების პირობები', '/profile/terms', 'account', 'მომსახურების პირობები.', ['human', 'pet']),
  feature('streak', 'აქტიურობის სერია', '/profile/streak', 'activity', 'შენი აქტიური დღეები და სერია.'),
]);
/** English copy for the capability directory (Georgian above stays the default and the planner's guide). */
const GROUPS_EN = Object.freeze({
  daily: 'Daily health', treatment: 'Medications and visits', cycle: 'Cycle and pregnancy', analysis: 'Consultation and analysis',
  activity: 'Movement and rewards', pets: 'My pets', account: 'Profile and settings',
});
const FEATURES_EN = Object.freeze({
  home: ['Home', 'Your day at a glance and the app’s features.'],
  metrics: ['Health metrics', 'Log a measured weight, pulse, blood pressure, sleep or calories.'],
  hydration: ['Hydration', 'Water tracking, today’s progress and your daily goal.'],
  hydration_history: ['Water history', 'See your saved water entries.'],
  hydration_calendar: ['Water calendar', 'Hydration overview by day.'],
  hydration_log: ['Log a drink', 'Choose a drink, a container and the amount.'],
  weight: ['Weight', 'Measurements and weight change.'],
  weight_history: ['Weight history', 'Saved measurements by date.'],
  nutrition: ['Nutrition and goal', 'Today’s calories, macronutrients and your saved food diary. Food you didn’t log is unknown.'],
  nutrition_diary: ['Log food', 'Photo, barcode, label, search, saved foods or a spoken description; check and correct the portion. Use the nutrition_log action to record food you describe.'],
  nutrition_goal: ['Nutrition plan', 'Your overall weight goal, the details it needs, a safety check and a daily target. Use the nutrition_goal action to carry over a specific goal.'],
  nutrition_plan: ['My meal plan', '7 days of meals, alternatives and a shopping list. Only the “I ate it” button or nutrition_eat writes a meal to the diary.'],
  nutrition_progress: ['Nutrition progress', 'Logged calories and weight change, with incomplete days marked separately.'],
  weight_goal: ['Add a weight goal', 'Your desired weight and goal milestones.'],
  weight_progress: ['Weight goal progress', 'Progress and management of your current goal.'],
  steps: ['Steps', 'Step sync with your phone’s permission; Medi never makes up steps.'],
  steps_history: ['Steps history', 'Saved activity by day.'],
  steps_goal: ['Steps goal', 'Your daily goal and deadline.'],
  steps_progress: ['Steps goal progress', 'See and manage your current goal.'],
  week: ['Your week with Medi', 'A weekly summary of water, steps, weight, sleep and medication intake.'],
  weather: ['Weather', 'Weather for your saved location; you confirm any new location yourself.'],
  medications: ['Medications', 'Reminders, dose tracking and managing your current medications.'],
  medication_add: ['Add a medication in detail', 'Fill in non-daily, as-needed and other complex schedules here. You enter the dose.'],
  medication_reminders: ['Medication reminders', 'Reminder times and modes.'],
  medication_calendar: ['Intake calendar', 'Your medication intake calendar.'],
  medication_interactions: ['Medication interactions', 'Open it and tap the button to start an AI review of your current medications; this is not a prescription.'],
  visits: ['Doctor visits', 'Your personal visit calendar; it doesn’t make a real clinic booking.'],
  visit_editor: ['Add a visit in detail', 'Specialist, place, date and reminders.'],
  cycle: ['Cycle', 'The cycle home screen and unlocking its privacy lock.'],
  cycle_log: ['Quick cycle log', 'Daily observations and symptoms.'],
  cycle_journal: ['Cycle journal', 'Saved entries and history.'],
  cycle_trends: ['Cycle trends', 'Trends based on your saved observations, not a diagnosis.'],
  cycle_summary: ['Cycle report', 'Summary, export and sharing — your choice.'],
  cycle_settings: ['Cycle modes', 'Period tracking, trying to conceive, pregnancy, perimenopause and postpartum modes.'],
  pregnancy: ['Pregnancy', 'Overview of your current pregnancy mode; turning the mode on needs your confirmation.'],
  pregnancy_timeline: ['Pregnancy weeks', 'Overview of pregnancy stages.'],
  pregnancy_care: ['Pregnancy care plan', 'Manage visits, care milestones and reminders.'],
  doctor: ['Medi doctor', 'The consultation chat. Use consult to pass on a specific complaint.'],
  consilium: ['Deep analysis (consilium)', 'A joint AI review by specialists. Pass the complaint on with the consult action.'],
  symptoms: ['What’s bothering you today?', 'Choose symptoms, use the body map and follow the assessment steps.'],
  symptoms_history: ['Symptom history', 'See earlier assessments.'],
  lab: ['Scan lab results', 'Upload a lab document or take a photo; you choose the file yourself.'],
  imaging: ['Medical imaging', 'Choose a medical image for the existing analysis flow.'],
  skin: ['Skin analysis', 'Add a skin photo for an AI review.'],
  skincare: ['Skincare', 'Your personal skincare flow, with a photo if you choose.'],
  lab_history: ['Lab values', 'Values from your saved lab tests and how they changed.'],
  records: ['My card', 'Saved tests and consultations; open a specific result.'],
  pharmacy: ['Pharmacy', 'Search the catalog and current offers; Medi doesn’t make purchases.'],
  run: ['MEDIRUN', 'GPS walks, discoveries and progress. You can play anywhere; missions are in Tbilisi for now. Starting and claiming a prize need a real action.'],
  quest: ['MEDIQUEST', 'Missions and progress. Rewards follow the app’s rules and aren’t given out on a voice request.'],
  quest_achievements: ['Achievements', 'Your achievement collection.'],
  quest_history: ['Mission history', 'Completed missions and progress.'],
  quest_wallet: ['Rewards wallet', 'Your current points and coin balance.'],
  quest_rewards: ['Choose a reward', 'Available offers; redeeming and confirming happen on the reward page.'],
  quest_mine: ['My rewards', 'Rewards you’ve received and their terms.'],
  pets: ['My pets', 'Pet profiles, weight, care and MEDIVET.'],
  pet_add: ['Add a pet in detail', 'Pet creation steps and choosing a photo.'],
  profile: ['My profile', 'Personal details and settings. Changing the theme, signing out and deleting your account are done here by you.'],
  health_profile: ['Health profile', 'Your health details; you can fill them in with Medi via profile_update.'],
  settings: ['App settings', 'Theme and account settings. Medi doesn’t change your password or delete your account.'],
  permissions: ['Permissions', 'Camera, location and health permissions — only when you tap. Microphone permission is requested from Medi’s talk button.'],
  notifications: ['Notifications', 'Notification settings.'],
  ai_sharing: ['AI data sharing', 'In your profile, choose AI data sharing to see or change your permission.'],
  ai_settings: ['AI and privacy', 'Your permission to share data with AI, the recipients and withdrawing it.'],
  privacy: ['Privacy', 'How your data is used and contact details.'],
  terms: ['Terms of use', 'Terms of service.'],
  streak: ['Activity streak', 'Your active days and streak.'],
});
function localizeFeature(f, lang) {
  if (lang !== 'en' || !FEATURES_EN[f.id]) return f;
  const [label, description] = FEATURES_EN[f.id];
  return { ...f, label, description };
}
/** Capability groups in the reading language. */
export function assistantGroups(lang = 'ka') {
  return lang === 'en' ? ASSISTANT_GROUPS.map(g => ({ ...g, label: GROUPS_EN[g.id] || g.label })) : ASSISTANT_GROUPS;
}
export const ASSISTANT_DESTINATIONS = Object.freeze(Object.fromEntries(ASSISTANT_FEATURES.map(f => [f.id, f.route])));
export function assistantFeatures(scope, lang = 'ka') {
  return ASSISTANT_FEATURES.filter(f => scope === 'auto' || f.scopes.includes(scope)).map(f => localizeFeature(f, lang));
}
export function assistantDestinationAllowed(id, scope) { return assistantFeatures(scope).some(f => f.id === id); }
export function assistantToolGroup(name) {
  if (name.startsWith('pet_')) return 'pets';
  if (/^(cycle_|period_|pregnancy_)/.test(name)) return 'cycle';
  if (/^(medication_|dose_|visit_)/.test(name)) return 'treatment';
  if (name === 'record_open' || name === 'consult') return 'analysis';
  if (name === 'steps_goal') return 'activity';
  if (name === 'profile_update' || name === 'open') return 'account';
  return 'daily';
}
export function assistantAppGuide(scope) {
  return assistantFeatures(scope).map(({ id, label, description }) => `${id}: ${label}. ${description}`).join('\n');
}
/** Exact commands only: negation, compound requests and draft corrections go to the planner. */
export function literalAssistantNavigation({ text, scope, draft }) {
  if (draft) return null;
  const value = text.trim().toLocaleLowerCase().replace(/[.!]+$/u, '').trim();
  const match = value.match(/^(?:გახსენი|მაჩვენე|გამიხსენი) (.+)$/u) || value.match(/^(.+) (?:გამიხსენი|გახსენი|მაჩვენე)$/u);
  if (match) {
    const found = assistantFeatures(scope).find(f => f.label.toLocaleLowerCase() === match[1]);
    return found ? { tool: 'open', args: { destination: found.id } } : null;
  }
  // English: "open weight", "show me my pets".
  const en = value.match(/^(?:open|show(?: me)?) (?:the )?(.+)$/);
  if (!en) return null;
  const found = assistantFeatures(scope, 'en').find(f => f.label.toLocaleLowerCase() === en[1]);
  return found ? { tool: 'open', args: { destination: found.id } } : null;
}
