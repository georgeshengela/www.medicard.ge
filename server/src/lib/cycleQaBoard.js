import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMobileAppVersion } from './mobileAppVersion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const TEXT_EXT = new Set(['.json', '.txt', '.html', '.md', '.csv']);
const SKIP_FILES = new Set([
  'qa-run.js',
  'login-qa.js',
  'peek.js',
  'peek-all.js',
  'render-html.js',
]);
const SKIP_PREFIX = /^(_|\.)/;

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/plain; charset=utf-8',
};

const SECRET_KEY = /placeSample|plannedPlace|password|token|secret|email|phone/i;

function C(folder, family, phase, version, status, titleKa, summary, extra = {}) {
  return { folder, family, phase, version, status, titleKa, summary, ...extra };
}

/** Static operator catalog. Live PNG/artifact counts come from the qa/ scan. */
export const PHASE_CATALOG = [
  C('cycle-phase5', 'cycle', 5, '14.x', 'FROZEN', 'ციკლის საფუძველი',
    'პირველი native QA: მიმოხილვა, კალენდარი, deeplink. სერვერი ფლობს ფაზასა და დღეს — კლიენტი არ ითვლის.',
    { contract: 'docs/CYCLE_UI_CONTRACT.md', sort: 5 }),
  C('cycle-phase6', 'cycle', 6, '15.0.0', 'FINAL-FROZEN', 'ოფლაინ კეში და UI კონტრაქტი',
    'ბოლო წარმატებული CycleBundle იკეშება; მოლოდინში მყოფი ჩაწერები იშიფრება native-ზე. სამი პანელი: მიმოხილვა · კალენდარი · ჟურნალი.',
    {
      contract: 'docs/CYCLE_UI_CONTRACT.md',
      sort: 6,
      fixes: [
        { severity: 'P1', title: 'კლიენტი არ ითვლის ფაზას', detail: 'ფაქტები მხოლოდ სერვერის bundle-იდან. React არ იგონებს cycle day / confidence / fertile window.' },
      ],
    }),
  C('cycle-calendar-refinement', 'cycle', 6.5, '39.0.15', 'FROZEN', 'კალენდარის ვიზუალური დახვეწა',
    'Calendar visual freeze. iOS native QA გადავადებულია პროდუქტის გადაწყვეტილებით — არ არის ბლოკერი.',
    { contract: 'docs/CYCLE_UI_CONTRACT.md', iosDeferred: true, sort: 6.5 }),
  C('cycle-phase7', 'cycle', 7, '15.0.0', 'FINAL-FROZEN', 'OPK და ორსულობის ტესტი',
    'CycleLog.ovulationTest / pregnancyTest — მომხმარებლის ჩანაწერი. არ ცვლის ovulation მათემატიკას და არ გადაყავს Pregnancy რეჟიმში. პარტნიორის წილში არ შედის.',
    {
      contract: 'docs/CYCLE_SAFETY_CONTRACT.md',
      iosDeferred: true,
      iosNote: 'iOS Simulator ამ ჰოსტზე არ არის. Web/Android სქრინი iOS-ად არ ითვლება.',
      sort: 7,
    }),
  C('cycle-phase10-prediction-history', 'cycle', 10, '39.0.x', 'FINAL-FROZEN', 'პროგნოზის ისტორია',
    'სნეპშოტი: იმ მომენტში რა იწინასწარმეტყველა აპმა. რეტროაქტიული გამოგონება აკრძალულია. Journal presentation გაყინულია.',
    { contract: 'docs/CYCLE_PREDICTION_HISTORY_CONTRACT.md', sort: 10 }),
  C('cycle-phase11', 'cycle', 11, '39.0.26', 'FINAL-FROZEN', 'თვალთვალის საფუძველი',
    'სტრუქტურული observations, JSON export, დადასტურებული wipe. კლიენტის LMP phase engine ამოღებულია. Android სრული 12-shot ამ სესიაში არ დასრულდა (1 კადრი).',
    {
      contract: 'docs/CYCLE_OBSERVATION_CONTRACT.md',
      iosDeferred: true,
      sort: 11,
      fixes: [
        { severity: 'P1', title: 'Android capture incomplete', detail: 'Expo Go emulator-ზე blank activity. Phase 12-მა დაფარა More Tracking Android QA.' },
      ],
    }),
  C('cycle-phase12-rich-tracking', 'cycle', 12, '39.0.26', 'FINAL-FROZEN', 'Rich tracking',
    'Quick Log → More Tracking. Canonical CycleLog. უცნობი observation key-ები იფარება. Phase 11 tracking foundation აქ დასრულდა Android-ზე.',
    { contract: 'docs/CYCLE_OBSERVATION_CONTRACT.md', sort: 12 }),
  C('cycle-phase13-observation-trends', 'cycle', 13, '39.0.27', 'FINAL-FROZEN', 'ჟურნალის ტრენდები',
    'Journal observation trends. პროცენტები და კალენდრის მნიშვნელი არ არის. ძრავა უცვლელი.',
    { contract: 'docs/CYCLE_OBSERVATION_TRENDS_CONTRACT.md', sort: 13 }),
  C('cycle-phase14-doctor-summary', 'cycle', 14, '39.0.28', 'FINAL-FROZEN', 'ექიმის შეჯამება',
    'GET /api/cycle/doctor-summary. Default-deny: fertility / სექსუალური / შენიშვნები მხოლოდ დოკუმენტის opt-in-ით. არ არის პარტნიორი, Medi ან პირადი export.',
    { contract: 'docs/CYCLE_DOCTOR_SUMMARY_CONTRACT.md', sort: 14 }),
  C('cycle-phase15-locale', 'cycle', 15, '39.0.29', 'FINAL-FROZEN', 'კლინიკური ენები',
    'ერთი HTML renderer + {ka,en,fr,ru} კატალოგი. ენის ჩიპები /cycle/summary-ზე (default ka, არ ინახება, აპის ენას არ ცვლის). სერვერი ენობრივად ნეიტრალურია.',
    { contract: 'docs/CYCLE_DOCTOR_SUMMARY_CONTRACT.md', iosDeferred: true, sort: 15 }),
  C('cycle-phase16-ttc', 'cycle', 16, '40.0.0', 'FINAL-FROZEN', 'TTC რეჟიმის საფუძველი',
    'TRY_TO_CONCEIVE არის live presentation რეჟიმი. არ ამატებს მეოთხე პანელს და არ აკეთებს კლიენტის fertility მათემატიკას.',
    { contract: 'docs/CYCLE_TTC_CONTRACT.md', iosDeferred: true, sort: 16 }),
  C('cycle-phase17-ttc-coldstart', 'cycle', 17, '40.0.1', 'FINAL-FROZEN', 'TTC cold-start',
    'GET /api/cycle/ttc — 180-დღიანი owner read model, auth hydration-ზე. Phase 16 პროდუქტი რჩება გაყინული.',
    { contract: 'docs/CYCLE_TTC_CONTRACT.md', iosDeferred: true, sort: 17 }),
  C('cycle-phase18-pregnancy', 'cycle', 18, '41.0.0', 'FINAL-FROZEN', 'ორსულობის რეჟიმი',
    'PREGNANCY არის explicit-entry რეჟიმი CyclePregnancyEpisode-ით (ერთი ACTIVE). პროგნოზის ძრავა უცვლელი. OpenRouter Cycle AI რჩება scope-ის გარეთ.',
    { contract: 'docs/CYCLE_PREGNANCY_CONTRACT.md', sort: 18 }),
  C('cycle-phase19-baby-size', 'cycle', 19, '42.0.0', 'FINAL-FROZEN', 'ბავშვის ზომა / კვირები',
    'სტატიკური Hadlock/WHO/Williams კატალოგი. GET /api/cycle/pregnancy ამატებს weekDevelopment-ს Phase 18 კვირიდან. ხილი მხოლოდ owner UI-ში.',
    { contract: 'docs/PREGNANCY_BABY_SIZE_CONTRACT.md', sort: 19 }),
  C('cycle-phase20-doctor-pregnancy', 'cycle', 20, '43.0.0', 'FINAL-FROZEN', 'ექიმის შეჯამება — ორსულობა',
    'pregnancyContext doctor-summary-ზე, როცა რეჟიმი PREGNANCYა და ACTIVE ეპიზოდი არსებობს. ხილი არ არის. არ არის პარტნიორი/Medi.',
    { contract: 'docs/CYCLE_DOCTOR_SUMMARY_CONTRACT.md', iosDeferred: true, sort: 20 }),
  C('cycle-phase21-pregnancy-timeline', 'cycle', 21, '44.0.0', 'FINAL-FROZEN', 'ორსულობის timeline',
    '/cycle/pregnancy/timeline + compact CTA. სერვერის dating (კვირა/დღე/ტრიმესტრი). კლიენტი თარიღებს არ ითვლის.',
    { contract: 'docs/PREGNANCY_TIMELINE_CONTRACT.md', iosDeferred: true, sort: 21 }),
  C('cycle-phase22-pregnancy-observations', 'cycle', 22, '45.0.0', 'FINAL-FROZEN', 'ორსულობის სიმპტომები',
    'Canonical CycleLog only. todayObservations / recentObservations ეპიზოდის ფარგლებში. heartburn default AI/partner DENY.',
    { contract: 'docs/PREGNANCY_OBSERVATION_CONTRACT.md', iosDeferred: true, sort: 22 }),
  C('cycle-phase23-pregnancy-observation-trends', 'cycle', 23, '46.0.0', 'FINAL-FROZEN', 'ორსულობის ტრენდები',
    'Denominator-safe Journal summaries. პროცენტები, calendar denominator, increasing/worsening — აკრძალულია.',
    { contract: 'docs/PREGNANCY_OBSERVATION_TRENDS_CONTRACT.md', iosDeferred: true, sort: 23 }),
  C('cycle-phase24-perimenopause', 'cycle', 24, '47.0.0', 'FINAL-FROZEN', 'პერიმენოპაუზა — საფუძველი',
    'მხოლოდ Settings-ის explicit შესვლა. ასაკით/სიმპტომით ავტო-შესვლა არ არის. ეს არ არის დიაგნოზი.',
    { contract: 'docs/CYCLE_PERIMENOPAUSE_CONTRACT.md', sort: 24 }),
  C('cycle-phase25-doctor-perimenopause', 'cycle', 25, '48.0.0', 'FINAL-FROZEN', 'ექიმის შეჯამება — პერი',
    'additive perimenopauseContext doctor-summary-ზე. მომხმარებლის არჩეული თვალთვალი, არა დიაგნოზი.',
    { contract: 'docs/CYCLE_PERIMENOPAUSE_CONTRACT.md', sort: 25 }),
  C('cycle-phase26-peri-observation-summaries', 'cycle', 26, '49.0.2', 'FINAL-FROZEN', 'პერის Journal შეჯამებები',
    'ბოლო 30 სამოქალაქო დღე, 2+ შემთხვევა. პროცენტები და მნიშვნელი არ არის. ეპიზოდის მოდელი არ არის.',
    { contract: 'docs/PERIMENOPAUSE_OBSERVATION_SUMMARIES_CONTRACT.md', iosDeferred: true, sort: 26 }),
  C('cycle-phase27-mode-capabilities', 'cycle', 27, '50.0.0', 'FINAL-FROZEN', 'რეჟიმის შესაძლებლობები',
    'კანონიკური presentation matrix (სერვერი + მობაილი, დუბლირებული — Metro repo-root-ს არ იმპორტებს).',
    { contract: 'docs/CYCLE_MODE_CAPABILITIES_CONTRACT.md', iosDeferred: true, sort: 27 }),
  C('cycle-phase28-observation-assessment', 'cycle', 28, '51.0.0', 'FINAL-FROZEN', 'შეფასების სამი მდგომარეობა',
    'UNKNOWN / ABSENT / PRESENT. ABSENT მხოლოდ explicit. პროცენტები, დიაგნოზი, OpenRouter — არა.',
    { contract: 'docs/CYCLE_OBSERVATION_ASSESSMENT_CONTRACT.md', sort: 28 }),
  C('cycle-phase29-exposure-rates', 'cycle', 29, '52.0.0', 'FINAL-FROZEN', 'Exposure rates',
    'პირველი ნებადართული მნიშვნელი: field-specific assessedDays. ზღვარი: present≥2, assessed≥5, coverage≥30%.',
    { contract: 'docs/CYCLE_OBSERVATION_EXPOSURE_RATES_CONTRACT.md', sort: 29 }),
  C('cycle-phase30-exposure-comparison', 'cycle', 30, '53.0.0', 'FINAL-FROZEN', 'ორი ფანჯრის შედარება',
    'ორი მიმდებარე 14-დღიანი ფანჯარა. რიცხვები და მიმართულება ცალკე კვალიფიცირდება. similar/improving/hormonal/AI — არა.',
    { contract: 'docs/CYCLE_OBSERVATION_EXPOSURE_COMPARISON_CONTRACT.md', sort: 30 }),
  C('cycle-phase31-explainability', 'cycle', 31, '54.0.0', 'FINAL-FROZEN', 'გამჭვირვალობა',
    'ერთი sheet ხსნის assessed-day rates/comparisons. ქოუჩინგი, სტრიკი, ზღვარი, დიაგნოზი — არა.',
    { contract: 'docs/CYCLE_OBSERVATION_EXPLAINABILITY_CONTRACT.md', sort: 31 }),
  C('cycle-phase32-care-planner', 'cycle', 32, '55.0.0', 'FINAL-FROZEN', 'პრენატალური გეგმა',
    'ინფორმაციული planner (prenatal-care-v1). არ არის სამედიცინო ბრძანება, რისკის ქულა, AI, პარტნიორი ან მეორე GA ძრავა.',
    { contract: 'docs/PREGNANCY_CARE_PLANNER_CONTRACT.md', sort: 32 }),
  C('cycle-phase33-care-reminders', 'cycle', 33, '56.0.0', 'FINAL-FROZEN', 'ვიზიტის შეხსენებები',
    'Explicit opt-in მხოლოდ user-planned თარიღზე. Notification Brain ერთადერთი მიმწოდებელი. კატალოგის „ვადაა“ პუშები არ არის.',
    { contract: 'docs/PREGNANCY_CARE_REMINDER_CONTRACT.md', sort: 33 }),
  C('cycle-phase34-care-calendar', 'cycle', 34, '57.0.0', 'FINAL-FROZEN', 'OS კალენდრის ექსპორტი',
    'ერთი მიმართულების all-day ექსპორტი. OS alarm არ არის. საკუთრება მოწყობილობაზეა, არა health API-ში.',
    { contract: 'docs/PREGNANCY_CARE_CALENDAR_EXPORT_CONTRACT.md', sort: 34 }),
  C('cycle-phase35-appointment-time', 'cycle', 35, '58.0.0', 'FINAL-FROZEN', 'ვიზიტის საათი',
    'optional plannedTime (HH:mm). Date-only რჩება default all-day. 30 წუთი ტექნიკური calendar end — არ ჩანს ვიზიტის ხანგრძლივობად. Phase 33 შეხსენება საათს იგნორებს.',
    { contract: 'docs/PREGNANCY_CARE_APPOINTMENT_TIME_CONTRACT.md', sort: 35 }),
  C('cycle-phase36-exact-time-reminder', 'cycle', 36, '59.0.0', 'FINAL-FROZEN', 'ზუსტი საათის შეხსენება',
    'EXACT_TIME მხოლოდ მაშინ, როცა owner-მა შეიყვანა თარიღი+საათი და აშკარად აირჩია ზუსტი რეჟიმი. საათის დამატება DATE_BASED 09:00-ს ავტომატურად არ ცვლის.',
    { contract: 'docs/PREGNANCY_CARE_EXACT_TIME_REMINDER_CONTRACT.md', sort: 36 }),
  C('cycle-phase37-visit-place', 'cycle', 37, '60.0.0', 'FINAL-FROZEN', 'ვიზიტის ადგილი',
    'optional plannedPlace (მაქს. 160 Unicode) დაგეგმილ თარიღზე. მხოლოდ ტექსტი — რუკა, გეოკოდირება, კლინიკის ძებნა არ არის. არ შედის შეხსენებაში, OS Calendar-ში, პარტნიორში, Medi-ში, ექიმის შეჯამებაში, ანალიტიკაში.',
    {
      contract: 'docs/PREGNANCY_CARE_VISIT_PLACE_CONTRACT.md',
      sort: 37,
      notInScope: [
        'გეოლოკაცია / რუკები / კლინიკის ძებნა',
        'ადგილის ჩასმა OS Calendar location-ში',
        'ადგილის გაჟონვა partner / Medi / doctor summary / Brain-ში',
      ],
      fixes: [
        { severity: 'P0', title: 'PUT 500 — გამოტოვებული import', detail: 'resolveCarePlanPlaceFields გამოიძახებოდა cycle.routes.js-ში იმპორტის გარეშე. დაემატა import; route ტესტი ამოწმებს binding-ს.' },
        { severity: 'P1', title: 'გრძელი ადგილი არ იხვევა', detail: 'multiline TextInput + ახალი ხაზების მოცილება PregnancyCarePlannedPlace-ში.' },
      ],
    }),
  C('cycle-phase38-postpartum', 'cycle', 38, '61.0.0', 'FINAL-FROZEN', 'მშობიარობის შემდგომი რეჟიმი',
    'Explicit owner-selected POSTPARTUM. არ არის ორსულობის შედეგი. საწყისი თარიღი არჩევითია. ძრავის არითმეტიკა უცვლელი. Postpartum flow არ შედის მენსტრუაციის პროგნოზში.',
    {
      contract: 'docs/CYCLE_POSTPARTUM_MODE_CONTRACT.md',
      sort: 38,
      notInScope: [
        'შედეგის დასკვნა (ცოცხალი მშობიარობა / მოშლა / მკვდრადშობადობა / აბორტი / ექტოპია)',
        'გამოჯანმრთელების ქულა / EPDS / ძუძუთი კვება / ჩვილის ტრეკერი',
        'ნაყოფიერების დაბრუნების პროგნოზი',
        'postpartum პუშები / AI / partner',
      ],
    }),
  C('cycle-phase39-postpartum-doctor', 'cycle', 39, '62.0.0', 'FINAL-FROZEN', 'ექიმის შეჯამება — მშობიარობის შემდგომი კონტექსტი',
    'არსებულ doctor-summary-ზე მიმდინარე POSTPARTUM კონტექსტი. საწყისი თარიღი მხოლოდ პაციენტის მითითებული. არ არის ორსულობის შედეგი და არ არის გამოჯანმრთელების ქულა.',
    {
      contract: 'docs/CYCLE_POSTPARTUM_DOCTOR_SUMMARY_CONTRACT.md',
      sort: 39,
      notInScope: [
        'ორსულობის შედეგის დასკვნა / მშობიარობის ტიპი / ჩვილის სტატუსი',
        'გამოჯანმრთელების ქულა ან დიაგნოზი',
        'ნაყოფიერების დაბრუნების პროგნოზი',
        'plannedPlace / plannedTime / შეხსენების კონფიგი',
        'partner / AI / personal export / Brain-ის გაფართოება',
      ],
    }),
  C('cycle-phase40-postpartum-copy', 'cycle', 40, '63.0.0', 'FINAL-FROZEN', 'მშობიარობის შემდგომი ჟურნალი — ასლის იზოლაცია',
    'POSTPARTUM ცარიელი ჟურნალი და /cycle/summary აღარ იგებს მენსტრუაციას. სისხლდენა რჩება ფაქტი. Phase 39 JSON/PDF უცვლელი. პროგნოზის არითმეტიკა უცვლელი.',
    {
      contract: 'docs/CYCLE_POSTPARTUM_COPY_ISOLATION_CONTRACT.md',
      sort: 40,
      notInScope: [
        'ლოხია / პირველი მენსტრუაციის დასკვნა / PPH',
        'პროგნოზის არითმეტიკა / engine input',
        'Phase 39 doctor-summary JSON/PDF',
        'AI / partner / Brain / schema / API',
      ],
    }),
  C('cycle-phase41-postpartum-period-classification', 'cycle', 41, '64.0.0', 'FINAL-FROZEN', 'მშობიარობის შემდგომი სისხლდენის მფლობელის კლასიფიკაცია',
    'Owner explicitly marks a postpartum bleed episode as their period. Default remains unknown bleeding. Forecast stays suppressed in POSTPARTUM. No fertility/ovulation inference.',
    {
      contract: 'docs/CYCLE_POSTPARTUM_PERIOD_CLASSIFICATION_CONTRACT.md',
      sort: 41,
      current: false,
      notInScope: [
        'ავტომატური მენსტრუაციის დასკვნა / ლოხია / PPH',
        'ნაყოფიერების ან ოვულაციის დაბრუნება',
        'POSTPARTUM-ში მომავალი პროგნოზის ჩართვა',
        'Phase 39 doctor-summary shape / Phase 38 AI fail-closed',
      ],
    }),
  C('cycle-phase42-postpartum-return-to-track', 'cycle', 42, '65.0.1', 'FINAL-FROZEN', 'მშობიარობის შემდგომი რეჟიმიდან სტანდარტულ აღრიცხვაზე დაბრუნება',
    'Owner explicitly returns POSTPARTUM to TRACK_PERIOD. Mode and forecast readiness are separate. Postpartum-classified periods can become factual history; forecasts stay gated until two valid new intervals exist. No default-28, stored average, or pre-pregnancy history shortcut.',
    {
      contract: 'docs/CYCLE_POSTPARTUM_RETURN_TO_TRACK_CONTRACT.md',
      sort: 42,
      current: true,
      iosDeferred: true,
      notInScope: [
        'ავტომატური რეჟიმის შეცვლა',
        'ნაყოფიერების ან ოვულაციის დაბრუნება',
        'პროგნოზის არითმეტიკის შეცვლა',
        'Phase 41 კლასიფიკაციის სემანტიკა / Phase 38 AI fail-closed',
      ],
    }),
  C('phase-7.1', 'medi', null, '7.1', 'FROZEN', 'Native auth / OTP',
    'ტელეფონი → OTP → bundle. Medi Companion-ის წინა native QA ხაზი.',
    { sort: 107.1 }),
  C('phase-7.2', 'medi', null, '7.2', 'FROZEN', 'Companion follow-up',
    'Phase 7.1-ის შემდგომი native კადრები.',
    { sort: 107.2 }),
  C('phase-9.1', 'medi', 9.1, '9.1', 'FROZEN', 'Medi Companion — დასაწყისი',
    '/medi-companion soft teal SVG, journey path. Talk → /chat/doctor. არ ეხება Rewards Store / Brain / quest economy-ს.',
    { sort: 109.1 }),
  C('phase-9.2', 'medi', 9.2, '9.2', 'FROZEN', 'Medi Companion — გაფართოება',
    'კოლექცია, equip, home chip Quest-ის გვერდით (არა მეორე დეშბორდი).',
    { sort: 109.2 }),
  C('phase-9.3', 'medi', 9.3, '9.3', 'FINAL-FROZEN', 'Medi Companion V1',
    'MEDI COMPANION V1 FINAL-FROZEN native QA-ით. კლიენტი api.mediCompanion ↔ /api/medi-companion*.',
    { sort: 109.3 }),
  C('medi-world-phase38', 'medi', 38, '1.0.0.7.72', 'PASS', 'Medi World საძირკველი',
    'Phase 38.1 PASS. Care Energy, world profile, quest adapter. რუკა/სოციალური/Health Tree არ არის. ისტორიული QuestCompletion არ ივსება.',
    { contract: 'docs/MEDI_WORLD_PHASE38_CONTRACT.md', sort: 138 }),
  C('medi-world-phase39', 'medi', 39, '1.0.0.7.73', 'PASS', 'Medi World ეკონომიკა',
    'Care Energy ზოლები, World XP, დონეები 1–50, დღიური ლიმიტები, შიდა DEBIT. რუკა/მაღაზია/Companion unlock არ არის.',
    { contract: 'docs/MEDI_WORLD_PHASE39_CONTRACT.md', sort: 139 }),
  C('medi-world-phase40', 'medi', 40, '1.0.0.7.74', 'PASS', 'Medi Companion Care Space',
    'კანონიკური Medi Companion, evolution, Bond, cosmetics, Care Space. რუკა/Health Tree/სოციალური არ არის.',
    { contract: 'docs/MEDI_WORLD_PHASE40_CONTRACT.md', sort: 140 }),
  C('medi-world-phase41', 'medi', 41, '1.0.0.7.75', 'FOUNDATION', 'Daily Adventure',
    'დღის პერსონალური გზა არსებულ Quest-ებზე. მეორე quest engine არ არის. სამედიცინო მონაცემები არ გამოიყენება.',
    { contract: 'docs/MEDI_WORLD_PHASE41_CONTRACT.md', sort: 141 }),
  C('medi-world-phase42', 'medi', 42, '1.0.0.7.77', 'FOUNDATION', 'Safe World Map',
    'საჯარო ადგილები და Care Spark აღმოჩენები. Foreground location. კოორდინატები არ ინახება. ჯილდო არ არის.',
    { contract: 'docs/MEDI_WORLD_PHASE42_CONTRACT.md', sort: 142 }),
  C('medi-world-phase43', 'medi', 43, '1.0.0.7.79', 'PASS', 'Privacy-preserving movement sessions',
    'წინა პლანის მოძრაობის სესია. ხანგრძლივობის მიზანი. კოორდინატები არ ინახება. ჯილდო ერთხელ.',
    { contract: 'docs/MEDI_WORLD_PHASE43_CONTRACT.md', sort: 143 }),
  C('medi-world-phase44', 'medi', 44, '1.0.0.7.80', 'PASS', 'Personal Care Garden',
    'პირადი ბაღი Care Energy-ით. მცენარეები არ ჭკნება. ჯანმრთელობის სტატუსი არ არის.',
    { contract: 'docs/MEDI_WORLD_PHASE44_CONTRACT.md', sort: 144 }),
  C('home-reorder-36.3.4', 'home', null, '36.3.4', 'FROZEN', 'Home სექციების რიგი',
    'buildHomeSectionOrder: NextDose → Steps → Hydration → Weight → Quest+Companion → Cycle → Lab → Weather → Run → Symptom → Analysis → Consilium → Recent. სათაური ბარათის ზემოთ.',
    { sort: 36.34 }),
  C('admin-v3-step1', 'admin', null, 'v3.1', 'FROZEN', 'Admin V3 — ნაბიჯი 1',
    'პირველი V3 გვერდების visual QA (overview, users, health, …).',
    { sort: 201 }),
  C('admin-v3-step2', 'admin', null, 'v3.2', 'FROZEN', 'Admin V3 — ნაბიჯი 2',
    'შემდეგი მოდულების visual pass.',
    { sort: 202 }),
  C('admin-v3-step3', 'admin', null, 'v3.3', 'FROZEN', 'Admin V3 — ნაბიჯი 3',
    'V3 visual QA, მესამე პასი.',
    { sort: 203 }),
  C('admin-v3-step3.1', 'admin', null, 'v3.3.1', 'FROZEN', 'Admin V3 — ნაბიჯი 3.1',
    'დაზუსტებული visual recapture.',
    { sort: 203.1 }),
  C('admin-v3-step4', 'admin', null, 'v3.4', 'FROZEN', 'Admin V3 — ნაბიჯი 4',
    'V3 visual QA, მეოთხე პასი.',
    { sort: 204 }),
  C('admin-v3-full-redesign', 'admin', null, 'v3', 'FROZEN', 'Admin V3 — სრული რედიზაინი',
    'სრული V3 რედიზაინის live-report.',
    { sort: 210 }),
  C('admin-v3-final-unification', 'admin', null, 'v3.final', 'FINAL-FROZEN', 'Admin V3 — unification',
    'საბოლოო chrome unification: light/dark contact sheets და live-report.',
    { sort: 211 }),
];

