// MEDISLEEP starter content: advice the admin can edit (SleepTip, seeded once — missing ids only) and the module
// settings defaults (SleepConfig). Advice follows the research brief of 2026-10-12: regular wake time, morning light,
// caffeine ≥ 8 h before bed (Gardiner 2023), alcohol and the second half of the night, stimulus control for long
// sleep latency (CBT-I), noise with a timer rather than all night, a doctor when poor sleep lasts for weeks.
import { SLEEP_FACTOR_IDS } from './sleep.js';

export const SLEEP_TIP_TRIGGERS = [
  'always', 'short', 'irregular', 'late', 'weekend', 'latency', 'wakeups', 'poor',
  'caffeine', 'alcohol', 'screens', 'stress', 'late_meal', 'noise', 'heat',
];

/** [id, trigger, titleKa, titleEn, bodyKa, bodyEn] */
const TIPS = [
  ['same-wake', 'always', 'ერთი და იგივე გაღვიძების დრო', 'The same wake-up time',
    'ყველაზე ძლიერი ჩვევა ყოველდღე ერთსა და იმავე დროს ადგომაა, შაბათ-კვირასაც. სხეული მალე ეჩვევა და საღამოს ძილი თავისით მოდის.',
    'The strongest habit is getting up at the same time every day, weekends included. Your body adapts quickly and sleepiness comes on its own in the evening.'],
  ['morning-light', 'always', 'დილის შუქი', 'Morning light',
    'გაღვიძებიდან ერთ საათში 10–15 წუთი გაატარე გარეთ, დღის შუქზე. ასე საღამოს ძილი უფრო ადრე და ღრმად მოდის. დილის გასეირნება MEDIRUN-ში ამასაც ითვლის.',
    'Spend 10–15 minutes outside in daylight within an hour of waking. It brings sleep earlier and deeper in the evening. A morning MEDIRUN walk counts too.'],
  ['cool-dark', 'always', 'გრილი და ბნელი ოთახი', 'A cool, dark room',
    'საძინებელში საუკეთესოა 18–20°C და სრული სიბნელე. მკრთალი ნათურაც კი აუარესებს ძილის ხარისხს.',
    '18–20°C and full darkness work best. Even a dim lamp lowers sleep quality.'],
  ['protect-hours', 'short', 'დაიცავი ძილის საათები', 'Protect your sleep hours',
    'ბოლო ღამეებში მიზანზე ნაკლები გეძინა. ყოველ 3–4 დღეში 15 წუთით ადრე დაწექი, სანამ მიზანს არ მიაღწევ.',
    'You have slept less than your goal lately. Go to bed 15 minutes earlier every 3–4 days until you reach it.'],
  ['steady-rhythm', 'irregular', 'თანაბარი რიტმი', 'A steady rhythm',
    'დაწოლის დრო ღამიდან ღამემდე ბევრს იცვლება. რეგულარული ძილი ხანგრძლივობაზე არანაკლებ მნიშვნელოვანია — ეცადე, ერთი საათის ფარგლებში დაწვე და ადგე.',
    'Your bedtime changes a lot from night to night. Regular sleep matters as much as long sleep — try to stay within one hour.'],
  ['wind-down', 'late', 'დამშვიდების დრო', 'Time to wind down',
    'დაგეგმილზე გვიან წვები. დაწოლამდე 30 წუთით ადრე ჩააქრე ზედა შუქი, გადადე ტელეფონი და ჩართე ხმა ან სუნთქვის ვარჯიში.',
    'You go to bed later than planned. Half an hour before bedtime, switch off the overhead light, put the phone away and start a sound or a breathing exercise.'],
  ['weekend-drift', 'weekend', 'შაბათ-კვირის რიტმი', 'The weekend drift',
    'შაბათ-კვირას ძილს ერთ საათზე მეტით წევ — ორშაბათს სხეული ისე გრძნობს თავს, თითქოს სხვა ქვეყნიდან ჩამოფრინდი. ეცადე, შაბათ-კვირასაც მაქსიმუმ ერთი საათით გვიან ადგე.',
    'Your weekend sleep shifts by more than an hour, so Monday feels like jet lag. Try to get up no more than an hour later on weekends.'],
  ['get-up-rule', 'latency', '20 წუთის წესი', 'The 20-minute rule',
    'თუ დიდხანს ვერ იძინებ, ძალით ნუ იწვები. ადექი, მკრთალ შუქზე წაიკითხე რამე მშვიდი და დაბრუნდი, როცა ძილი მოგერევა. საწოლი ძილს უნდა უკავშირდებოდეს და არა ფიქრს.',
    "If you can't fall asleep, don't force it. Get up, read something calm in dim light and come back when you feel sleepy. Bed should mean sleep, not worrying."],
  ['night-wakeups', 'wakeups', 'ღამის გაღვიძებები', 'Waking at night',
    'ღამით გაღვიძება ნორმალურია. ნუ შეხედავ საათს და ტელეფონს — ეს ფიქრებს რთავს. თუ ხშირად იღვიძებ, ჰკითხე Medi-ს ან ექიმს.',
    "Waking at night is normal. Don't check the clock or your phone — it switches your mind on. If it happens often, ask Medi or a doctor."],
  ['poor-sleep', 'poor', 'თუ ძილი ხშირად ცუდია', 'If sleep is often poor',
    'თუ კვირებია ცუდად გძინავს, ექიმს მიმართე. უძილობის ყველაზე ეფექტური მკურნალობა ქცევითი თერაპიაა (CBT-I) და არა მხოლოდ წამალი.',
    'If you have slept poorly for weeks, talk to a doctor. The most effective treatment for insomnia is a behavioural therapy (CBT-I), not just pills.'],
  ['caffeine-cutoff', 'caffeine', 'ყავის ბოლო ჭიქა', 'Your last coffee',
    'კოფეინი ორგანიზმში 5 საათზე მეტხანს რჩება. ბოლო ყავა დაწოლამდე სულ მცირე 8 საათით ადრე დალიე — 23:00-ზე დაწოლისთვის 15:00-მდე.',
    'Caffeine stays in your body for more than 5 hours. Have your last coffee at least 8 hours before bed — before 3 pm for an 11 pm bedtime.'],
  ['alcohol', 'alcohol', 'ალკოჰოლი და ძილი', 'Alcohol and sleep',
    'ალკოჰოლი ჩაძინებას აადვილებს, მაგრამ ღამის მეორე ნახევარს არღვევს და REM ძილს ამცირებს. თუ სვამ, დაწოლამდე 3 საათით ადრე დაასრულე.',
    'Alcohol helps you drop off but breaks up the second half of the night and cuts REM sleep. If you drink, finish 3 hours before bed.'],
  ['screens', 'screens', 'ტელეფონი საწოლის გარეთ', 'Phone out of bed',
    'ეკრანი ტვინს აფხიზლებს — შინაარსი უფრო მეტად, ვიდრე შუქი. ჩართე ძილის რეჟიმი და ტელეფონი ხელის გაწვდენაზე შორს დადე.',
    'Screens keep the brain alert — the content even more than the light. Start sleep mode and put the phone out of reach.'],
  ['worry-list', 'stress', 'ფიქრების სია', 'A worry list',
    'საღამოს 5 წუთით ჩაწერე, რა გაწუხებს და ხვალ რას გააკეთებ. დაწერილი ფიქრი საწოლში ნაკლებად გიბრუნდება. მერე სცადე სუნთქვის ვარჯიში.',
    "In the evening, write down for 5 minutes what's on your mind and what you'll do tomorrow. Written-down thoughts come back less in bed. Then try a breathing exercise."],
  ['late-meal', 'late_meal', 'ვახშამი უფრო ადრე', 'An earlier dinner',
    'მძიმე ვახშამი დაწოლამდე 2–3 საათით ადრე დაასრულე. თუ მერე მოგშივდება, მსუბუქი რამ — იოგურტი ან ბანანი — სჯობს.',
    'Finish a heavy dinner 2–3 hours before bed. If you get hungry later, something light like yoghurt or a banana is better.'],
  ['noise', 'noise', 'ხმაურის წინააღმდეგ', 'Against noise',
    'ქუჩის ხმაურს ყურის საცობები ყველაზე კარგად ფარავს. ხმაურიან ღამეს ჩართე ყავისფერი ხმაური ან წვიმა ტაიმერით — მთელი ღამე ჩართული ხმა საჭირო არ არის.',
    "Earplugs block street noise best. On noisy nights use brown noise or rain with a timer — the sound doesn't need to play all night."],
  ['heat', 'heat', 'ცხელი ღამე', 'A hot night',
    'ოთახი დაწოლამდე გაანიავე, თბილი შხაპი კი 1–2 საათით ადრე მიიღე — შემდგომი გაგრილება ჩაძინებას აადვილებს.',
    'Air the room before bed and take a warm shower 1–2 hours earlier — cooling down afterwards helps you fall asleep.'],
];

