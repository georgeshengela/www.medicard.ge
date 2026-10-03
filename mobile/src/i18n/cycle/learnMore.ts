/**
 * „გაიგე მეტი“ / "Learn more" for everything a woman logs (brief §8.3, §8.4, §9 wave 2 item 1 —
 * Clue's per-option Learn more). One entry per option id the logs use, plus one per group for the ⓘ
 * on group titles. Every entry: `what` (one plain sentence), `typical` (what is common in a cycle and
 * when — „ხშირია…“, „ზოგს…“, never a study claim), `whenDoctor` (concrete red flags, always ending
 * „— ესაუბრე ექიმს.“) and `sourceId` into `constants/medicalSources.ts`.
 *
 * Rules (guarded by `learnMore.test.ts`): no condition names as diagnoses, no doses, no byline. Sex and
 * sex-drive ids have NO entries — they are never explained here. The two intimate symptoms
 * (`vaginal_dryness`, `itching_vulva`) have neutral entries that the UI shows only inside the unlocked
 * private group. Nothing here is sent anywhere: the sheet reads static copy on the device.
 *
 * Imports stay relative so `node --test` can load this module.
 */
import type { MedicalSourceId } from '../../constants/medicalSources.ts';
import { SEXUAL_OPTIONS } from '../../constants/cycle.ts';
import { isEn, tx } from '../locale.js';

export type LearnMoreText = { readonly what: string; readonly typical: string; readonly whenDoctor: string };
export type LearnMoreEntry = { readonly ka: LearnMoreText; readonly en: LearnMoreText; readonly sourceId: MedicalSourceId };
export type LearnMoreKind = 'flow' | 'pain' | 'mood' | 'symptom' | 'mucus' | 'test' | 'lifestyle';
export type LearnMoreGroupId =
  | 'flow'
  | 'pain'
  | 'mood'
  | 'physical'
  | 'digestion'
  | 'skin'
  | 'energy'
  | 'fertility'
  | 'lifestyle';

export const DOCTOR_PHRASE_KA = '— ესაუბრე ექიმს.';
export const DOCTOR_PHRASE_EN = '— talk to a doctor.';

type Triple = readonly [what: string, typical: string, whenDoctor: string];

function entry(sourceId: MedicalSourceId, ka: Triple, en: Triple): LearnMoreEntry {
  return {
    sourceId,
    ka: { what: ka[0], typical: ka[1], whenDoctor: ka[2] },
    en: { what: en[0], typical: en[1], whenDoctor: en[2] },
  };
}

const SELF_HARM_KA = 'თუ საკუთარი თავის დაზიანებაზე ფიქრობ, ახლავე დარეკე 112-ზე ან უთხარი ახლობელს.';
const SELF_HARM_EN = 'If you think about harming yourself, call 112 now or tell someone close to you.';
const LOW_MOOD_KA = `${SELF_HARM_KA} თუ ეს განცდა ორ კვირაზე მეტხანს გრჩება ან სამუშაოს და ურთიერთობებს გიშლის ${DOCTOR_PHRASE_KA}`;
const LOW_MOOD_EN = `${SELF_HARM_EN} If the feeling stays for more than two weeks or gets in the way of work and relationships ${DOCTOR_PHRASE_EN}`;

