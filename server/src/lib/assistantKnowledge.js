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
  feature('cycle_settings', 'ციკლის რეჟიმები', '/cycle/settings', 'cycle', 'ციკლის აღრიცხვა, დაორსულების მცდელობა, ორსულობა, პერიმენოპაუზა და მშობიარობის შემდგომი რეჟიმი.'),
  feature('pregnancy', 'ორსულობა', '/cycle/pregnancy', 'cycle', 'არსებული ორსულობის რეჟიმის მიმოხილვა; რეჟიმის ჩართვა შენს დადასტურებას მოითხოვს.'),
  feature('pregnancy_timeline', 'ორსულობის კვირები', '/cycle/pregnancy/timeline', 'cycle', 'ორსულობის ეტაპების მიმოხილვა.'),
  feature('pregnancy_care', 'ორსულობის მოვლის გეგმა', '/cycle/pregnancy/care-plan', 'cycle', 'ვიზიტების, მოვლის ეტაპებისა და შეხსენებების მართვა.'),
  feature('doctor', 'Medi ექიმი', '/chat/doctor', 'analysis', 'კონსულტაციის ჩათი. კონკრეტული ჩივილის გადაცემისთვის გამოიყენე consult.'),
  feature('consilium', 'კონსილიუმი', '/chat/consilium', 'analysis', 'სპეციალისტების ერთობლივი AI განხილვა. ჩივილი გადაიტანე consult მოქმედებით.'),
  feature('symptoms', 'რა გაწუხებს დღეს?', '/symptoms', 'analysis', 'სიმპტომების შერჩევა, სხეულის რუკა და შეფასების ნაბიჯები.'),
  feature('symptoms_history', 'სიმპტომების ისტორია', '/symptoms/history', 'analysis', 'წინა შეფასებების ნახვა.'),
  feature('lab', 'ანალიზის სკანირება', '/module/lab', 'analysis', 'ატვირთე ლაბორატორიული დოკუმენტი ან გადაიღე ფოტო; ფაილს თავად ირჩევ.'),
  feature('imaging', 'სამედიცინო გამოსახულება', '/module/imaging', 'analysis', 'აირჩიე სამედიცინო გამოსახულება არსებული ანალიზის პროცესისთვის.'),
  feature('skin', 'კანის ანალიზი', '/module/skin', 'analysis', 'კანის ფოტოს დამატება და AI განხილვა.'),
  feature('skincare', 'კანის მოვლა', '/module/skincare', 'analysis', 'მოვლის არსებული პერსონალური პროცესი, ფოტოს შენი არჩევანით.'),
  feature('lab_history', 'ლაბორატორიული მაჩვენებლები', '/lab', 'analysis', 'შენახული ანალიზების მაჩვენებლები და ცვლილება.'),
  feature('records', 'ჩემი ჩანაწერები', '/(tabs)/records', 'analysis', 'შენახული ანალიზები და კონსულტაციები; გახსენი კონკრეტული შედეგი.'),
  feature('pharmacy', 'აფთიაქი', '/pharmacy', 'treatment', 'კატალოგში ძებნა და არსებული შეთავაზებები; Medi არ ახორციელებს შეძენას.'),
  feature('run', 'MEDIRUN', '/run', 'activity', 'GPS გასეირნება, აღმოჩენები და პროგრესი. თამაში შესაძლებელია ყველგან; მისიები ჯერ თბილისზეა. დაწყება და საჩუქრის მიღება მოითხოვს რეალურ მოქმედებას.'),
  feature('quest', 'MEDI QUEST', '/medi-quest', 'activity', 'მისიები და პროგრესი. ჯილდოები ითვლება აპის წესებით, ხმოვანი მოთხოვნით არ გაიცემა.'),
  feature('quest_achievements', 'მიღწევები', '/medi-quest/achievements', 'activity', 'შენი მიღწევების კოლექცია.'),
  feature('quest_history', 'მისიების ისტორია', '/medi-quest/history', 'activity', 'შესრულებული მისიები და პროგრესი.'),
  feature('quest_wallet', 'ჯილდოების საფულე', '/medi-quest/wallet', 'activity', 'ქულებისა და მონეტების არსებული ბალანსი.'),
  feature('quest_rewards', 'ჯილდოების არჩევა', '/medi-quest/rewards', 'activity', 'ხელმისაწვდომი შეთავაზებები; გაცვლა და დადასტურება ხდება ჯილდოს გვერდზე.'),
  feature('quest_mine', 'ჩემი ჯილდოები', '/medi-quest/rewards/mine', 'activity', 'მიღებული ჯილდოები და მათი პირობები.'),
  feature('pets', 'ჩემი ცხოველები', '/pets', 'pets', 'ცხოველების პროფილები, წონა, მოვლა და Medi Vet.', ['human', 'pet']),
  feature('pet_add', 'ცხოველის დეტალური დამატება', '/pets/new', 'pets', 'ცხოველის შექმნის ეტაპები და ფოტოს არჩევა.', ['human', 'pet']),
  feature('profile', 'ჩემი პროფილი', '/(tabs)/profile', 'account', 'პირადი მონაცემები და პარამეტრები. თემის შეცვლა, გასვლა და ანგარიშის წაშლა კეთდება აქ შენივე მოქმედებით.', ['human', 'pet']),
  feature('health_profile', 'ჯანმრთელობის პროფილი', '/(tabs)/profile', 'account', 'ჯანმრთელობის მონაცემები; შევსება შესაძლებელია Medi-სთან profile_update-ით.'),
  feature('settings', 'აპის პარამეტრები', '/(tabs)/profile', 'account', 'თემა და ანგარიშის პარამეტრები. Medi არ ცვლის პაროლს და არ შლის ანგარიშს.', ['human', 'pet']),
  feature('permissions', 'ნებართვები', '/profile/permissions', 'account', 'კამერა, მდებარეობა და ჯანმრთელობის ნებართვები მხოლოდ შენი დაჭერით. მიკროფონის ნებართვა Medi-ს საუბრის ღილაკიდან მოითხოვება.', ['human', 'pet']),
  feature('notifications', 'შეტყობინებები', '/profile/notifications', 'account', 'შეტყობინებების პარამეტრები.', ['human', 'pet']),
  feature('ai_sharing', 'AI მონაცემების გაზიარება', '/(tabs)/profile', 'account', 'პროფილში აირჩიე AI მონაცემების გაზიარება თანხმობის სანახავად ან შესაცვლელად.', ['human', 'pet']),
  feature('ai_settings', 'AI პარამეტრები', '/profile/ai', 'account', 'AI სისტემის არსებული პარამეტრები.', ['human', 'pet']),
  feature('privacy', 'კონფიდენციალურობა', '/profile/privacy', 'account', 'მონაცემების გამოყენების პირობები და საკონტაქტო ინფორმაცია.', ['human', 'pet']),
  feature('terms', 'გამოყენების პირობები', '/profile/terms', 'account', 'მომსახურების პირობები.', ['human', 'pet']),
  feature('streak', 'აქტიურობის სერია', '/profile/streak', 'activity', 'შენი აქტიური დღეები და სერია.'),
]);
export const ASSISTANT_DESTINATIONS = Object.freeze(Object.fromEntries(ASSISTANT_FEATURES.map(f => [f.id, f.route])));
export function assistantFeatures(scope) { return ASSISTANT_FEATURES.filter(f => scope === 'auto' || f.scopes.includes(scope)); }
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
  if (!match) return null;
  const found = assistantFeatures(scope).find(f => f.label.toLocaleLowerCase() === match[1]);
  return found ? { tool: 'open', args: { destination: found.id } } : null;
}