const CATALOG_BY_FOLDER = new Map(PHASE_CATALOG.map((p) => [p.folder, p]));

function repoRoot() {
  const candidates = [
    path.resolve(__dirname, '../../..'),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd()),
  ];
  for (const root of candidates) {
    if (existsSync(path.join(root, 'qa')) && existsSync(path.join(root, 'mobile', 'app.json'))) return root;
  }
  return candidates[0];
}

export function getQaRoot() {
  return path.join(repoRoot(), 'qa');
}

export function getDocsRoot() {
  return path.join(repoRoot(), 'docs');
}

function isSafeSegment(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]+$/.test(value);
}

function underRoot(root, abs) {
  const rel = path.relative(path.resolve(root), path.resolve(abs));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function resolveQaFile(folder, file) {
  if (!isSafeSegment(folder) || !isSafeSegment(file)) return null;
  if (SKIP_FILES.has(file) || SKIP_PREFIX.test(file)) return null;
  const ext = path.extname(file).toLowerCase();
  if (!IMAGE_EXT.has(ext) && !TEXT_EXT.has(ext)) return null;
  const abs = path.resolve(getQaRoot(), folder, file);
  if (!underRoot(getQaRoot(), abs) || !existsSync(abs) || !statSync(abs).isFile()) return null;
  return { abs, folder, file, mime: MIME[ext] || 'application/octet-stream', ext };
}

export function resolveContractFile(file) {
  const base = path.basename(String(file || ''));
  if (!/^[A-Za-z0-9_]+\.md$/.test(base)) return null;
  const abs = path.resolve(getDocsRoot(), base);
  if (!underRoot(getDocsRoot(), abs) || !existsSync(abs)) return null;
  const allowed = PHASE_CATALOG.some((p) => p.contract && path.basename(p.contract) === base);
  if (!allowed && !/CONTRACT/i.test(base)) return null;
  return { abs, file: base, mime: 'text/markdown; charset=utf-8' };
}

function humanizeShot(name) {
  return String(name)
    .replace(/\.(png|jpe?g|webp|gif)$/i, '')
    .replace(/^\d+[a-z]?-/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function redactSecrets(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.slice(0, 12).map((v) => redactSecrets(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEY.test(k)) continue;
    out[k] = redactSecrets(v, depth + 1);
  }
  return out;
}

function summarizeFirewall(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    generatedAt: raw.generatedAt || null,
    exportIncludesPlace: Boolean(raw.exportIncludesPlace),
    partnerClean: raw.partner?.rawPlaceInEmptyPartner === false,
    aiPromptIncludesPlace: Boolean(raw.ai?.promptIncludesPlace),
    doctorSummaryIncludesPlace: Boolean(raw.doctor?.summaryIncludesPlace),
    reminderHasPlaceField: Boolean(raw.reminder?.candidateHasPlaceField),
    calendarHasLocation: Boolean(raw.calendar?.hasLocation),
    nativeEventLocation: raw.nativeCalendar?.eventLocation ?? null,
  };
}

function summarizeBrain(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cases = raw.cases && typeof raw.cases === 'object'
    ? Object.entries(raw.cases).map(([id, c]) => ({
        id,
        ok: c?.schedule?.ok !== false,
        mode: c?.schedule?.mode || null,
        usesPlannedTime: Boolean(c?.schedule?.usesPlannedTime),
      }))
    : [];
  return { generatedAt: raw.generatedAt || null, timezone: raw.timezone || null, cases };
}

function readJsonSafe(abs) {
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

function scanFolder(folderPath) {
  let files = [];
  try {
    files = readdirSync(folderPath, { withFileTypes: true }).filter((d) => d.isFile());
  } catch {
    return { screenshots: [], artifacts: [], iosDeferred: false, iosNote: null, proofs: {}, mtime: null };
  }

  const screenshots = [];
  const artifacts = [];
  let iosDeferred = false;
  let iosNote = null;
  const proofs = {};
  let mtime = 0;

  for (const ent of files) {
    const ext = path.extname(ent.name).toLowerCase();
    const abs = path.join(folderPath, ent.name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.mtimeMs > mtime) mtime = st.mtimeMs;

    if (SKIP_FILES.has(ent.name) || SKIP_PREFIX.test(ent.name)) continue;

    if (IMAGE_EXT.has(ext)) {
      screenshots.push({ file: ent.name, label: humanizeShot(ent.name), bytes: st.size });
      continue;
    }

    if (/IOS_QA_DEFERRED|IOS_NATIVE_QA_BLOCKED/i.test(ent.name)) {
      iosDeferred = true;
      try {
        iosNote = readFileSync(abs, 'utf8').split(/\r?\n/).slice(0, 8).join('\n').trim() || null;
      } catch {
        iosNote = 'iOS QA deferred';
      }
    }

    if (TEXT_EXT.has(ext)) {
      artifacts.push({ file: ent.name, kind: ext.slice(1), bytes: st.size });
      if (ent.name === 'firewall-traces.json') {
        const json = readJsonSafe(abs);
        const summary = summarizeFirewall(json);
        if (summary) proofs.firewall = summary;
      } else if (ent.name === 'brain-traces.json') {
        const json = readJsonSafe(abs);
        const summary = summarizeBrain(json);
        if (summary) proofs.brain = summary;
      }
    }
  }

  screenshots.sort((a, b) => a.file.localeCompare(b.file, 'en'));
  artifacts.sort((a, b) => a.file.localeCompare(b.file, 'en'));
  return {
    screenshots,
    artifacts,
    iosDeferred,
    iosNote,
    proofs,
    mtime: mtime || null,
  };
}

function familyLabel(family) {
  return { cycle: 'ციკლი', medi: 'Medi', admin: 'ადმინი', home: 'სახლი', other: 'სხვა' }[family] || family;
}

function inferFamily(folder) {
  if (folder.startsWith('cycle-')) return 'cycle';
  if (folder.startsWith('admin-')) return 'admin';
  if (folder.startsWith('phase-')) return 'medi';
  if (folder.startsWith('home-')) return 'home';
  return 'other';
}

function inferTitle(folder) {
  return folder.replace(/^cycle-/, '').replace(/-/g, ' ');
}

export function buildCycleQaBoard() {
  const qaRoot = getQaRoot();
  const appVersion = getMobileAppVersion();
  const scanned = [];
  const seen = new Set();

  if (existsSync(qaRoot)) {
    for (const ent of readdirSync(qaRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      if (!isSafeSegment(ent.name)) continue;
      seen.add(ent.name);
      const meta = CATALOG_BY_FOLDER.get(ent.name) || {
        folder: ent.name,
        family: inferFamily(ent.name),
        phase: null,
        version: null,
        status: 'UNKNOWN',
        titleKa: inferTitle(ent.name),
        summary: 'კატალოგში აღწერა არ არის — ნაჩვენებია მხოლოდ qa/ სკანის შედეგი.',
        sort: 900,
      };
      const live = scanFolder(path.join(qaRoot, ent.name));
      scanned.push({
        ...meta,
        iosDeferred: Boolean(meta.iosDeferred || live.iosDeferred),
        iosNote: live.iosNote || meta.iosNote || null,
        screenshots: live.screenshots,
        artifacts: live.artifacts,
        proofs: live.proofs,
        screenshotCount: live.screenshots.length,
        artifactCount: live.artifacts.length,
        mtime: live.mtime,
        contractExists: Boolean(meta.contract && existsSync(path.join(repoRoot(), meta.contract))),
      });
    }
  }

  for (const meta of PHASE_CATALOG) {
    if (seen.has(meta.folder)) continue;
    scanned.push({
      ...meta,
      iosDeferred: Boolean(meta.iosDeferred),
      iosNote: meta.iosNote || null,
      screenshots: [],
      artifacts: [],
      proofs: {},
      screenshotCount: 0,
      artifactCount: 0,
      mtime: null,
      missingFolder: true,
      contractExists: Boolean(meta.contract && existsSync(path.join(repoRoot(), meta.contract))),
    });
  }

  scanned.sort((a, b) => {
    const as = a.sort ?? 999;
    const bs = b.sort ?? 999;
    if (as !== bs) return bs - as;
    return String(a.folder).localeCompare(b.folder);
  });

  const cycle = scanned.filter((p) => p.family === 'cycle');
  const frozen = scanned.filter((p) => /FROZEN/i.test(p.status || ''));
  const iosDeferred = scanned.filter((p) => p.iosDeferred);
  const screenshots = scanned.reduce((n, p) => n + (p.screenshotCount || 0), 0);
  const current = cycle.find((p) => p.current) || cycle[0] || null;
  const importantFixes = scanned.flatMap((p) =>
    (p.fixes || []).map((f) => ({
      ...f,
      folder: p.folder,
      phase: p.phase,
      titleKa: p.titleKa,
    })),
  );

  const notes = [
    current
      ? `ახლა: Cycle ფაზა ${current.phase ?? '—'} — ${current.titleKa} (${current.status}, აპი ${current.version || appVersion || '—'}).`
      : 'მიმდინარე Cycle ფაზა კატალოგში არ მოიძებნა.',
    'iOS native QA გადავადებულია პროდუქტის გადაწყვეტილებით — არ არის ბლოკერი და არ არის შემდეგი სამუშაო.',
    'Observation statistics ცალკე ფაზად არ არის დაგეგმილი, სანამ owner არ შეცვლის.',
    'ეს გვერდი კითხულობს qa/ არტეფაქტებს. ცოცხალი მომხმარებლის ჯანმრთელობა, ჩატი და plannedPlace აქ არ ჩანს.',
  ];

  const families = ['cycle', 'medi', 'home', 'admin', 'other']
    .map((id) => ({
      id,
      label: familyLabel(id),
      count: scanned.filter((p) => p.family === id).length,
      shots: scanned.filter((p) => p.family === id).reduce((n, p) => n + (p.screenshotCount || 0), 0),
    }))
    .filter((f) => f.count > 0);

  return {
    generatedAt: new Date().toISOString(),
    appVersion: appVersion || null,
    now: current
      ? {
          folder: current.folder,
          phase: current.phase,
          version: current.version,
          status: current.status,
          titleKa: current.titleKa,
          summary: current.summary,
          notInScope: current.notInScope || [],
        }
      : null,
    notes,
    kpis: {
      currentPhase: current?.phase ?? null,
      appVersion: current?.version || appVersion || null,
      frozenCount: frozen.length,
      iosDeferredCount: iosDeferred.length,
      screenshotCount: screenshots,
      phaseCount: scanned.length,
      cyclePhaseCount: cycle.length,
    },
    families,
    importantFixes,
    phases: scanned.map((p) => ({
      folder: p.folder,
      family: p.family,
      familyLabel: familyLabel(p.family),
      phase: p.phase,
      version: p.version,
      status: p.status,
      titleKa: p.titleKa,
      summary: p.summary,
      contract: p.contract || null,
      contractExists: Boolean(p.contractExists),
      iosDeferred: Boolean(p.iosDeferred),
      iosNote: p.iosNote,
      notInScope: p.notInScope || [],
      fixes: p.fixes || [],
      screenshots: p.screenshots,
      artifacts: p.artifacts,
      proofs: p.proofs,
      screenshotCount: p.screenshotCount,
      artifactCount: p.artifactCount,
      mtime: p.mtime,
      missingFolder: Boolean(p.missingFolder),
      current: Boolean(p.current),
    })),
  };
}