/** One entry per group title (the ⓘ in the full log). */
export const LEARN_MORE_GROUPS: Readonly<Record<LearnMoreGroupId, LearnMoreEntry>> = {
  flow: entry(
    'periodsNhs',
    [
      'სისხლდენის რიგში აღნიშნავ, რამდენი სისხლი გქონდა დღის განმავლობაში — ლაქებიდან ძლიერამდე.',
      'მენსტრუაცია ხშირად 2–7 დღე გრძელდება და პირველ ერთ-ორ დღეს ყველაზე ძლიერია. ზოგს ციკლის შუაში ან მენსტრუაციამდე მცირე ლაქებიც აქვს.',
      `თუ სისხლდენა 7 დღეზე მეტხანს გრძელდება, საფენს ან ტამპონს ყოველ საათში ჟღენთავ, ან სისხლი მენსტრუაციებს შორის ხშირად ჩნდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'In the bleeding row you note how much you bled that day — from spotting to heavy.',
      'A period often lasts 2–7 days and is heaviest on the first day or two. Some people also see a little spotting mid-cycle or just before a period.',
      `If bleeding lasts more than 7 days, soaks a pad or tampon every hour, or often shows up between periods ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  pain: entry(
    'periodPain',
    [
      'აქ აღნიშნავ, სად გტკივა და რამდენად ძლიერად — ხელახალი შეხება ინტენსივობას ცვლის.',
      'მუცლის ქვედა ნაწილის სპაზმები ხშირია მენსტრუაციამდე და პირველ დღეებში; ზოგს წელსა და ფეხებშიც გადაეცემა. ხშირად 1–3 დღეში მსუბუქდება.',
      `თუ ტკივილი ჩვეულ საქმეებს გიშლის, წლიდან წლამდე ძლიერდება, მენსტრუაციის გარეშეც გაქვს ან უეცრად და ძალიან ძლიერად დაიწყო ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Here you note where it hurts and how strongly — tapping again changes the strength.',
      'Cramps low in the belly are common just before and in the first days of a period; for some they spread to the lower back and legs. They often ease within 1–3 days.',
      `If pain gets in the way of your usual day, gets worse year after year, comes outside your period or starts suddenly and very strongly ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  mood: entry(
    'premenstrualSymptoms',
    [
      'განწყობა — როგორ გრძნობდი თავს ემოციურად. შეგიძლია რამდენიმე აირჩიო.',
      'ხშირია, რომ განწყობა ციკლთან ერთად იცვლება: ზოგი მენსტრუაციამდე რამდენიმე დღით ადრე უფრო მგრძნობიარეა ან ადვილად ღიზიანდება, ციკლის პირველ ნახევარში კი მეტ ენერგიას გრძნობს.',
      LOW_MOOD_KA,
    ],
    [
      'Mood — how you felt emotionally. You can pick several.',
      'It is common for mood to shift with the cycle: some feel more sensitive or easily irritated in the days before a period and more energetic in the first half of the cycle.',
      LOW_MOOD_EN,
    ],
  ),
  physical: entry(
    'premenstrualSymptoms',
    [
      'სხეულის ნიშნები, რომლებიც დღეს შეამჩნიე: შეშუპება, ოფლიანობა, თავბრუსხვევა და სხვა.',
      'ბევრი მათგანი ციკლთან ერთად მოდის და მიდის — მაგალითად, მკერდის შეშუპება და წყლის შეკავება ხშირია მენსტრუაციამდე. რამდენიმე ციკლის აღრიცხვა გაჩვენებს, მეორდება თუ არა.',
      `თუ ნიშანი ახალია, ძლიერდება ან ციკლის მიუხედავად არ გადის, ან ცხელებას, გულის წასვლას ან სუნთქვის გაძნელებას ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Body signs you noticed today: swelling, sweating, dizziness and more.',
      'Many of them come and go with the cycle — tender, swollen breasts and water retention are common before a period, for example. Logging a few cycles shows whether a sign repeats.',
      `If a sign is new, getting stronger or stays regardless of the cycle, or comes with fever, fainting or trouble breathing ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  digestion: entry(
    'premenstrualSymptoms',
    [
      'მონელება — შებერილობა, გულისრევა, მადა და კუჭის მოქმედება.',
      'ხშირია, რომ მენსტრუაციამდე და პირველ დღეებში მუცელი შებერილია, კუჭის მოქმედება იცვლება ან ტკბილი უფრო გინდა.',
      `თუ ღებინება არ ჩერდება, განავალში სისხლს ხედავ, მუცელი ძლიერად გტკივა ან უმიზეზოდ იკლებ წონაში ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Digestion — bloating, nausea, appetite and bowel habits.',
      'Bloating, changes in bowel habits and sweet cravings are common before and in the first days of a period.',
      `If vomiting does not stop, you see blood in your stool, your belly hurts badly or you lose weight without trying ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  skin: entry(
    'skinAcne',
    [
      'კანი და თმა — გამონაყარი, სიმშრალე, ცხიმიანობა, ქავილი, თმის ცვენა.',
      'ზოგს მენსტრუაციამდე რამდენიმე დღით ადრე გამონაყარი უჩნდება ან კანი უფრო ცხიმიანი ხდება; ეს ხშირად ციკლიდან ციკლამდე მეორდება.',
      `თუ გამონაყარი ღრმა და მტკივნეულია, ნაწიბურებს ტოვებს, თმა კონებად გცვივა ან სახეზე და სხეულზე უჩვეულო თმიანობა გაჩნდა ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Skin and hair — breakouts, dryness, oiliness, itching, hair shedding.',
      'Some people break out or get oilier skin in the days before a period, and it often repeats cycle after cycle.',
      `If breakouts are deep and painful or leave scars, hair falls out in clumps, or new unusual hair growth appears on the face or body ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  energy: entry(
    'sleepAdults',
    [
      'ენერგია და ძილი — დაღლილობა, უძილობა ან ჩვეულზე მეტი ძილიანობა.',
      'ხშირია, რომ მენსტრუაციამდე და პირველ დღეებში დაღლილობა მატულობს და ძილი უარესდება. ზრდასრულს ღამით 7 საათი ან მეტი ძილი სჭირდება.',
      `თუ დაღლილობა კვირებით არ გადის, ძლიერ სისხლდენას თავბრუსხვევა და ქოშინი ერთვის, ან უძილობა დღისით გიშლის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Energy and sleep — tiredness, trouble sleeping or more sleepiness than usual.',
      'Tiredness often rises and sleep gets worse before and in the first days of a period. Adults need 7 or more hours of sleep a night.',
      `If tiredness lasts for weeks, heavy bleeding comes with dizziness and breathlessness, or poor sleep gets in the way of your days ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  fertility: entry(
    'menstrualCycle',
    [
      'ნაყოფიერების ნიშნები — ლორწო, ოვულაციის ტესტი, ბაზალური ტემპერატურა და ორსულობის ტესტი. ეს დაკვირვებაა, არა კონტრაცეფციის მეთოდი.',
      'ოვულაციამდე ლორწო ხშირად უფრო წყლიანი და გამჭვირვალე ხდება, ოვულაციის შემდეგ კი ტემპერატურა ოდნავ იწევს. ნიშნები ერთად უფრო მეტს გეუბნება, ვიდრე ცალ-ცალკე.',
      `თუ ორსულობას 12 თვე ცდილობ (35 წლიდან — 6 თვე) და არ გამოდის, ან ციკლი ძალიან არარეგულარულია ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Fertility signs — cervical mucus, ovulation test, basal temperature and pregnancy test. They are observations, not a contraception method.',
      'Before ovulation mucus often becomes wetter and clearer, and after ovulation temperature rises slightly. Together the signs say more than any one alone.',
      `If you have been trying to get pregnant for 12 months (6 months from age 35) without success, or your cycles are very irregular ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  lifestyle: entry(
    'cycleBasics',
    [
      'ცხოვრების წესი — ენერგია, ძილი, სტრესი, მოძრაობა, კოფეინი და ალკოჰოლი, თითო დონით.',
      'ზოგს სტრესი, ცუდი ძილი ან ძლიერი დატვირთვა ციკლს ცვლის და მენსტრუაცია შეიძლება გადაიწიოს. აღრიცხვა გეხმარება დაინახო, რა მოქმედებს შენზე.',
      `თუ მენსტრუაცია ზედიზედ 3 თვე არ მოსულა და ორსულობა გამორიცხულია, ან ძილი, სტრესი თუ ალკოჰოლი ყოველდღიურობას გიშლის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Lifestyle — energy, sleep, stress, movement, caffeine and alcohol, each as a level.',
      'For some, stress, poor sleep or very hard training change the cycle and a period can come late. Logging helps you see what affects you.',
      `If you have missed 3 periods in a row and pregnancy is ruled out, or sleep, stress or alcohol get in the way of daily life ${DOCTOR_PHRASE_EN}`,
    ],
  ),
};

const FLOW: Record<string, LearnMoreEntry> = {
  none: entry(
    'cycleBasics',
    [
      '„არა“ — დღეს სისხლდენა არ გქონია.',
      'მენსტრუაციებს შორის დღეების უმეტესობა ასეთია. „არა“-ს აღნიშვნა გეხმარება, რომ მენსტრუაციის დასასრული ზუსტად ჩანდეს.',
      `თუ მენსტრუაცია ზედიზედ 3 თვე არ მოსულა და ორსულობა გამორიცხულია ${DOCTOR_PHRASE_KA}`,
    ],
    [
      '„None“ — no bleeding today.',
      'Most days between periods look like this. Marking „none“ helps the end of a period show up accurately.',
      `If you have missed 3 periods in a row and pregnancy is ruled out ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  spotting: entry(
    'abnormalBleeding',
    [
      'ლაქები — რამდენიმე წვეთი სისხლი, რომელსაც საფენი თითქმის არ სჭირდება.',
      'ზოგს ლაქები აქვს მენსტრუაციამდე ან მის შემდეგ, ციკლის შუაში ან ჰორმონული კონტრაცეფციის პირველ თვეებში.',
      `თუ ლაქები მენსტრუაციებს შორის ხშირად მეორდება, სქესობრივი კავშირის შემდეგ ჩნდება ან მენოპაუზის შემდეგ გამოჩნდა ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Spotting — a few drops of blood that barely need a pad.',
      'Some people spot just before or after a period, mid-cycle, or in the first months of hormonal contraception.',
      `If spotting often comes between periods, shows up after sex or appears after menopause ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  light: entry(
    'periodsNhs',
    [
      'მსუბუქი სისხლდენა — საფენი ან ტამპონი ნელა ივსება.',
      'ხშირად მენსტრუაციის პირველი ან ბოლო დღეებია ასეთი.',
      `თუ მსუბუქი სისხლდენა მენსტრუაციის გარეთ ხშირად გაქვს ან 7 დღეზე მეტხანს გრძელდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Light flow — a pad or tampon fills slowly.',
      'The first or last days of a period are often like this.',
      `If light bleeding often comes outside your period or lasts more than 7 days ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  medium: entry(
    'periodsNhs',
    [
      'ზომიერი სისხლდენა — საფენს ან ტამპონს დღეში რამდენჯერმე იცვლი.',
      'მენსტრუაციის შუა დღეებისთვის ჩვეულებრივია; ციკლიდან ციკლამდე მცირე განსხვავებაც ხშირია.',
      `თუ სისხლდენა 7 დღეზე მეტხანს გრძელდება ან ციკლიდან ციკლამდე შესამჩნევად ძლიერდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Medium flow — you change a pad or tampon several times a day.',
      'Usual for the middle days of a period; some difference from one cycle to the next is common too.',
      `If bleeding lasts more than 7 days or gets noticeably heavier from cycle to cycle ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  heavy: entry(
    'heavyMenstrualBleeding',
    [
      'ძლიერი სისხლდენა — საფენი ან ტამპონი სწრაფად ივსება, შეიძლება კოლტებიც იყოს.',
      'ზოგს პირველ ერთ-ორ დღეს ძლიერი სისხლდენა აქვს, მერე კი მსუბუქდება.',
      `თუ რამდენიმე საათი ზედიზედ საფენს ან ტამპონს ყოველ საათში ჟღენთავ, მონეტაზე დიდი კოლტები გაქვს, სისხლდენა 7 დღეზე მეტხანს გრძელდება ან თავბრუ გეხვევა ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Heavy flow — a pad or tampon fills quickly, and there may be clots.',
      'Some people bleed heavily on the first day or two and then it eases.',
      `If you soak a pad or tampon every hour for several hours in a row, pass clots larger than a coin, bleed for more than 7 days or feel dizzy ${DOCTOR_PHRASE_EN}`,
    ],
  ),
};

const PAIN: Record<string, LearnMoreEntry> = {
  cramps: entry(
    'periodPain',
    [
      'სპაზმები — კრუნჩხვისებური ტკივილი მუცლის ქვედა ნაწილში.',
      'ძალიან ხშირია მენსტრუაციის დაწყებამდე ცოტა ხნით ადრე და პირველ 1–3 დღეს. სითბო და მსუბუქი მოძრაობა ზოგს ეხმარება.',
      `თუ სპაზმები ჩვეულ საქმეებს გიშლის, წლების განმავლობაში ძლიერდება ან ცხელება ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Cramps — a gripping pain low in the belly.',
      'Very common shortly before a period starts and in the first 1–3 days. Warmth and gentle movement help some people.',
      `If cramps get in the way of your usual day, get worse over the years or come with a fever ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  pelvic: entry(
    'pelvicPain',
    [
      'მენჯის ტკივილი — ტკივილი ჭიპის ქვემოთ, თეძოებს შორის.',
      'მენსტრუაციის დროს ხშირია. ზოგს ციკლის შუაშიც აქვს მოკლე, მსუბუქი ტკივილი.',
      `უეცარი, ძალიან ძლიერი ტკივილი ცხელებით ან გულის წასვლით — დარეკე 112-ზე. თუ ტკივილი 6 თვეზე მეტხანს გრძელდება, მენსტრუაციის გარეთაც გაქვს ან სქესობრივი კავშირისას გტკივა ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Pelvic pain — pain below the belly button, between the hips.',
      'Common during a period. Some people also have a short, mild pain mid-cycle.',
      `Sudden, very strong pain with fever or fainting — call 112. If pain lasts more than 6 months, comes outside your period or hurts during sex ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  lower_back: entry(
    'periodPain',
    [
      'წელის ტკივილი — ტკივილი ან სიმძიმე ზურგის ქვედა ნაწილში.',
      'ხშირია, რომ მენსტრუაციის სპაზმები წელშიც გადაეცემა, განსაკუთრებით პირველ დღეებში.',
      `თუ ტკივილი ციკლის გარეშეც გრძელდება, ფეხში ჩადის, დაბუჟებას ან ცხელებას ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Lower back pain — ache or heaviness low in the back.',
      'Period cramps often spread to the lower back, especially in the first days.',
      `If the pain goes on outside the cycle, runs down a leg, or comes with numbness or fever ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  headache: entry(
    'headache',
    [
      'თავის ტკივილი — ნებისმიერი თავის ტკივილი დღის განმავლობაში.',
      'ზოგს თავი მენსტრუაციამდე ან მის დასაწყისში სტკივა და ეს ციკლიდან ციკლამდე მეორდება.',
      `უეცარი, უძლიერესი თავის ტკივილი, ან ტკივილი სისუსტით, მხედველობის ცვლილებით ან მეტყველების გაძნელებით — დარეკე 112-ზე. თუ თავის ტკივილი ხშირდება ან ჩვეულს არ ჰგავს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Headache — any headache during the day.',
      'Some people get headaches just before or at the start of a period, and they repeat cycle after cycle.',
      `A sudden, worst-ever headache, or one with weakness, vision changes or trouble speaking — call 112. If headaches get more frequent or feel unlike your usual ones ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  breast: entry(
    'premenstrualSymptoms',
    [
      'მკერდის ტკივილი — მგრძნობელობა, სიმძიმე ან ტკივილი მკერდში.',
      'ხშირია მენსტრუაციამდე რამდენიმე დღით ადრე, ხშირად ორივე მხარეს; მენსტრუაციის დაწყებისას მსუბუქდება.',
      `თუ ტკივილი ერთ წერტილშია და ციკლთან ერთად არ გადის, ან კვანძს, კანის ცვლილებას ან ძუძუდან გამონაჟონს ამჩნევ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Breast pain — tenderness, heaviness or pain in the breasts.',
      'Common in the days before a period, often on both sides; it eases once the period starts.',
      `If the pain sits in one spot and does not pass with the cycle, or you notice a lump, skin changes or fluid from a nipple ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  ovulation_side: entry(
    'pelvicPain',
    [
      'ცალმხრივი ტკივილი — ტკივილი მუცლის ქვედა ნაწილის ერთ მხარეს.',
      'ზოგს ციკლის შუაში, სავარაუდო ოვულაციის დღეებში, ერთ მხარეს მოკლე ტკივილი აქვს — რამდენიმე წუთიდან ერთ-ორ დღემდე.',
      `ძალიან ძლიერი ცალმხრივი ტკივილი ცხელებით, ღებინებით ან გულის წასვლით, ან თუ შეიძლება ორსულად იყო — დარეკე 112-ზე. თუ ხშირად მეორდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'One-sided pain — pain on one side of the lower belly.',
      'Some people feel a short, one-sided pain mid-cycle, around the estimated ovulation days — from a few minutes to a day or two.',
      `Very strong one-sided pain with fever, vomiting or fainting, or if you could be pregnant — call 112. If it keeps coming back ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  other: entry(
    'healthTopics',
    [
      'სხვა ტკივილი — ტკივილი, რომელიც ჩამოთვლილ ადგილებში არ ჯდება.',
      'ციკლთან ერთად ზოგს სახსრები, ფეხები ან მთელი სხეული სტკივა. დღიურში ჩაწერე, სად იყო — ექიმთან საუბრისას გამოგადგება.',
      `თუ ტკივილი ძლიერია, ახალია ან არ გადის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Other pain — pain that does not fit the listed places.',
      'Some people feel aches in the joints, legs or whole body with the cycle. Note in the journal where it was — it helps when you talk to a doctor.',
      `If the pain is strong, new or does not go away ${DOCTOR_PHRASE_EN}`,
    ],
  ),
};

const MOOD: Record<string, LearnMoreEntry> = {
  energetic: entry(
    'premenstrualSymptoms',
    [
      'ენერგიული — დღე, როცა მხნედ და აქტიურად გრძნობ თავს.',
      'ზოგს ციკლის პირველ ნახევარში, მენსტრუაციის შემდეგ, მეტი ენერგია აქვს.',
      `თუ რამდენიმე დღე თითქმის არ გძინავს და მაინც ზედმეტად ენერგიული ხარ, ფიქრები გირბის ან ჩვეულზე სარისკო გადაწყვეტილებებს იღებ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Energetic — a day you feel lively and active.',
      'Some people have more energy in the first half of the cycle, after a period.',
      `If for several days you barely sleep yet feel overly energetic, your thoughts race or you take unusual risks ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  calm: entry(
    'premenstrualSymptoms',
    [
      'მშვიდი — დაბალანსებული, წყნარი დღე.',
      'ბევრს ციკლის დიდი ნაწილი ასეთი აქვს; მშვიდი დღეების აღნიშვნა გეხმარება დაინახო, როდის იცვლება განწყობა.',
      `თუ სიმშვიდე გულგრილობაში გადადის — ორ კვირაზე მეტხანს არაფერი გიხარია და არაფერი გაინტერესებს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Calm — a balanced, quiet day.',
      'Many people feel like this for much of the cycle; marking calm days helps you see when mood shifts.',
      `If calm turns into numbness — nothing brings joy or interest for more than two weeks ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  happy: entry(
    'premenstrualSymptoms',
    [
      'ბედნიერი — კარგი, ხალისიანი დღე.',
      'ზოგს ციკლის პირველ ნახევარში განწყობა უფრო ხალისიანია.',
      `თუ სიხარული უჩვეულოდ ძლიერია, ძილი თითქმის არ გჭირდება და ფიქრები გირბის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Happy — a good, cheerful day.',
      'Some people feel more cheerful in the first half of the cycle.',
      `If the high feels unusually strong, you barely need sleep and your thoughts race ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  confident: entry(
    'premenstrualSymptoms',
    [
      'თავდაჯერებული — დღე, როცა საკუთარ თავში დარწმუნებული ხარ.',
      'ზოგი ციკლის შუა დღეებში, სავარაუდო ოვულაციის გარშემო, უფრო თავდაჯერებულად გრძნობს თავს.',
      `თუ თავდაჯერება უეცრად ძალიან ძლიერდება, ძილი აღარ გჭირდება და ჩვეულზე სარისკო გადაწყვეტილებებს იღებ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Confident — a day you feel sure of yourself.',
      'Some people feel more confident in the middle of the cycle, around the estimated ovulation days.',
      `If confidence suddenly becomes very intense, you stop needing sleep and take unusual risks ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  sensitive: entry(
    'premenstrualSymptoms',
    [
      'მგრძნობიარე — წვრილმანები ჩვეულზე მეტად გეხება.',
      'ხშირია მენსტრუაციამდე რამდენიმე დღით ადრე და ხშირად მენსტრუაციის დაწყებისას გადის.',
      LOW_MOOD_KA,
    ],
    [
      'Sensitive — small things touch you more than usual.',
      'Common in the days before a period, and it often passes once the period starts.',
      LOW_MOOD_EN,
    ],
  ),
  anxious: entry(
    'stress',
    [
      'შფოთვა — მოუსვენრობა, ღელვა, დაძაბულობა.',
      'ზოგს შფოთვა მენსტრუაციამდე უმძაფრდება; სტრესი, ცუდი ძილი და ბევრი კოფეინი მას კიდევ ზრდის.',
      `თუ შფოთვა ორ კვირაზე მეტხანს გრჩება, ძილს გიშლის, გულის აჩქარებით ან ჰაერის უკმარისობის შეტევებით მოდის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Anxious — restless, worried, on edge.',
      'For some, anxiety gets stronger before a period; stress, poor sleep and a lot of caffeine add to it.',
      `If anxiety stays for more than two weeks, keeps you from sleeping, or comes in waves with a racing heart or shortness of breath ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  irritable: entry(
    'premenstrualSymptoms',
    [
      'გაღიზიანება — მოთმინება ჩვეულზე ადრე გელევა.',
      'მენსტრუაციამდე რამდენიმე დღით ადრე ერთ-ერთი ყველაზე ხშირი ცვლილებაა და მენსტრუაციის დაწყებისას ხშირად მსუბუქდება.',
      `თუ გაღიზიანება ყოველ ციკლზე ურთიერთობებს ან სამუშაოს გიშლის, ან ციკლის გარეთაც არ გადის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Irritable — patience runs out sooner than usual.',
      'One of the most common changes in the days before a period, and it often eases once the period starts.',
      `If irritability gets in the way of relationships or work every cycle, or stays outside the cycle too ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  angry: entry(
    'premenstrualSymptoms',
    [
      'გაბრაზებული — ბრაზი, რომელიც ადვილად ამოდის.',
      'ზოგს მენსტრუაციამდე ბრაზი უფრო სწრაფად ერევა; ციკლის აღრიცხვა გაჩვენებს, მეორდება თუ არა.',
      `თუ ბრაზი იმდენად ძლიერია, რომ გეშინია, საკუთარ თავს ან სხვას არ ავნო, ან ყოველ ციკლზე ურთიერთობებს გინგრევს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Angry — anger that flares up easily.',
      'Some people anger more quickly before a period; logging shows whether it repeats.',
      `If anger is strong enough that you fear hurting yourself or someone else, or it damages relationships every cycle ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  sad: entry(
    'premenstrualSymptoms',
    [
      'სევდიანი — დამძიმებული, დაღონებული განწყობა.',
      'ზოგი მენსტრუაციამდე რამდენიმე დღე სევდიანადაა და მენსტრუაციის დაწყებისას განწყობა უმსუბუქდება.',
      LOW_MOOD_KA,
    ],
    [
      'Sad — a heavy, low mood.',
      'Some people feel sad for a few days before a period, and it lifts once the period starts.',
      LOW_MOOD_EN,
    ],
  ),
  tearful: entry(
    'premenstrualSymptoms',
    [
      'ცრემლიანი — ტირილი ადვილად მოდის.',
      'ხშირია მენსტრუაციამდე რამდენიმე დღით ადრე, ხშირად სევდასა და მგრძნობიარობასთან ერთად.',
      LOW_MOOD_KA,
    ],
    [
      'Tearful — tears come easily.',
      'Common in the days before a period, often together with sadness and sensitivity.',
      LOW_MOOD_EN,
    ],
  ),
  mood_swings: entry(
    'premenstrualSymptoms',
    [
      'განწყობის ცვლა — განწყობა დღის განმავლობაში სწრაფად იცვლება.',
      'მენსტრუაციამდელ დღეებში ხშირია და ხშირად მენსტრუაციის დაწყებისას წყნარდება.',
      `თუ ცვლა იმდენად მკვეთრია, რომ ყოველ ციკლზე სამუშაოს და ურთიერთობებს გიშლის, ან ციკლის გარეთაც გრძელდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Mood swings — mood changes quickly during the day.',
      'Common in the days before a period, and they often settle once it starts.',
      `If the swings are sharp enough to disrupt work and relationships every cycle, or go on outside the cycle ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  focused: entry(
    'premenstrualSymptoms',
    [
      'კონცენტრირებული — ყურადღება ადვილად გიჭირავს.',
      'ზოგს ციკლის პირველ ნახევარში კონცენტრაცია უფრო მარტივად გამოსდის.',
      `თუ პირიქით, ყურადღება კვირების განმავლობაში გეფანტება და სამუშაოს გიშლის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Focused — attention comes easily.',
      'Some people find it easier to concentrate in the first half of the cycle.',
      `If instead your focus keeps slipping for weeks and gets in the way of work ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  unfocused: entry(
    'premenstrualSymptoms',
    [
      'გაფანტული — ყურადღების შეკრება გიჭირს.',
      'ზოგს მენსტრუაციამდე და პირველ დღეებში კონცენტრაცია უჭირს, განსაკუთრებით ცუდი ძილის შემდეგ.',
      `თუ ყურადღება კვირების განმავლობაში გეფანტება, მეხსიერება გიუარესდება ან სამუშაოს გიშლის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Distracted — hard to concentrate.',
      'Some people find it harder to focus before and in the first days of a period, especially after poor sleep.',
      `If your focus slips for weeks, your memory gets worse or it gets in the way of work ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  tired_mood: entry(
    'premenstrualSymptoms',
    [
      'დაღლილი — ემოციურად გამოფიტული ხარ.',
      'ხშირია მენსტრუაციამდე და პირველ დღეებში, განსაკუთრებით ცუდი ძილის ან სტრესის შემდეგ.',
      LOW_MOOD_KA,
    ],
    [
      'Tired — emotionally drained.',
      'Common before and in the first days of a period, especially after poor sleep or stress.',
      LOW_MOOD_EN,
    ],
  ),
  apathetic: entry(
    'premenstrualSymptoms',
    [
      'აპათიური — არაფრის სურვილი, გულგრილობა.',
      'ზოგს მენსტრუაციამდე რამდენიმე დღე ინტერესი უქრება და მერე უბრუნდება.',
      LOW_MOOD_KA,
    ],
    [
      'Apathetic — no drive, nothing feels interesting.',
      'Some people lose interest for a few days before a period and it comes back afterwards.',
      LOW_MOOD_EN,
    ],
  ),
  stressed: entry(
    'stress',
    [
      'სტრესი — დაძაბულობა, ზეწოლის განცდა.',
      'ხანგრძლივმა სტრესმა ზოგს ციკლი შეიძლება შეცვალოს და მენსტრუაცია გადააწიოს.',
      `თუ სტრესი კვირების განმავლობაში ძილს, ჭამას ან ყოველდღიურ საქმეებს გიშლის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Stressed — tension, a sense of pressure.',
      'Long-lasting stress can change the cycle for some and make a period come late.',
      `If stress has been disrupting your sleep, eating or daily tasks for weeks ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  romantic: entry(
    'premenstrualSymptoms',
    [
      'რომანტიკული — სითბოსა და სიახლოვის განწყობა.',
      'ზოგს ციკლის შუაში, სავარაუდო ოვულაციის დღეებში, ასეთი განწყობა უფრო ხშირად აქვს.',
      `თუ განწყობა ხშირად და მკვეთრად ირყევა ერთი უკიდურესობიდან მეორემდე ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Romantic — a mood for warmth and closeness.',
      'Some people feel this way more often mid-cycle, around the estimated ovulation days.',
      `If your mood often swings sharply from one extreme to the other ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  lonely: entry(
    'premenstrualSymptoms',
    [
      'მარტოობა — განცდა, რომ მარტო ხარ ან ვერავინ გიგებს.',
      'ზოგს მენსტრუაციამდე ეს განცდა უმძაფრდება; ახლობელთან საუბარი ან მოკლე გასეირნება ხშირად ეხმარება.',
      LOW_MOOD_KA,
    ],
    [
      'Lonely — feeling alone or not understood.',
      'For some this feeling grows before a period; talking to someone close or a short walk often helps.',
      LOW_MOOD_EN,
    ],
  ),
};

const SYMPTOM: Record<string, LearnMoreEntry> = {
  // სხეული (physical)
  migraine: entry(
    'headache',
    [
      'მიგრენი — ძლიერი, ხშირად ცალმხრივი, მფეთქავი თავის ტკივილი, ზოგჯერ გულისრევით ან სინათლისადმი მგრძნობელობით.',
      'ზოგს მიგრენი მენსტრუაციის დაწყებამდე ორი დღით ადრედან პირველ დღეებამდე უჩნდება და ციკლიდან ციკლამდე მეორდება.',
      `უეცარი, უძლიერესი თავის ტკივილი, ან ტკივილი სისუსტით, მხედველობის ცვლილებით ან მეტყველების გაძნელებით — დარეკე 112-ზე. თუ მიგრენი ხშირდება, ან მის წინ მხედველობის ციმციმი გაქვს და ჰორმონულ კონტრაცეფციას იღებ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Migraine — a strong, often one-sided, throbbing headache, sometimes with nausea or light sensitivity.',
      'Some people get migraines from about two days before a period into its first days, and they repeat cycle after cycle.',
      `A sudden, worst-ever headache, or one with weakness, vision changes or trouble speaking — call 112. If migraines get more frequent, or you see flashing lights before them and use hormonal contraception ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  breast_swelling: entry(
    'premenstrualSymptoms',
    [
      'მკერდის შეშუპება — მკერდი უფრო სავსე და მძიმეა.',
      'ხშირია მენსტრუაციამდე რამდენიმე დღით ადრე და მენსტრუაციის დაწყებისას გადის.',
      `თუ ერთ მხარეს კვანძს, კანის ჩაზნექას ან სიწითლეს, ან ძუძუდან გამონაჟონს ამჩნევ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Breast swelling — breasts feel fuller and heavier.',
      'Common in the days before a period, and it passes once the period starts.',
      `If you notice a lump, dimpled or red skin on one side, or fluid from a nipple ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  dizziness: entry(
    'healthTopics',
    [
      'თავბრუსხვევა — მსუბუქი სიმძიმე თავში, ბრუნვის ან გულის წასვლის განცდა.',
      'ზოგს თავბრუ ეხვევა ძლიერი სისხლდენის დღეებში, უჭმელობისას ან როცა საკმარისად არ სვამს წყალს.',
      `გულის წასვლა, მკერდის ტკივილი ან სახის და ხელის სისუსტე — დარეკე 112-ზე. თუ თავბრუსხვევა ხშირად მეორდება ან ძლიერ სისხლდენას ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Dizziness — light-headedness, a spinning or about-to-faint feeling.',
      'Some people feel dizzy on heavy bleeding days, when they skip meals or do not drink enough.',
      `Fainting, chest pain, or weakness in the face or an arm — call 112. If dizziness keeps coming back or comes with heavy bleeding ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  hot_flashes: entry(
    'menopauseSymptoms',
    [
      'ცხელი ტალღები — უეცარი სიცხის შეგრძნება სახესა და ზედა ტანში, ხშირად სიწითლით და ოფლით.',
      'ყველაზე ხშირია მენოპაუზის წინა და შემდგომ წლებში; ზოგს მენსტრუაციის გარშემოც აქვს.',
      `თუ ტალღები ძილს და ყოველდღიურობას გიშლის, ან ცხელებას და წონის კლებას ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Hot flashes — a sudden feeling of heat in the face and upper body, often with flushing and sweat.',
      'Most common in the years around menopause; some people also get them around a period.',
      `If hot flashes disrupt your sleep and daily life, or come with fever or weight loss ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  night_sweats: entry(
    'menopauseSymptoms',
    [
      'ღამის ოფლიანობა — ღამით იმდენად გეოფლება, რომ გეღვიძება.',
      'ხშირია მენოპაუზის წინა წლებში და ზოგს მენსტრუაციამდეც აქვს.',
      `თუ ღამის ოფლიანობას ცხელება, ხველა ან უმიზეზო წონის კლება ახლავს, ან კვირებით არ გადის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Night sweats — sweating at night enough to wake you.',
      'Common in the years before menopause, and some people get them before a period.',
      `If night sweats come with fever, a cough or unexplained weight loss, or go on for weeks ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  chills: entry(
    'healthTopics',
    [
      'შეცივება — სიცივის შეგრძნება ან კანკალი თბილ ოთახშიც.',
      'ზოგს მენსტრუაციის დაწყებისას მსუბუქი შეცივება აქვს; ხშირად გაციებასაც ახლავს.',
      `თუ შეცივებას 38 °C-ზე მაღალი ცხელება, ძლიერი ტკივილი ან უჩვეულო სუნიანი გამონადენი ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Chills — feeling cold or shivering even in a warm room.',
      'Some people feel a little chilly when a period starts; chills often come with a cold too.',
      `If chills come with a fever above 38 °C, strong pain or unusual-smelling discharge ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  sweating: entry(
    'healthTopics',
    [
      'ოფლიანობა — ჩვეულზე მეტი ოფლი დღის განმავლობაში.',
      'ზოგი მენსტრუაციამდე და მენოპაუზის წინა წლებში უფრო მეტად ოფლიანობს.',
      `თუ ოფლიანობას გულის აჩქარება, წონის კლება ან ცხელება ახლავს, ან უმიზეზოდ დაიწყო ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Sweating — more sweat than usual during the day.',
      'Some people sweat more before a period and in the years before menopause.',
      `If sweating comes with a racing heart, weight loss or fever, or starts for no clear reason ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  joint_pain: entry(
    'healthTopics',
    [
      'სახსრების ტკივილი — ტკივილი ან სიხისტე სახსრებში.',
      'ზოგს სახსრები მენსტრუაციამდე ან მის დროს უფრო სტკივა.',
      `თუ სახსარი შეშუპებული, წითელი ან ცხელია, ტკივილი კვირებით არ გადის ან დილის სიხისტე ერთ საათზე მეტხანს გრძელდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Joint pain — ache or stiffness in the joints.',
      'Some people feel their joints more before or during a period.',
      `If a joint is swollen, red or warm, the pain lasts for weeks, or morning stiffness lasts more than an hour ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  muscle_pain: entry(
    'healthTopics',
    [
      'კუნთების ტკივილი — ტკივილი ან დაჭიმულობა კუნთებში.',
      'ხშირია დატვირთვის შემდეგ; ზოგს მენსტრუაციის დროს მთელი სხეული უფრო სტკივა.',
      `თუ ტკივილს ცხელება, ძლიერი სისუსტე ან მუქი შარდი ახლავს, ან უმიზეზოდ დაიწყო და არ გადის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Muscle pain — ache or tightness in the muscles.',
      'Common after exercise; some people ache all over during a period.',
      `If the pain comes with fever, marked weakness or dark urine, or starts for no reason and does not pass ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  leg_cramps: entry(
    'periodPain',
    [
      'ფეხის სპაზმები — უეცარი, მტკივნეული კუნთის შეკუმშვა ფეხში, ხშირად ღამით.',
      'ზოგს მენსტრუაციის ტკივილი ფეხებშიც გადაეცემა; ღამის სპაზმები ორსულობისას და დატვირთვის შემდეგაც ხშირია.',
      `თუ ერთი ფეხი შეშუპებული, წითელი, ცხელი ან მტკივნეულია — განსაკუთრებით ორსულობისას ან ხანგრძლივი მგზავრობის შემდეგ — ან სპაზმები ყოველ ღამე გეღვიძება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Leg cramps — a sudden, painful tightening of a leg muscle, often at night.',
      'For some, period pain spreads to the legs; night cramps are also common in pregnancy and after exercise.',
      `If one leg is swollen, red, warm or painful — especially in pregnancy or after a long journey — or cramps wake you every night ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  swelling: entry(
    'premenstrualSymptoms',
    [
      'შეშუპება — ხელები, ფეხები ან სახე ჩვეულზე სავსეა.',
      'მენსტრუაციამდე მსუბუქი შეშუპება ხშირია და მენსტრუაციის დაწყებისას ხშირად გადის.',
      `თუ შეშუპება უეცარია, ერთ ფეხზეა, სუნთქვის გაძნელებას ერთვის, ან ორსულობისას სახე და ხელები სწრაფად გისივდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Swelling — hands, feet or face feel puffier than usual.',
      'Mild swelling before a period is common and often goes once the period starts.',
      `If swelling is sudden, in one leg only, comes with trouble breathing, or your face and hands swell quickly in pregnancy ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  water_retention: entry(
    'premenstrualSymptoms',
    [
      'წყლის შეკავება — სიმძიმის განცდა და წონის მცირე მატება რამდენიმე დღეში.',
      'მენსტრუაციამდე ხშირია და ზოგს სასწორზე 1–2 კილოგრამიც ემატება, რომელიც მენსტრუაციის შემდეგ ქრება.',
      `თუ წონა სწრაფად იმატებს და არ იკლებს, ან შეშუპებას ქოშინი ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Water retention — feeling heavy, with a little weight gain over a few days.',
      'Common before a period; for some the scale shows 1–2 kg that goes after the period.',
      `If weight goes up quickly and does not come down, or swelling comes with breathlessness ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  sensitive_smell: entry(
    'healthTopics',
    [
      'სუნის მგრძნობელობა — სუნები ჩვეულზე მძაფრად გეჩვენება ან გაღიზიანებს.',
      'ზოგს ციკლის გარკვეულ დღეებში ან ორსულობის ადრეულ კვირებში სუნი უფრო მძაფრად ესმის.',
      `თუ სუნის შეგრძნება მკვეთრად შეიცვალა ან გაქრა და თვეობით არ ბრუნდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Sensitive to smells — smells seem stronger or bother you more than usual.',
      'Some people notice smells more on certain cycle days or in early pregnancy.',
      `If your sense of smell changes sharply or disappears and does not come back for months ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  tinnitus: entry(
    'healthTopics',
    [
      'ყურებში ხმაური — წკრიალი, შიშინი ან ზუზუნი, რომელიც გარშემო არ ისმის.',
      'ხანმოკლე ხმაური ხმამაღალი ადგილის შემდეგ ხშირია; ზოგი მას სტრესის ან ცუდი ძილის დღეებში უფრო ამჩნევს.',
      `თუ ხმაური ერთ ყურშია, მაჯისცემის რიტმით ფეთქავს, სმენის დაქვეითებას ან თავბრუსხვევას ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Ringing in ears — ringing, hissing or buzzing that is not around you.',
      'A short ringing after a loud place is common; some notice it more on stressful or poorly slept days.',
      `If the noise is in one ear, pulses with your heartbeat, or comes with hearing loss or dizziness ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  palpitations: entry(
    'healthTopics',
    [
      'გულის ფრიალი — გულის აჩქარების, გამოტოვების ან ძლიერი ცემის შეგრძნება.',
      'ზოგი მას კოფეინის, სტრესის, ცუდი ძილის შემდეგ ან მენსტრუაციამდე ამჩნევს და რამდენიმე წამში გადის.',
      `გულის ფრიალი მკერდის ტკივილით, გულის წასვლით ან ძლიერი ქოშინით — დარეკე 112-ზე. თუ ხშირად მეორდება ან დიდხანს გრძელდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Palpitations — a racing, skipping or pounding heartbeat you can feel.',
      'Some notice them after caffeine, stress, poor sleep or before a period, and they pass within seconds.',
      `Palpitations with chest pain, fainting or severe breathlessness — call 112. If they happen often or last long ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  short_breath: entry(
    'healthTopics',
    [
      'სუნთქვის სიმძიმე — ჰაერის უკმარისობის ან ღრმად ჩასუნთქვის გაძნელების განცდა.',
      'მსუბუქი სიმძიმე შეიძლება შფოთვის, დატვირთვის ან ძლიერი სისხლდენის დღეებში იყოს.',
      `თუ სუნთქვა უეცრად გაგიძნელდა, მკერდში ტკივილი გაქვს ან ტუჩები გაგილურჯდა — დარეკე 112-ზე. თუ ხშირად მეორდება ან მცირე დატვირთვაზეც გემართება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Shortness of breath — feeling you cannot get enough air or breathe deeply.',
      'Mild breathlessness can come with anxiety, exercise or heavy bleeding days.',
      `If breathing suddenly gets hard, you have chest pain or your lips turn blue — call 112. If it keeps coming back or happens with little effort ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  frequent_urination: entry(
    'healthTopics',
    [
      'ხშირი შარდვა — ტუალეტში ჩვეულზე ხშირად გიწევს გასვლა.',
      'ზოგს მენსტრუაციის გარშემო ან ორსულობის ადრეულ კვირებში უფრო ხშირად უწევს; ბევრი სითხე და კოფეინიც ზრდის.',
      `თუ შარდვას წვა, ტკივილი, სისხლი, ცხელება ან წელის ტკივილი ახლავს, ან ძლიერი წყურვილი გაქვს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Frequent urination — needing the toilet more often than usual.',
      'Some people go more often around a period or in early pregnancy; plenty of fluids and caffeine add to it.',
      `If peeing comes with burning, pain, blood, fever or back pain, or you are very thirsty ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  uti_feel: entry(
    'healthTopics',
    [
      'შარდის დისკომფორტი — წვა, ჭრა ან უსიამოვნო შეგრძნება შარდვისას.',
      'ზოგჯერ მსუბუქი დისკომფორტი სითხის ნაკლებობის ან გაღიზიანების გამოა და ერთ დღეში გადის.',
      `თუ დისკომფორტი ერთ დღეზე მეტხანს გრძელდება, შარდში სისხლია, ან ცხელება, შეცივება ან წელის ტკივილი გაქვს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Urinary discomfort — burning, stinging or an uncomfortable feeling when you pee.',
      'Sometimes mild discomfort comes from not drinking enough or irritation and passes within a day.',
      `If it lasts more than a day, there is blood in your urine, or you have fever, chills or back pain ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  discharge: entry(
    'vaginalDischarge',
    [
      'გამონადენი — საშოს სითხე, რომელსაც საცვალზე ამჩნევ.',
      'გამონადენი ნორმაა და ციკლთან ერთად იცვლება: ზოგჯერ სქელი და თეთრია, ოვულაციის გარშემო კი უფრო გამჭვირვალე და სველი.',
      `თუ ფერი შეიცვალა (მწვანე, ყვითელი, ნაცრისფერი), უსიამოვნო სუნი აქვს, ან ქავილი, წვა თუ მუცლის ტკივილი ახლავს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Discharge — vaginal fluid you notice on your underwear.',
      'Discharge is normal and changes with the cycle: sometimes thick and white, clearer and wetter around ovulation.',
      `If the colour changes (green, yellow, grey), it smells unpleasant, or comes with itching, burning or belly pain ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  fever: entry(
    'healthTopics',
    [
      'ცხელება — სხეულის ტემპერატურა 38 °C ან მეტი.',
      'ცხელება ციკლის ნიშანი არ არის — ხშირად გაციებას ან სხვა ავადმყოფობას ახლავს. ბაზალური ტემპერატურის მცირე მატება ცხელებად არ ითვლება.',
      `თუ ცხელება 3 დღეზე მეტხანს გრძელდება, 39.5 °C-ს აჭარბებს, ან მუცლის ძლიერ ტკივილს, უჩვეულო გამონადენს ან ტამპონის გამოყენებისას გამონაყარს ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Fever — a body temperature of 38 °C or higher.',
      'Fever is not a cycle sign — it often comes with a cold or another illness. The small rise in basal temperature is not a fever.',
      `If fever lasts more than 3 days, goes above 39.5 °C, or comes with strong belly pain, unusual discharge or a rash while using tampons ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  cold_symptoms: entry(
    'healthTopics',
    [
      'გაციების სიმპტომები — ცხვირის გაჭედვა, ყელის ტკივილი, ხველა.',
      'ზოგი ამჩნევს, რომ მენსტრუაციამდე გაციების მსგავსი სისუსტე უჩნდება; ჩვეულებრივი გაციება ერთ კვირაში გადის.',
      `თუ სუნთქვა გაგიძნელდა, მაღალი ცხელება 3 დღეზე მეტხანს გაქვს, ან სიმპტომები 10 დღეში არ უმჯობესდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Cold symptoms — stuffy nose, sore throat, cough.',
      'Some notice cold-like tiredness before a period; an ordinary cold passes within about a week.',
      `If breathing gets hard, a high fever lasts more than 3 days, or symptoms are not better after 10 days ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  // მონელება (digestion)
  bloating: entry(
    'premenstrualSymptoms',
    [
      'შებერილობა — მუცელი სავსე, დაჭიმული ან გაბერილია.',
      'ერთ-ერთი ყველაზე ხშირი ნიშანია მენსტრუაციამდე და პირველ დღეებში; მარილიანი საკვები მას ზრდის.',
      `თუ შებერილობა თითქმის ყოველდღე 3 კვირაზე მეტხანს გრძელდება, ან მადის დაკარგვას, წონის კლებას ან სისხლდენას ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Bloating — the belly feels full, tight or swollen.',
      'One of the most common signs before and in the first days of a period; salty food adds to it.',
      `If bloating happens most days for more than 3 weeks, or comes with loss of appetite, weight loss or bleeding ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  nausea: entry(
    'periodPain',
    [
      'გულისრევა — ღებინების სურვილი ან კუჭის უსიამოვნო შეგრძნება.',
      'ზოგს მენსტრუაციის პირველ დღეებში სპაზმებთან ერთად აქვს; ორსულობის ადრეულ კვირებშიც ხშირია.',
      `თუ სითხეს ვერ იკავებ, გულისრევა დღეებით არ გადის, ან ძლიერ მუცლის ტკივილს თუ ცხელებას ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Nausea — feeling like you might vomit, an unsettled stomach.',
      'Some people have it with cramps in the first days of a period; it is common in early pregnancy too.',
      `If you cannot keep fluids down, nausea lasts for days, or it comes with strong belly pain or fever ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  vomiting: entry(
    'periodPain',
    [
      'ღებინება — დღეს გული აგერია და ღებინება გქონდა.',
      'ზოგს ძლიერი მენსტრუალური ტკივილის დროს ერთხელ ან ორჯერ აქვს.',
      `თუ ღებინება 24 საათზე მეტხანს გრძელდება, სითხეს ვერ იკავებ, ღებინებაში სისხლია, ან ძლიერი ტკივილი გაქვს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Vomiting — you were sick today.',
      'Some people vomit once or twice with strong period pain.',
      `If vomiting lasts more than 24 hours, you cannot keep fluids down, there is blood in it, or you are in strong pain ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  heartburn: entry(
    'digestiveHealth',
    [
      'გულძმარვა — წვის შეგრძნება მკერდის ძვლის უკან, ხშირად ჭამის შემდეგ.',
      'ხშირია ცხიმიანი ან ცხარე საკვების შემდეგ და ორსულობისას; ზოგს მენსტრუაციამდე უმძაფრდება.',
      `მკერდის ტკივილი, რომელიც ხელში, ყბაში ან ზურგში გადადის, ან ქოშინს ერთვის — დარეკე 112-ზე. თუ გულძმარვა კვირაში რამდენჯერმე გაქვს ან ყლაპვა გიჭირს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Heartburn — a burning feeling behind the breastbone, often after eating.',
      'Common after fatty or spicy food and in pregnancy; some get more of it before a period.',
      `Chest pain that spreads to the arm, jaw or back, or comes with breathlessness — call 112. If heartburn happens several times a week or swallowing is hard ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  appetite_up: entry(
    'premenstrualSymptoms',
    [
      'მადის მატება — ჩვეულზე მეტი ჭამა გინდა.',
      'ხშირია ციკლის მეორე ნახევარში, მენსტრუაციამდე; ზოგს ამ დღეებში მეტი ენერგია სჭირდება.',
      `თუ ჭამაზე კონტროლს კარგავ, ჭამის შემდეგ დანაშაულის განცდა გტანჯავს, ან მუდმივ შიმშილს ძლიერი წყურვილი და წონის კლება ახლავს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'More appetite — you want to eat more than usual.',
      'Common in the second half of the cycle, before a period; some need a bit more energy then.',
      `If you feel out of control around food or guilty after eating, or constant hunger comes with strong thirst and weight loss ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  appetite_down: entry(
    'premenstrualSymptoms',
    [
      'მადის კლება — ჭამა ნაკლებად გინდა.',
      'ზოგს მენსტრუაციის პირველ დღეებში, სპაზმებისა და გულისრევისას, მადა ეკარგება.',
      `თუ მადა ორ კვირაზე მეტხანს არ ბრუნდება, უმიზეზოდ იკლებ წონაში, ან ჭამას შეგნებულად ზღუდავ და ეს გაწუხებს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Less appetite — you want to eat less.',
      'Some people lose their appetite in the first days of a period, with cramps or nausea.',
      `If your appetite does not come back for more than two weeks, you lose weight without trying, or you restrict food and it worries you ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  cravings: entry(
    'premenstrualSymptoms',
    [
      'საკვების ლტოლვა — ძლიერი სურვილი რაღაც კონკრეტულის, ხშირად ტკბილის ან მარილიანის.',
      'მენსტრუაციამდელ დღეებში ძალიან ხშირია და მენსტრუაციის დაწყებისას ხშირად წყნარდება.',
      `თუ ლტოლვა საკვების გარდა სხვა რამეზეა (ყინული, მიწა, ცარცი), ან ჭამაზე კონტროლს კარგავ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Cravings — a strong urge for something specific, often sweet or salty.',
      'Very common in the days before a period, and they often settle once it starts.',
      `If you crave things that are not food (ice, soil, chalk), or you feel out of control around food ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  constipation: entry(
    'digestiveHealth',
    [
      'ყაბზობა — კუჭი იშვიათად ან ძნელად მოქმედებს.',
      'ზოგს ციკლის მეორე ნახევარში, მენსტრუაციამდე, ყაბზობა უჩნდება; წყალი, ბოჭკო და მოძრაობა ხშირად ეხმარება.',
      `თუ განავალში სისხლია, ყაბზობა 3 კვირაზე მეტხანს გრძელდება, ძლიერი ტკივილი ან უმიზეზო წონის კლება გაქვს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Constipation — bowel movements are rare or hard.',
      'Some get constipated in the second half of the cycle, before a period; water, fibre and movement often help.',
      `If there is blood in your stool, constipation lasts more than 3 weeks, or you have strong pain or unexplained weight loss ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  diarrhea: entry(
    'periodPain',
    [
      'დიარეა — თხელი ან ხშირი განავალი.',
      'ზოგს მენსტრუაციის პირველ დღეებში, სპაზმებთან ერთად, თხელი განავალი აქვს.',
      `თუ დიარეა 2 დღეზე მეტხანს გრძელდება, განავალში სისხლია, მაღალი ცხელება ან გაუწყლოების ნიშნები გაქვს (ძალიან ცოტა შარდი, თავბრუსხვევა) ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Diarrhea — loose or frequent stools.',
      'Some people have loose stools with cramps in the first days of a period.',
      `If diarrhea lasts more than 2 days, there is blood in it, or you have a high fever or signs of dehydration (very little urine, dizziness) ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  gas: entry(
    'digestiveHealth',
    [
      'გაზები — მუცელში გაზის დაგროვება და გამოყოფა.',
      'ჩვეულებრივია; ზოგს მენსტრუაციამდე, შებერილობასთან ერთად, უფრო მეტად აქვს.',
      `თუ გაზებს ძლიერი ან მუდმივი ტკივილი, განავალში სისხლი ან უმიზეზო წონის კლება ახლავს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Gas — wind building up and passing.',
      'Normal; some people have more of it before a period, together with bloating.',
      `If gas comes with strong or constant pain, blood in your stool or unexplained weight loss ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  // კანი (skin)
  acne: entry(
    'skinAcne',
    [
      'აკნე — გამონაყარი სახეზე, ზურგზე ან მკერდზე.',
      'ზოგს მენსტრუაციამდე რამდენიმე დღით ადრე გამონაყარი უჩნდება, ხშირად ნიკაპზე და ყბის ხაზზე.',
      `თუ გამონაყარი ღრმა და მტკივნეულია, ნაწიბურებს ტოვებს, ან უჩვეულო თმიანობასა და არარეგულარულ ციკლს ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Acne — breakouts on the face, back or chest.',
      'Some people break out in the days before a period, often on the chin and jawline.',
      `If breakouts are deep and painful, leave scars, or come with unusual hair growth and irregular cycles ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  dry_skin: entry(
    'skinAcne',
    [
      'მშრალი კანი — კანი იჭიმება, იქერცლება ან უხეშია.',
      'ხშირია ზამთარში და ცხელი შხაპის შემდეგ; ზოგს მენსტრუაციის გარშემო და მენოპაუზის წინა წლებში უფრო აქვს.',
      `თუ კანი სკდება, სისხლდება, ძლიერ გექავება ან ძილს გიშლის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Dry skin — skin feels tight, flaky or rough.',
      'Common in winter and after hot showers; some notice it more around a period and in the years before menopause.',
      `If skin cracks, bleeds, itches badly or keeps you from sleeping ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  oily_skin: entry(
    'skinAcne',
    [
      'ცხიმიანი კანი — კანი ბრწყინავს, ფორები უფრო ჩანს.',
      'ხშირია ციკლის მეორე ნახევარში, მენსტრუაციამდე, ხშირად გამონაყართან ერთად.',
      `თუ ცხიმიანობას ღრმა გამონაყარი, უჩვეულო თმიანობა ან ძალიან არარეგულარული ციკლი ახლავს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Oily skin — skin looks shiny and pores show more.',
      'Common in the second half of the cycle, before a period, often with breakouts.',
      `If oiliness comes with deep breakouts, unusual hair growth or very irregular cycles ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  itchy_skin: entry(
    'healthTopics',
    [
      'ქავილი — კანის ქავილი სხეულის ნებისმიერ ადგილას.',
      'ხშირად მშრალი კანის ან გაღიზიანების გამოა; ზოგს მენსტრუაციის გარშემო უმძაფრდება.',
      `თუ ქავილი მთელ სხეულზეა და ღამით გაღვიძებს, გამონაყარს ერთვის, ორსულობისას ხელისგულებსა და ტერფებზე დაიწყო, ან სახე და ტუჩები გისივდება (ეს სასწრაფოა — 112) ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Itchy skin — itching anywhere on the body.',
      'Often from dry skin or irritation; some feel it more around a period.',
      `If itching is all over and wakes you at night, comes with a rash, starts on the palms and soles in pregnancy, or your face and lips swell (that is urgent — 112) ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  hair_loss: entry(
    'hairLoss',
    [
      'თმის ცვენა — სავარცხელზე ან შხაპში ჩვეულზე მეტი თმა.',
      'დღეში რამდენიმე ათეული ღერის ცვენა ჩვეულებრივია; სტრესის, ავადმყოფობის ან მშობიარობის შემდეგ რამდენიმე თვე მეტი ცვივა და მერე ბრუნდება.',
      `თუ თმა კონებად ან ლაქებად ცვივა, ცვენა 6 თვეზე მეტხანს გრძელდება, ან დაღლილობას, ძლიერ სისხლდენას თუ არარეგულარულ ციკლს ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Hair loss — more hair than usual on the brush or in the shower.',
      'Losing a few dozen hairs a day is normal; after stress, illness or giving birth more falls out for a few months and then grows back.',
      `If hair falls out in clumps or patches, shedding lasts more than 6 months, or comes with tiredness, heavy periods or irregular cycles ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  // ენერგია (energy)
  fatigue: entry(
    'premenstrualSymptoms',
    [
      'დაღლილობა — ძალა გაკლია, დასვენების შემდეგაც.',
      'ძალიან ხშირია მენსტრუაციამდე და პირველ დღეებში, განსაკუთრებით ძლიერი სისხლდენისას.',
      `თუ დაღლილობა ორ კვირაზე მეტხანს გრძელდება, ძლიერ სისხლდენას, ქოშინს, გულის ფრიალს ან ფერმკრთალობას ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Fatigue — low on strength, even after rest.',
      'Very common before and in the first days of a period, especially with heavy bleeding.',
      `If tiredness lasts more than two weeks, or comes with heavy bleeding, breathlessness, palpitations or pale skin ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  insomnia: entry(
    'sleepAdults',
    [
      'უძილობა — ძნელად იძინებ, ხშირად იღვიძებ ან ძალიან ადრე იღვიძებ.',
      'ზოგს მენსტრუაციამდე რამდენიმე ღამე უფრო ცუდად სძინავს. ზრდასრულს ღამით 7 საათი ან მეტი ძილი სჭირდება.',
      `თუ ცუდი ძილი თვეზე მეტხანს გრძელდება, დღისით საქმეებს გიშლის, ან ძილში ხვრინავ და სუნთქვა გიჩერდება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Insomnia — hard to fall asleep, waking often or too early.',
      'Some people sleep worse for a few nights before a period. Adults need 7 or more hours of sleep a night.',
      `If poor sleep lasts more than a month, gets in the way of your days, or you snore and stop breathing in your sleep ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  oversleep: entry(
    'sleepAdults',
    [
      'ძილიანობა — ჩვეულზე მეტს გძინავს ან დღისით ძილი გერევა.',
      'ზოგს მენსტრუაციამდე და პირველ დღეებში უფრო ეძინება; ზრდასრულს ღამით 7 საათი ან მეტი სჭირდება.',
      `თუ საკმარისი ძილის მიუხედავად დღისით გეძინება, საჭესთან ჩაგეძინება, ან ძილიანობას დაბალი განწყობა ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Sleepiness — sleeping more than usual or nodding off during the day.',
      'Some people are sleepier before and in the first days of a period; adults need 7 or more hours a night.',
      `If you are sleepy in the day despite enough sleep, nod off while driving, or the sleepiness comes with low mood ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  // პირადი — shown only inside the unlocked private group (never in the day sheet).
  vaginal_dryness: entry(
    'vaginalConditions',
    [
      'საშოს სიმშრალე — სიმშრალის, დაჭიმულობის ან დისკომფორტის შეგრძნება.',
      'ზოგს ციკლის გარკვეულ დღეებში, ძუძუთი კვების პერიოდში ან მენოპაუზის წინა წლებში აქვს; ზოგიერთი წამალი და საპონიც ზრდის.',
      `თუ სიმშრალე კვირებით გრძელდება, წვას, სისხლდენას ან ყოველდღიურ დისკომფორტს იწვევს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Vaginal dryness — a dry, tight or uncomfortable feeling.',
      'Some people notice it on certain cycle days, while breastfeeding or in the years before menopause; some medicines and soaps add to it.',
      `If dryness lasts for weeks, or causes burning, bleeding or everyday discomfort ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  itching_vulva: entry(
    'vaginalHealth',
    [
      'გენიტალური ქავილი — ქავილი ან გაღიზიანება გარე სასქესო ორგანოების მიდამოში.',
      'ზოგჯერ სუნამოიანი საპნის, ახალი საცვლის ან საფენის გაღიზიანებაა და მის მოშორებას გადის.',
      `თუ ქავილი რამდენიმე დღეში არ გადის, გამონადენის ფერი ან სუნი შეიცვალა, ან წვა, წყლულები თუ კანის თეთრი ლაქები გაჩნდა ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Genital itching — itching or irritation around the vulva.',
      'Sometimes it is irritation from scented soap, new underwear or pads, and it passes once that is removed.',
      `If the itching does not pass within a few days, the colour or smell of discharge changes, or burning, sores or white patches of skin appear ${DOCTOR_PHRASE_EN}`,
    ],
  ),
};

const MUCUS: Record<string, LearnMoreEntry> = {
  dry: entry(
    'menstrualCycle',
    [
      'მშრალი — ლორწო თითქმის არ ჩანს და სიმშრალეს გრძნობ.',
      'ხშირია მენსტრუაციის შემდეგ პირველ დღეებში და ოვულაციის შემდეგ, ციკლის ბოლოს.',
      `თუ სიმშრალე მუდმივია და დისკომფორტს ან წვას იწვევს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Dry — almost no mucus, and a dry feeling.',
      'Common in the days right after a period and after ovulation, late in the cycle.',
      `If dryness is constant and causes discomfort or burning ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  sticky: entry(
    'menstrualCycle',
    [
      'წებოვანი — სქელი, წებოვანი ან ფაფისებრი ლორწო.',
      'ხშირია ციკლის დასაწყისში, მენსტრუაციის შემდეგ, როცა ოვულაცია ჯერ შორსაა.',
      `თუ ლორწოს უჩვეულო ფერი (მწვანე, ნაცრისფერი) ან უსიამოვნო სუნი აქვს, ან ქავილი ახლავს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Sticky — thick, tacky or pasty mucus.',
      'Common early in the cycle, after a period, while ovulation is still some way off.',
      `If the mucus has an unusual colour (green, grey) or an unpleasant smell, or comes with itching ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  creamy: entry(
    'menstrualCycle',
    [
      'კრემისებრი — თეთრი, ლოსიონის მსგავსი ლორწო.',
      'ხშირად ჩნდება, როცა ოვულაცია ახლოვდება; ზოგს ოვულაციის შემდეგაც აქვს.',
      `თუ ლორწოს უჩვეულო ფერი ან უსიამოვნო სუნი აქვს, ან ქავილი თუ წვა ახლავს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Creamy — white, lotion-like mucus.',
      'Often appears as ovulation gets closer; some also have it after ovulation.',
      `If the mucus has an unusual colour or an unpleasant smell, or comes with itching or burning ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  watery: entry(
    'menstrualCycle',
    [
      'წყლიანი — თხელი, გამჭვირვალე, სველი ლორწო.',
      'ხშირად ოვულაციის წინა დღეებში ჩნდება და სავარაუდო ნაყოფიერ დღეებზე მიუთითებს.',
      `თუ წყლიანი ლორწო ორსულობისას უეცრად და ბევრი გაჩნდა, ან უსიამოვნო სუნი და ქავილი ახლავს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Watery — thin, clear, wet mucus.',
      'Often shows up in the days before ovulation and points to likely fertile days.',
      `If a sudden gush of watery fluid appears in pregnancy, or it comes with an unpleasant smell and itching ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  eggwhite: entry(
    'menstrualCycle',
    [
      'კვერცხის ცილისებრი — გამჭვირვალე, ელასტიური ლორწო, თითებს შორის იჭიმება.',
      'ხშირად ოვულაციამდე ერთი-ორი დღით ადრე ჩნდება და ყველაზე ნაყოფიერ დღეებზე მიუთითებს. ეს სავარაუდო ნიშანია, არა კონტრაცეფციის მეთოდი.',
      `თუ ორსულობას 12 თვე ცდილობ (35 წლიდან — 6 თვე) და ასეთ ლორწოს არასდროს ამჩნევ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Egg white — clear, stretchy mucus that strings between the fingers.',
      'Often appears a day or two before ovulation and points to the most fertile days. It is an estimate, not a contraception method.',
      `If you have been trying to get pregnant for 12 months (6 months from age 35) and never notice this kind of mucus ${DOCTOR_PHRASE_EN}`,
    ],
  ),
};

const TEST: Record<string, LearnMoreEntry> = {
  ovulationTest: entry(
    'menstrualCycle',
    [
      'ოვულაციის ტესტი (OPK) შარდში LH ჰორმონის მატებას ზომავს.',
      'დადებითი შედეგის შემდეგ ოვულაცია ხშირად დაახლოებით ერთ-ორ დღეში ხდება, მაგრამ ტესტი ოვულაციას არ ადასტურებს. ზოგს რამდენიმე დადებითი დღე ზედიზედ აქვს.',
      `თუ ტესტი თვეების განმავლობაში არასდროს არის დადებითი, ან თითქმის ყოველთვის დადებითია და ორსულობას ცდილობ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'An ovulation test (OPK) measures the rise of the LH hormone in urine.',
      'After a positive result ovulation often follows within about a day or two, but the test does not confirm ovulation. Some people get several positive days in a row.',
      `If the test is never positive for months, or almost always positive, and you are trying to get pregnant ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  pregnancyTest: entry(
    'pregnancyTest',
    [
      'ორსულობის ტესტი შარდში hCG ჰორმონს ეძებს.',
      'ყველაზე სანდოა მოსალოდნელი მენსტრუაციის დღიდან; ადრე გაკეთებული ტესტი შეიძლება უარყოფითი იყოს. გაურკვეველი შედეგისას რამდენიმე დღეში გამეორება ხშირი რჩევაა.',
      `დადებითი ტესტი და ცალმხრივი ძლიერი ტკივილი, სისხლდენა ან გულის წასვლა — დარეკე 112-ზე. დადებითი ან ორჯერ გაურკვეველი შედეგის შემდეგ ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'A pregnancy test looks for the hCG hormone in urine.',
      'It is most reliable from the day a period is due; a test taken earlier can be negative. With an unclear result, repeating it in a few days is common advice.',
      `A positive test with strong one-sided pain, bleeding or fainting — call 112. After a positive result, or two unclear ones ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  bbt: entry(
    'menstrualCycle',
    [
      'ბაზალური ტემპერატურა (BBT) — სხეულის ტემპერატურა დილით, ადგომამდე.',
      'ოვულაციის შემდეგ ხშირად ოდნავ, დაახლოებით 0.2–0.5 °C-ით, იწევს და მენსტრუაციამდე ასე რჩება. ერთი გაზომვა ცოტას ამბობს — მნიშვნელობა რამდენიმე დღის ტენდენციას აქვს.',
      `38 °C და მეტი ცხელებაა და არა ციკლის ნიშანი. თუ ორსულობას ცდილობ და ტემპერატურა ციკლიდან ციკლამდე არასდროს იწევს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Basal body temperature (BBT) — your temperature in the morning before getting up.',
      'After ovulation it often rises slightly, by about 0.2–0.5 °C, and stays up until the period. One reading says little — the trend over several days is what matters.',
      `38 °C or more is a fever, not a cycle sign. If you are trying to get pregnant and your temperature never rises from cycle to cycle ${DOCTOR_PHRASE_EN}`,
    ],
  ),
};

const LIFESTYLE: Record<string, LearnMoreEntry> = {
  energy: entry(
    'cycleBasics',
    [
      'ენერგიის დონე — რამდენად მხნედ გრძნობდი თავს დღეს, ძალიან დაბლიდან ძალიან მაღლამდე.',
      'ხშირია, რომ ენერგია ციკლის პირველ ნახევარში მატულობს და მენსტრუაციამდე კლებულობს.',
      `თუ ენერგია კვირების განმავლობაში ძალიან დაბალია, ან ძლიერ სისხლდენას თავბრუსხვევა და ქოშინი ერთვის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Energy level — how lively you felt today, from very low to very high.',
      'It is common for energy to rise in the first half of the cycle and dip before a period.',
      `If your energy has been very low for weeks, or heavy bleeding comes with dizziness and breathlessness ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  sleepQuality: entry(
    'sleepAdults',
    [
      'ძილის ხარისხი — რამდენად კარგად გეძინა წინა ღამით.',
      'ზრდასრულს ღამით 7 საათი ან მეტი ძილი სჭირდება. ზოგს მენსტრუაციამდე რამდენიმე ღამე უფრო ცუდად სძინავს.',
      `თუ ცუდი ძილი თვეზე მეტხანს გრძელდება, ძილში ხვრინავ და სუნთქვა გიჩერდება, ან დღისით ჩაგეძინება ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Sleep quality — how well you slept last night.',
      'Adults need 7 or more hours of sleep a night. Some people sleep worse for a few nights before a period.',
      `If poor sleep lasts more than a month, you snore and stop breathing in your sleep, or you nod off during the day ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  stressLevel: entry(
    'stress',
    [
      'სტრესის დონე — რამდენად დაძაბული იყო დღე.',
      'ხანგრძლივმა სტრესმა ზოგს მენსტრუაცია შეიძლება გადააწიოს ან ციკლი შეცვალოს.',
      `თუ სტრესი კვირების განმავლობაში ძილს, ჭამას ან ყოველდღიურ საქმეებს გიშლის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Stress level — how tense the day was.',
      'Long-lasting stress can make a period come late or change the cycle for some.',
      `If stress has been disrupting your sleep, eating or daily tasks for weeks ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  exerciseLevel: entry(
    'physicalActivity',
    [
      'მოძრაობა — რამდენი და რა ინტენსივობის ფიზიკური აქტივობა გქონდა.',
      'ზრდასრულს კვირაში 150–300 წუთი ზომიერ აქტივობას ურჩევენ; მსუბუქი მოძრაობა ზოგს სპაზმებსაც უმსუბუქებს. ძალიან ინტენსიურმა ვარჯიშმა ცოტა საკვებთან ერთად მენსტრუაცია შეიძლება შეაჩეროს.',
      `ვარჯიშისას მკერდის ტკივილი, გულის წასვლა ან ძლიერი ქოშინი — შეჩერდი და დარეკე 112-ზე. თუ ინტენსიური დატვირთვისას მენსტრუაცია შეგიწყდა ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Movement — how much physical activity you had, and how hard.',
      'Adults are advised 150–300 minutes of moderate activity a week; gentle movement eases cramps for some. Very hard training with too little food can stop periods.',
      `Chest pain, fainting or severe breathlessness during exercise — stop and call 112. If your periods stopped while training hard ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  caffeine: entry(
    'caffeine',
    [
      'კოფეინი — ყავა, ჩაი, ენერგეტიკული სასმელები.',
      'ზოგს ბევრი კოფეინი მენსტრუაციამდე მკერდის მგრძნობელობას, შფოთვას ან ცუდ ძილს უმძაფრებს.',
      `თუ კოფეინის შემდეგ გული გიფრიალებს, ხელები გიკანკალებს ან ვერ იძინებ, და შემცირება არ გშველის ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Caffeine — coffee, tea, energy drinks.',
      'For some, a lot of caffeine makes breast tenderness, anxiety or poor sleep worse before a period.',
      `If caffeine leaves your heart racing, hands shaking or you unable to sleep, and cutting down does not help ${DOCTOR_PHRASE_EN}`,
    ],
  ),
  alcohol: entry(
    'alcohol',
    [
      'ალკოჰოლი — რამდენი დალიე დღეს.',
      'ალკოჰოლი ძილს აუარესებს და ზოგს მენსტრუაციამდე განწყობის ცვლას უმძაფრებს.',
      `თუ ალკოჰოლს სტრესის ან ძილის გამო ხშირად სვამ, ან შემცირება გიჭირს ${DOCTOR_PHRASE_KA}`,
    ],
    [
      'Alcohol — how much you drank today.',
      'Alcohol makes sleep worse and, for some, makes mood swings before a period stronger.',
      `If you often drink because of stress or sleep, or find it hard to cut down ${DOCTOR_PHRASE_EN}`,
    ],
  ),
};

/** Every option entry, by the kind of log it belongs to (ids collide across kinds: flow `light` ≠ exercise `light`). */
export const LEARN_MORE: Readonly<Record<LearnMoreKind, Readonly<Record<string, LearnMoreEntry>>>> = {
  flow: FLOW,
  pain: PAIN,
  mood: MOOD,
  symptom: SYMPTOM,
  mucus: MUCUS,
  test: TEST,
  lifestyle: LIFESTYLE,
};

/** Sex, sex drive and the other highly sensitive keys — never explained (brief §8.3, registry HIGHLY_SENSITIVE). */
export const LEARN_MORE_BLOCKED_IDS: ReadonlySet<string> = new Set([
  ...SEXUAL_OPTIONS.map((o) => o.id),
  'sex',
  'intercourse',
  'sexual',
  'sexualActivity',
  'libido',
  'notes',
  'customTagIds',
]);

/** Intimate symptoms: an entry exists, but only the unlocked private group may show it. */
export const LEARN_MORE_PRIVATE_IDS: ReadonlySet<string> = new Set(['vaginal_dryness', 'itching_vulva']);

/** Older logs keep pain places as symptom ids; they read the pain entry. */
const PAIN_SYMPTOM_ALIAS: Readonly<Record<string, string>> = {
  cramps: 'cramps',
  headache: 'headache',
  back_pain: 'lower_back',
  breast_tenderness: 'breast',
  pelvic_pain: 'pelvic',
  ovulation_pain: 'ovulation_side',
};

/**
 * The entry for one logged option, or null when there is none or it must never be explained.
 * `allowPrivate` is true only inside the unlocked private group.
 */
export function learnMoreFor(
  kind: LearnMoreKind,
  id: string,
  { allowPrivate = false }: { allowPrivate?: boolean } = {},
): LearnMoreEntry | null {
  if (LEARN_MORE_BLOCKED_IDS.has(id)) return null;
  if (LEARN_MORE_PRIVATE_IDS.has(id) && !allowPrivate) return null;
  if (kind === 'symptom' && PAIN_SYMPTOM_ALIAS[id]) return PAIN[PAIN_SYMPTOM_ALIAS[id]] ?? null;
  return LEARN_MORE[kind]?.[id] ?? null;
}

export function learnMoreGroup(group: string): LearnMoreEntry | null {
  return (LEARN_MORE_GROUPS as Record<string, LearnMoreEntry>)[group] ?? null;
}

/** The entry in the app language. */
export function learnMoreText(entry: LearnMoreEntry): LearnMoreText {
  return isEn() ? entry.en : entry.ka;
}

/** Headings of the sheet's two blocks. */
export function learnMoreHeadings(): { typical: string; whenDoctor: string } {
  return { typical: tx('ხშირია', 'What’s common'), whenDoctor: tx('როდის მივმართო ექიმს', 'When to see a doctor') };
}