export const SLEEP_TIP_SEED = TIPS.map(([id, trigger, titleKa, titleEn, bodyKa, bodyEn], index) => ({
  id, trigger, titleKa, titleEn, bodyKa, bodyEn, status: 'LIVE', sortOrder: index * 10,
}));

export const SLEEP_CONFIG_DEFAULTS = {
  /** Minutes the sound timer starts with; 0 = all night. */
  defaultTimerMinutes: 45,
  timerOptions: [15, 30, 45, 60, 90, 0],
  /** Fade-out at the end of the timer. */
  fadeSeconds: 60,
  /** Sounds that can play together in the mixer. */
  maxLayers: 3,
  /** Factors offered in the morning check-in, in this order. */
  checkinFactors: SLEEP_FACTOR_IDS,
  breathing: true,
  defaultVolume: 0.7,
};

export function normalizeSleepConfig(data) {
  const d = data && typeof data === 'object' ? data : {};
  const pickInt = (v, lo, hi, fallback) => (Number.isInteger(v) && v >= lo && v <= hi ? v : fallback);
  const timerOptions = Array.isArray(d.timerOptions)
    ? [...new Set(d.timerOptions.filter((v) => Number.isInteger(v) && v >= 0 && v <= 600))].slice(0, 8)
    : SLEEP_CONFIG_DEFAULTS.timerOptions;
  const factors = Array.isArray(d.checkinFactors) ? d.checkinFactors.filter((f) => SLEEP_FACTOR_IDS.includes(f)) : SLEEP_CONFIG_DEFAULTS.checkinFactors;
  return {
    defaultTimerMinutes: pickInt(d.defaultTimerMinutes, 0, 600, SLEEP_CONFIG_DEFAULTS.defaultTimerMinutes),
    timerOptions: timerOptions.length ? timerOptions : SLEEP_CONFIG_DEFAULTS.timerOptions,
    fadeSeconds: pickInt(d.fadeSeconds, 0, 300, SLEEP_CONFIG_DEFAULTS.fadeSeconds),
    maxLayers: pickInt(d.maxLayers, 1, 4, SLEEP_CONFIG_DEFAULTS.maxLayers),
    checkinFactors: factors.length ? factors : SLEEP_CONFIG_DEFAULTS.checkinFactors,
    breathing: typeof d.breathing === 'boolean' ? d.breathing : SLEEP_CONFIG_DEFAULTS.breathing,
    defaultVolume: typeof d.defaultVolume === 'number' && d.defaultVolume >= 0.1 && d.defaultVolume <= 1 ? d.defaultVolume : SLEEP_CONFIG_DEFAULTS.defaultVolume,
  };
}
