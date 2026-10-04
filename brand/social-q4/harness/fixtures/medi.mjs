// Medi (/assistant, mobile/src/components/medi/MediChat.tsx) + saved conversations + the clinical answer path.
//
// On open the screen calls GET /api/assistant/catalog?scope=auto (tools, features, groups, choices, voice flags);
// with ?sessionId= it also calls GET /api/chats/:id. MEDILAB's „საუბრები“ tab calls GET /api/chats.
// Sending: every message → POST /api/assistant/plan; a health question comes back as a `consult` review and the
// app immediately streams POST /api/ai/query (DOCTOR, SSE `data: {"type":"delta"|"done"|"error",…}\n\n`).
// The consilium switch / ?mode=deep sends straight to /api/ai/query with mode CONSILIUM.
// Action cards: „შენახვა“ → POST /api/assistant/execute (the write goes through health.mjs's own routes).
// Every finished turn is saved with POST /api/chats/assistant.
//
// Shapes: server/src/routes/assistant.routes.js, lib/assistantCatalog.js, lib/assistantExecution.js,
// routes/chats.routes.js, routes/ai.routes.js (/query, /feedback). The tool catalogue, features and guidance
// are the server's own modules (assistantCatalog.js is loaded through a small import rewrite that stubs its
// Prisma-backed imports; assistantKnowledge.js / assistantFlow.js are pure) — with a hand-written fallback.
// The planner itself is rule-based (no model): see `planReply`.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { addDays, isoAt } from '../lib.mjs';
import { routes as healthRoutes } from './health.mjs';
import { LAB_DEFS, latestPanel } from './lab.mjs';
import { REPO, sleep, t, unauthorized, usageFor, userIdOf, uuidFrom } from './_mockkit.mjs';

const LIB = `${REPO}/server/src/lib`;
const MODEL = 'google/gemini-3.8-flash';

// ---------------------------------------------------------------------------------------------
// Server modules (read-only)
// ---------------------------------------------------------------------------------------------
let CATALOG = null; // { publicAssistantCatalog, validateAssistantAction, assistantToolLabel, ASSISTANT_DESTINATIONS }
let KNOWLEDGE = null; // assistantKnowledge.js
let FLOW = null; // assistantFlow.js
let PETS = null; // petsCatalog.js
try {
  let src = readFileSync(`${LIB}/assistantCatalog.js`, 'utf8');
  src = src
    .replace(/from 'zod';/, `from '${pathToFileURL(`${REPO}/server/node_modules/zod/index.js`).href}';`)
    .replace(/^import \{ currentAiLanguage \} from '\.\/aiConsent\.js';$/m, "const currentAiLanguage = () => 'ka';")
    .replace(/^import \{ t \} from '\.\/i18n\.js';$/m, "const t = (s, ka, en) => ((typeof s === 'string' ? s : s && s.lang) === 'en' ? en : ka);")
    .replace(
      /^import \{[^}]*\} from '\.\/petsHealth\.js';$/m,
      "const ALLERGY_CATEGORIES=['medication','food','environmental','other','unknown'],ALLERGY_STATUSES=['suspected','veterinarian_confirmed'],CONDITION_STATUSES=['active','resolved','unknown'],CONDITION_BASES=['owner_reported','veterinarian_confirmed'];",
    )
    .replace(
      /^import \{[^}]*\} from '\.\/petsSchedule\.js';$/m,
      "const CARE_KINDS=['VACCINATION','FLEA_TICK','DEWORMING','MEDICATION','OTHER'],RECURRENCE_KINDS=['ONCE','EVERY_N_DAYS','EVERY_N_WEEKS','EVERY_N_MONTHS','DAILY_COURSE'],RECURRENCE_BASES=['NONE','FIXED_CALENDAR','FROM_ADMINISTRATION'],CARE_SOURCES=['VETERINARIAN','PRODUCT_INSTRUCTIONS','USER_ENTERED'],CARE_ROUTES=['oral','topical','injection','other','unknown'],TIME_MODES=['DATE_BASED','EXACT_TIME'];",
    )
    .replace(/from '\.\/([\w.-]+\.js)'/g, (_, f) => `from '${pathToFileURL(`${LIB}/${f}`).href}'`);
  CATALOG = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
} catch (error) {
  console.warn('[medi] server assistant catalog unavailable, using the fallback:', error?.message);
}
for (const [name, set] of [['assistantKnowledge.js', (m) => (KNOWLEDGE = m)], ['assistantFlow.js', (m) => (FLOW = m)], ['petsCatalog.js', (m) => (PETS = m)]]) {
  try {
    set(await import(pathToFileURL(`${LIB}/${name}`).href));
  } catch (error) {
    console.warn(`[medi] ${name} unavailable:`, error?.message);
  }
}

const FALLBACK_LABELS = {
  consult: ['კონსულტაციის დაწყება', 'Start a consultation'],
  medication_add: ['მედიკამენტის შეხსენება', 'Medication reminder'],
  hydration_add: ['წყლის მიღების ჩაწერა', 'Log water'],
  visit_add: ['ვიზიტის ჩანაწერი', 'Visit entry'],
  open: ['ფუნქციის გახსნა', 'Open a feature'],
};
const toolLabel = (name, lang) =>
  CATALOG?.assistantToolLabel ? CATALOG.assistantToolLabel(name, lang) : (FALLBACK_LABELS[name]?.[lang === 'en' ? 1 : 0] ?? name);

const S = (props, required) => ({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: props, required, additionalProperties: false });
const str = (max) => ({ type: 'string', minLength: 1, maxLength: max });
const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const TIME = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };
function fallbackTools(lang) {
  const tool = (name, group, kind, parameters) => ({ domain: 'human', name, label: toolLabel(name, lang), description: '', group, kind, parameters });
  return [
    tool('consult', 'analysis', 'handoff', S({ mode: { type: 'string', enum: ['DOCTOR', 'CONSILIUM'] }, message: str(4000) }, ['mode', 'message'])),
    tool('medication_add', 'treatment', 'write', S({ medName: str(120), dosage: str(80), frequency: { minItems: 1, maxItems: 8, type: 'array', items: TIME }, notes: str(300), startDate: DATE, endDate: DATE, courseDays: { type: 'integer', minimum: 1, maximum: 365 } }, ['medName', 'dosage', 'frequency'])),
    tool('hydration_add', 'daily', 'write', S({ date: DATE, amountMl: { type: 'integer', minimum: 1, maximum: 5000 } }, ['date', 'amountMl'])),
    tool('visit_add', 'treatment', 'write', S({ doctorType: { type: 'string', enum: ['GP', 'DENTIST', 'CARDIO', 'GYN', 'NEURO', 'ORTHO', 'THERAPIST', 'OPHTHALMO', 'DERM', 'PED', 'OTHER'] }, doctorFirstName: str(80), doctorLastName: str(80), visitDate: DATE, visitTime: TIME, address: str(300), notes: str(500) }, ['doctorType', 'visitDate', 'visitTime'])),
  ];
}
function publicTools(lang) {
  try {
    if (CATALOG?.publicAssistantCatalog) return CATALOG.publicAssistantCatalog('auto', lang);
  } catch (error) {
    console.warn('[medi] publicAssistantCatalog failed:', error?.message);
  }
  return fallbackTools(lang);
}
function toolParameters(name) {
  return publicTools('ka').find((tool) => tool.name === name)?.parameters ?? null;
}
function validated(action) {
  if (CATALOG?.validateAssistantAction) return CATALOG.validateAssistantAction(action, 'human');
  return { tool: action.tool, args: { ...action.args } };
}
function guidanceFor(draft, lang) {
  if (!draft) return null;
  const parameters = toolParameters(draft.tool);
  if (FLOW?.assistantGuidance) return FLOW.assistantGuidance(draft, parameters, lang);
  const empty = (k) => draft.args[k] == null || draft.args[k] === '' || (Array.isArray(draft.args[k]) && !draft.args[k].length);
  return { fields: (parameters?.required ?? []).filter(empty), question: null };
}
const DESTINATIONS = () => KNOWLEDGE?.ASSISTANT_DESTINATIONS ?? CATALOG?.ASSISTANT_DESTINATIONS ?? {};

// ---------------------------------------------------------------------------------------------
// Answers (DOCTOR first-turn style: 3–6 short sentences, one question; CONSILIUM: the server's Markdown structure)
// ---------------------------------------------------------------------------------------------
function labValue(state, key) {
  return latestPanel(state)?.parameters.find((p) => p.key === key) ?? null;
}

function doctorAnswer(rq, topic, ctx = {}) {
  const en = rq.lang === 'en';
  const vitd = labValue(rq.state, 'vitamin_d');
  const ldl = labValue(rq.state, 'ldl');
  const glu = labValue(rq.state, 'glucose');
  switch (topic) {
    case 'vitd':
      return en
        ? `Your latest vitamin D is ${vitd?.display ?? 34} ng/mL — already within the range (30–100). Once the level is back in range, doctors often switch from a repletion dose to a maintenance dose, but the exact dose depends on your results and the season. Don't raise the dose on your own — too much vitamin D is harmful too. A repeat test is usually done in about 3 months. How many units (IU) do you take a day right now?`
        : `ბოლო ანალიზით ვიტამინი D ${vitd?.display ?? 34} ng/mL-ია — ეს უკვე ნორმის ფარგლებშია (30–100). როცა დონე ნორმას აღწევს, ექიმი ხშირად აღდგენით დოზას შემანარჩუნებლით ცვლის, მაგრამ ზუსტ დოზას შენი ანალიზისა და სეზონის მიხედვით შეარჩევს. დოზის თვითნებურად გაზრდა არ ღირს — ძალიან მაღალი დონეც საზიანოა. განმეორებითი ანალიზი ჩვეულებრივ 3 თვეში კეთდება. ახლა დღეში რამდენ ერთეულს (IU) იღებ?`;
    case 'vitd-followup':
      return en
        ? `2000 IU a day is a common maintenance amount, so it will likely not need changing — but your doctor makes the final call. Take it with a meal that has some fat: it is absorbed better that way. A repeat test in about 3 months, before winter, is a good idea. Shall I remind you to repeat the test?`
        : `დღეში 2000 IU შემანარჩუნებელი დოზისთვის ხშირად გამოყენებული რაოდენობაა, ამიტომ მისი შეცვლა სავარაუდოდ არ დაგჭირდება — თუმცა საბოლოოდ ამას შენი ექიმი გადაწყვეტს. მიიღე ცხიმის შემცველ საკვებთან ერთად — ასე უკეთ შეიწოვება. განმეორებითი ანალიზი დაახლოებით 3 თვეში, ზამთრის დაწყებამდე ღირს. გინდა, ანალიზის გამეორება შეგახსენო?`;
    case 'headache':
      return en
        ? `A headache that has lasted three days is most often a tension-type headache — stress, short sleep, long screen time or too little water can cause it. Try enough water, screen breaks and rest; a painkiller you have used before, only as the label says. Get urgent help or call 112 if the pain started suddenly and very strongly, or comes with a high fever, a stiff neck, or trouble seeing or speaking. Where in your head is the pain, and when in the day does it get worse?`
        : `სამდღიანი თავის ტკივილი ყველაზე ხშირად დაძაბულობის ტიპისაა — მას იწვევს სტრესი, ცოტა ძილი, დიდხანს ეკრანთან ჯდომა ან ცოტა წყალი. სცადე საკმარისი წყალი, ეკრანისგან შესვენებები და დასვენება; ტკივილგამაყუჩებელი, რომელსაც ადრეც იღებდი, მხოლოდ ინსტრუქციის მიხედვით. სასწრაფოდ მიმართე ექიმს ან დარეკე 112-ში, თუ ტკივილი უეცრად და ძალიან ძლიერად დაიწყო, ან ახლავს მაღალი სიცხე, კისრის დაჭიმულობა, მხედველობის ან მეტყველების დარღვევა. თავის რომელ ნაწილში გტკივა და დღის რომელ დროს ძლიერდება?`;
    case 'cholesterol':
      return en
        ? `An LDL of ${ldl?.display ?? '3.4'} mmol/L is slightly above the printed range (0–3.0) — not urgent, but worth attention. What helps most: less saturated fat (fatty meat, butter, packaged pastries), more fibre (beans, oats, vegetables) and 150 minutes of moderate activity a week. Doctors usually repeat the lipid panel in 2–3 months and judge the risk together with blood pressure, family history and other results. Has anyone in your family had heart disease or high cholesterol at a young age?`
        : `LDL ${ldl?.display ?? '3.4'} mmol/L ფურცელზე დაბეჭდილ ნორმაზე (0–3.0) ოდნავ მაღალია — ეს გადაუდებელი არ არის, მაგრამ ყურადღებას იმსახურებს. ყველაზე მეტად ეხმარება ნაკლები გაჯერებული ცხიმი (ცხიმიანი ხორცი, კარაქი, ფაბრიკული ნამცხვრები), მეტი ბოჭკო (ლობიო, შვრია, ბოსტნეული) და კვირაში 150 წუთი ზომიერი მოძრაობა. ექიმი ჩვეულებრივ 2–3 თვეში ლიპიდური პროფილის გამეორებას გირჩევს და რისკს წნევის, ოჯახური ისტორიისა და სხვა მაჩვენებლების მიხედვით შეაფასებს. ოჯახში ვინმეს ჰქონია გულის დაავადება ან მაღალი ქოლესტერინი ადრეულ ასაკში?`;
    case 'glucose':
      if (glu && glu.flag === 'H') {
        return en
          ? `A fasting glucose of ${glu.display} mmol/L is slightly above the upper limit (5.6). One measurement is not a diagnosis — doctors usually suggest HbA1c or a repeat test. What helps most: gradual weight loss, a daily walk and fewer sugary drinks. See a doctor soon if you have strong thirst, frequent urination or unexplained weight loss. Was the test really fasting — at least 8 hours after your last meal?`
          : `უზმოზე გლუკოზა ${glu.display} mmol/L ნორმის ზედა ზღვარს (5.6) ოდნავ აღემატება. ერთი გაზომვით დიაგნოზი არ ისმება — ექიმი ხშირად გლიკირებულ ჰემოგლობინს (HbA1c) ან განმეორებით ანალიზს გირჩევს. ასეთ დროს ყველაზე მეტად ეხმარება წონის თანდათანობითი კლება, ყოველდღიური სიარული და ტკბილი სასმელების შემცირება. სწრაფად მიმართე ექიმს, თუ გაქვს ძლიერი წყურვილი, ხშირი შარდვა ან უმიზეზო წონის კლება. ანალიზი ნამდვილად უზმოზე გაიკეთე — ბოლო ჭამიდან 8 საათის შემდეგ?`;
      }
      return en
        ? `Your latest fasting glucose is ${glu?.display ?? '4.9'} mmol/L — within the range (3.9–5.6). A single normal result is reassuring; a yearly check is usually enough unless your doctor says otherwise. Regular meals, daily movement and fewer sugary drinks keep it that way. Is there a reason you are worried about your blood sugar — a symptom or family history?`
        : `ბოლო ანალიზით უზმოზე გლუკოზა ${glu?.display ?? '4.9'} mmol/L-ია — ნორმაშია (3.9–5.6). ეს დამამშვიდებელი შედეგია; როგორც წესი, წელიწადში ერთხელ შემოწმება საკმარისია, თუ ექიმი სხვას არ გირჩევს. რეგულარული კვება, ყოველდღიური მოძრაობა და ნაკლები ტკბილი სასმელი ამ დონეს შეინარჩუნებს. რამე გაწუხებს — სიმპტომი ან ოჯახური ისტორია?`;
    case 'fatigue':
      return en
        ? `Tiredness and dizziness have many causes: short sleep, too little fluid, irregular meals, low ferritin or vitamin D, thyroid changes. In your latest tests haemoglobin, ferritin and TSH are within range — a good sign. Pay attention to sleep, water and regular meals, and stand up slowly. See a doctor urgently if dizziness comes with fainting, chest pain or shortness of breath. How long has it been going on, and when in the day is it worst?`
        : `დაღლილობასა და თავბრუსხვევას ბევრი მიზეზი აქვს: ცოტა ძილი, სითხის ნაკლებობა, არარეგულარული კვება, დაბალი ფერიტინი ან ვიტამინი D, ფარისებრი ჯირკვლის ცვლილებები. შენს ბოლო ანალიზში ჰემოგლობინი, ფერიტინი და TSH ნორმაშია — ეს კარგი ნიშანია. ყურადღება მიაქციე ძილს, საკმარის წყალს და რეგულარულ კვებას, ფეხზე ნელა წამოდექი. სასწრაფოდ მიმართე ექიმს, თუ თავბრუსხვევას გულის წასვლა, გულმკერდის ტკივილი ან სუნთქვის გაძნელება ახლავს. რამდენ ხანს გრძელდება და დღის რომელ დროს არის უფრო ძლიერი?`;
    case 'results': {
      const off = ctx.off ?? [];
      const total = ctx.total ?? 0;
      const nameOf = (enName) => {
        const def = Object.values(LAB_DEFS).find((d) => d.en.toLowerCase() === String(enName).toLowerCase());
        return en ? enName : def?.ka ?? enName;
      };
      if (!off.length) {
        return en
          ? `All ${total} values on this sheet are within the printed ranges — a reassuring result. Keep your usual routine and repeat the tests when your doctor suggests, usually once a year. Is there a particular value you would like me to explain?`
          : `ამ ფურცელზე ყველა ${total} მაჩვენებელი დაბეჭდილ ნორმაშია — ეს დამამშვიდებელი შედეგია. გააგრძელე ჩვეული რეჟიმი და ანალიზები ექიმის რჩევით გაიმეორე, ჩვეულებრივ წელიწადში ერთხელ. რომელიმე მაჩვენებელზე გინდა უფრო დეტალური ახსნა?`;
      }
      const list = off.map((o) => `${nameOf(o.name)} (${o.value})`).join(en ? ' and ' : ' და ');
      return en
        ? `Of ${total} values, only ${off.length} ${off.length === 1 ? 'is' : 'are'} outside the printed range: ${list}. The deviation is small and not urgent — doctors usually suggest repeating the test in 2–3 months together with changes in diet and activity. The blood count, thyroid, liver and kidney values are within range. Which value would you like to go through in more detail?`
        : `${total} მაჩვენებლიდან ნორმის გარეთ მხოლოდ ${off.length}-ია: ${list}. გადახრა მცირეა და გადაუდებელ ზომებს არ მოითხოვს — ექიმი ჩვეულებრივ 2–3 თვეში გამეორებას და კვებისა და მოძრაობის ცვლილებას გირჩევს. სისხლის საერთო ანალიზი, ფარისებრი ჯირკვალი, ღვიძლი და თირკმელი ნორმაშია. რომელ მაჩვენებელზე გინდა უფრო დეტალურად ვისაუბროთ?`;
    }
    case 'followup':
      return en
        ? `Thanks for the details. From what you describe, nothing points to a dangerous cause, but if it does not improve in 2–3 days or something new appears, see your family doctor. Until then, note when and in what situation it happens — that helps the doctor a lot. Would you like me to add a doctor visit with a reminder?`
        : `გასაგებია, მადლობა დეტალებისთვის. რასაც აღწერ, საშიშ მიზეზზე არ მიუთითებს, მაგრამ თუ 2–3 დღეში არ გაუმჯობესდა ან რამე ახალი დაემატა, ოჯახის ექიმს ეწვიე. მანამდე ჩაინიშნე, როდის და რა ვითარებაში ჩნდება — ეს ექიმს ძალიან დაეხმარება. გინდა, ექიმთან ვიზიტი ჩაგიწერო შეხსენებით?`;
    default:
      return en
        ? `It helps to know when it started, how long it lasts and what makes it better or worse. In general, if it is slowly improving and nothing else comes with it, rest, enough water and watching it are enough. See a doctor urgently if it suddenly gets worse or a new strong symptom appears. Tell me a bit more — when did it start, and what else do you notice?`
        : `ასეთ დროს მნიშვნელოვანია, როდის დაიწყო, რამდენ ხანს გრძელდება და რა აძლიერებს ან ამსუბუქებს. ზოგადად, თუ მდგომარეობა თანდათან უმჯობესდება და სხვა სიმპტომი არ ახლავს, საკმარისია დასვენება, საკმარისი წყალი და დაკვირვება. სასწრაფოდ მიმართე ექიმს, თუ ჩივილი უეცრად გაძლიერდა ან ახალი ძლიერი სიმპტომი გამოჩნდა. მომიყევი ცოტა დეტალურად — როდის დაიწყო და რა სიმპტომები ახლავს?`;
  }
}

function consiliumAnswer(rq, kind) {
  const en = rq.lang === 'en';
  const women = rq.persona !== 'man';
  const ldl = labValue(rq.state, 'ldl');
  const glu = labValue(rq.state, 'glucose');
  if (kind === 'metabolic') {
    const gluHigh = glu?.flag === 'H';
    if (en) {
      return `## Consilium members
Internist, cardiologist, endocrinologist, dietitian.

## Specialists' views
### 🩺 Internist
LDL ${ldl?.display ?? '3.4'} mmol/L is slightly above the range${gluHigh ? ` and fasting glucose ${glu.display} mmol/L is just above the upper limit` : `, while glucose is within range`}. Nothing here is urgent, but changes started now work best.
### 🫀 Cardiologist
Heart risk is not judged by LDL alone — blood pressure, smoking, family history and waist size matter too. After a risk assessment your doctor decides whether lifestyle changes are enough.
### 🦋 Endocrinologist
One glucose measurement is not enough for a diagnosis. HbA1c shows the average of the last 3 months and is more reliable for decisions.
### 🥗 Dietitian
The biggest effect comes from fewer sugary drinks and white flour, fish 2–3 times a week, vegetables and pulses every day, and moderate portions.

## Overall conclusion
The specialists agree the results point to early, very manageable changes. The first steps are diet, activity and a risk assessment; only a doctor decides about medication.

## Recommended tests
1. **HbA1c** — to confirm the average glucose level.
2. **Lipid panel in 3 months** — to see the effect of the changes.
3. **Regular blood pressure checks** — for the overall risk.`;
    }
    return `## კონსილიუმის შემადგენლობა
თერაპევტი, კარდიოლოგი, ენდოკრინოლოგი, დიეტოლოგი.

## სპეციალისტების მოსაზრებები
### 🩺 თერაპევტი
LDL ${ldl?.display ?? '3.4'} mmol/L ნორმას ოდნავ აღემატება${gluHigh ? `, უზმოზე გლუკოზა ${glu.display} mmol/L კი ნორმის ზედა ზღვარს ოდნავ სცდება` : `, გლუკოზა კი ნორმაშია`}. გადაუდებელი არაფერია, მაგრამ ახლა დაწყებული ცვლილებები ყველაზე ეფექტიანია.
### 🫀 კარდიოლოგი
გულ-სისხლძარღვთა რისკი მხოლოდ LDL-ით არ ფასდება — მნიშვნელოვანია წნევა, თამბაქო, ოჯახური ისტორია და წელის გარშემოწერილობა. რისკის შეფასების შემდეგ ექიმი გადაწყვეტს, საკმარისია თუ არა ცხოვრების წესის ცვლილება.
### 🦋 ენდოკრინოლოგი
გლუკოზის ერთი გაზომვა დიაგნოზისთვის საკმარისი არ არის. HbA1c ბოლო 3 თვის საშუალო დონეს აჩვენებს და გადაწყვეტილებისთვის უფრო სანდოა.
### 🥗 დიეტოლოგი
ყველაზე დიდი ეფექტი აქვს ტკბილი სასმელებისა და თეთრი ფქვილის შემცირებას, კვირაში 2–3-ჯერ თევზს, ყოველდღე ბოსტნეულსა და პარკოსნებს და ზომიერ პორციებს.

## საერთო დასკვნა
სპეციალისტები თანხმდებიან, რომ შედეგები ადრეულ, კარგად მართვად ცვლილებებზე მიუთითებს. პირველი ნაბიჯი კვება, მოძრაობა და რისკის შეფასებაა; მედიკამენტზე გადაწყვეტილებას მხოლოდ ექიმი მიიღებს.

## რეკომენდებული გამოკვლევები
1. **HbA1c** — გლუკოზის საშუალო დონის დასაზუსტებლად.
2. **ლიპიდური პროფილი 3 თვეში** — ცვლილებების ეფექტის შესაფასებლად.
3. **არტერიული წნევის რეგულარული გაზომვა** — საერთო რისკის შესაფასებლად.`;
  }
  if (en) {
    return `## Consilium members
Internist, endocrinologist, haematologist, neurologist.

## Specialists' views
### 🩺 Internist
The most common causes of lasting tiredness are short sleep, stress and irregular meals. Your latest tests look calm — the full blood count is within range.
### 🦋 Endocrinologist
TSH is within range, so a thyroid problem is less likely. Vitamin D is now within range too — its drop in winter often causes tiredness.
### 🩸 Haematologist
Ferritin and haemoglobin are back in range. Checking iron stores again in 3–6 months is worthwhile${women ? ', especially with heavy periods' : ''}.
### 🧠 Neurologist
Dizziness when standing up quickly is often a brief drop in blood pressure. Warning signs — fainting, trouble speaking or seeing — need an urgent check.

## Overall conclusion
The specialists agree the tests do not point to a worrying cause. Start with sleep, fluids and regular meals, and keep a symptom diary for 2 weeks.

## Recommended tests
1. **Blood pressure lying and standing** — to find the cause of the dizziness.
2. **Ferritin in 3 months** — to keep iron stores up.
3. **A family doctor visit** — if things do not improve in 2 weeks.`;
  }
  return `## კონსილიუმის შემადგენლობა
თერაპევტი, ენდოკრინოლოგი, ჰემატოლოგი, ნევროლოგი.

## სპეციალისტების მოსაზრებები
### 🩺 თერაპევტი
ხანგრძლივი დაღლილობის ყველაზე ხშირი მიზეზებია ცოტა ძილი, სტრესი და არარეგულარული კვება. შენი ბოლო ანალიზები მშვიდ სურათს აჩვენებს — სისხლის საერთო ანალიზი ნორმაშია.
### 🦋 ენდოკრინოლოგი
TSH ნორმაშია, ამიტომ ფარისებრი ჯირკვლის პრობლემა ნაკლებად სავარაუდოა. ვიტამინი D ახლა ნორმაშია — ზამთარში მისი დაქვეითება ხშირად იწვევს დაღლილობას.
### 🩸 ჰემატოლოგი
ფერიტინი და ჰემოგლობინი ნორმას დაუბრუნდა. რკინის მარაგის შემოწმება 3–6 თვეში ღირს${women ? ', განსაკუთრებით უხვი მენსტრუაციისას' : ''}.
### 🧠 ნევროლოგი
თავბრუსხვევა, რომელიც ფეხზე სწრაფად წამოდგომისას ჩნდება, ხშირად წნევის ხანმოკლე დაქვეითებაა. საგანგაშო ნიშნებს — გულის წასვლას, მეტყველების ან მხედველობის დარღვევას — სასწრაფო შეფასება სჭირდება.

## საერთო დასკვნა
სპეციალისტები თანხმდებიან, რომ ანალიზები საგანგაშო მიზეზზე არ მიუთითებს. პირველ რიგში ღირს ძილის, სითხისა და კვების რეჟიმის მოწესრიგება და 2 კვირის განმავლობაში სიმპტომების დღიურის წარმოება.

## რეკომენდებული გამოკვლევები
1. **არტერიული წნევა წოლით და დგომით** — თავბრუსხვევის მიზეზის დასაზუსტებლად.
2. **ფერიტინი 3 თვეში** — რკინის მარაგის შესანარჩუნებლად.
3. **ოჯახის ექიმთან ვიზიტი** — თუ 2 კვირაში მდგომარეობა არ გაუმჯობესდა.`;
}

const TOPICS = [
  ['vitd', /ვიტამინ\S*\s*d|vitamin\s*d/i],
  ['headache', /თავ\S*\s.*ტკივ|თავი\s.*მტკივა|თავის ტკივ|headache|my head/i],
  ['cholesterol', /ქოლესტერინ|ლიპიდ|\bldl\b|cholesterol|lipid/i],
  ['glucose', /გლუკოზ|შაქარ|hba1c|glucose|blood sugar/i],
  ['fatigue', /დაღლ|თავბრუ|ფერიტინ|რკინ|tired|dizz|ferritin|fatigue|iron/i],
];
const topicOf = (text) => TOPICS.find(([, re]) => re.test(text))?.[0] ?? null;

/** Pick the clinical answer for a question (+ the MEDISCAN context or the session's earlier turns). */
function answerFor(rq, message, mode, context, history) {
  if (mode === 'CONSILIUM') {
    const all = `${message} ${history.map((m) => m.content).join(' ')}`;
    return consiliumAnswer(rq, /ქოლესტერინ|ლიპიდ|ldl|გლუკოზ|შაქარ|წონ|cholesterol|glucose|weight|sugar/i.test(all) && !/დაღლ|თავბრუ|tired|dizz/i.test(message) ? 'metabolic' : 'general');
  }
  const priorUser = history.filter((m) => m.role === 'user');
  let topic = topicOf(message);
  if (!topic && context) {
    const lines = String(context).split(/\n\s*\nReview:/)[0].split('\n');
    const off = lines
      .map((line) => /^(.+?):\s+(\S+)\s+(\S+).*\[(high|low)\]\s*$/.exec(line))
      .filter(Boolean)
      .map((m) => ({ name: m[1], value: `${m[2]} ${m[3]}` }));
    const total = lines.filter((line) => /^[^:]+:\s+\S+/.test(line) && !/^Lab results|^Review/i.test(line)).length;
    if (/^Lab results/m.test(context)) return doctorAnswer(rq, 'results', { off, total });
  }
  if (!topic && priorUser.length) {
    const earlier = topicOf(priorUser[0].content);
    return doctorAnswer(rq, earlier === 'vitd' ? 'vitd-followup' : 'followup');
  }
  return doctorAnswer(rq, topic ?? 'default');
}

// ---------------------------------------------------------------------------------------------
// Saved conversations
// ---------------------------------------------------------------------------------------------
const buildTitle = (message) => {
  const clean = String(message).replace(/\s+/g, ' ').trim();
  return clean.length <= 48 ? clean : `${clean.slice(0, 45)}…`;
};
const assistantTitle = (turns) => {
  const first = turns.find((x) => x.role === 'user')?.content?.replace(/\s+/g, ' ').trim() || 'საუბარი Medi-სთან';
  return first.length <= 60 ? first : `${first.slice(0, 57)}…`;
};

export function chatIds(persona) {
  const who = persona === 'man' ? 'man' : 'women';
  return {
    thread: uuidFrom(`chat:${who}:thread`),
    threadDoctor: uuidFrom(`chat:${who}:thread-doctor`),
    consilium: uuidFrom(`chat:${who}:consilium`),
    visit: uuidFrom(`chat:${who}:visit`),
    headache: uuidFrom(`chat:${who}:headache`),
  };
}

function seedSessions(state, ctx) {
  const today = ctx.today;
  const uid = userIdOf(state);
  const ids = chatIds(ctx.persona);
  const rq = { lang: 'ka', persona: ctx.persona, state };
  const man = ctx.persona === 'man';
  const at = (offset, hhmm) => isoAt(addDays(today, offset), hhmm);
  const msg = (role, content, timestamp, extra = {}) => ({ role, content, timestamp, ...extra });

  const q1 = man ? 'უზმოზე გლუკოზა 5.8 მაქვს — უნდა ვინერვიულო?' : 'ვიტამინი D-ს დოზა ახლა შევამცირო?';
  const a1 = doctorAnswer(rq, man ? 'glucose' : 'vitd');
  const q2 = man ? 'კი, 10 საათი არაფერი მიჭამია.' : 'დღეში 2000 ერთეულს ვიღებ.';
  const a2 = man
    ? 'მაშინ შედეგი სანდოა. ერთი ოდნავ მომატებული გაზომვა დიაგნოზი არ არის, მაგრამ კარგი მიზეზია, რომ ექიმმა HbA1c შეამოწმოს. შენი წონის კლება და ყოველდღიური სიარული ზუსტად ის ნაბიჯებია, რომლებიც გლუკოზას ყველაზე მეტად ეხმარება. გინდა, ოჯახის ექიმთან ვიზიტი ჩაგიწერო შეხსენებით?'
    : doctorAnswer(rq, 'vitd-followup');

  const doctorThread = {
    id: ids.threadDoctor, userId: uid, title: buildTitle(q1), mode: 'DOCTOR',
    messages: [
      msg('user', q1, at(-11, '09:14')),
      msg('assistant', a1, at(-11, '09:14'), { interactionId: uuidFrom(`ia:${ids.threadDoctor}:1`) }),
      msg('user', q2, at(-11, '09:16')),
      msg('assistant', a2, at(-11, '09:16'), { interactionId: uuidFrom(`ia:${ids.threadDoctor}:2`) }),
    ],
    createdAt: at(-11, '09:14'), updatedAt: at(-11, '09:16'),
  };
  const thread = {
    id: ids.thread, userId: uid, title: assistantTitle([{ role: 'user', content: q1 }]), mode: 'ASSISTANT',
    messages: [
      msg('user', q1, at(-11, '09:14')),
      msg('assistant', a1, at(-11, '09:14'), { kind: 'answer', linkedSessionId: ids.threadDoctor }),
      msg('user', q2, at(-11, '09:16')),
      msg('assistant', a2, at(-11, '09:16'), { kind: 'answer', linkedSessionId: ids.threadDoctor }),
    ],
    createdAt: at(-11, '09:14'), updatedAt: at(-11, '09:16'),
  };
  const cq = man ? 'LDL და გლუკოზა ოდნავ მაღალი მაქვს — რა ვქნა?' : 'ხშირად მაქვს დაღლილობა და თავბრუსხვევა';
  const consilium = {
    id: ids.consilium, userId: uid, title: buildTitle(cq), mode: 'CONSILIUM',
    messages: [
      msg('user', cq, at(-40, '20:31')),
      msg('assistant', consiliumAnswer(rq, man ? 'metabolic' : 'general'), at(-40, '20:32'), { interactionId: uuidFrom(`ia:${ids.consilium}:1`) }),
    ],
    createdAt: at(-40, '20:31'), updatedAt: at(-40, '20:32'),
  };
  // The visit health.mjs seeds (created 3 days ago at 20:14) was added from this conversation.
  const seededVisit = (state.visits ?? []).find((v) => v.active !== false) ?? null;
  const KA_DATIVE = ['იანვარს', 'თებერვალს', 'მარტს', 'აპრილს', 'მაისს', 'ივნისს', 'ივლისს', 'აგვისტოს', 'სექტემბერს', 'ოქტომბერს', 'ნოემბერს', 'დეკემბერს'];
  const vDate = seededVisit?.visitDate ?? addDays(today, 5);
  const vTime = seededVisit?.visitTime ?? '11:30';
  const vWho = { GYN: 'გინეკოლოგთან', CARDIO: 'კარდიოლოგთან', GP: 'ოჯახის ექიმთან', DENTIST: 'სტომატოლოგთან' }[seededVisit?.doctorType] ?? 'ექიმთან';
  const vq = `${Number(vDate.slice(8, 10))} ${KA_DATIVE[Number(vDate.slice(5, 7)) - 1]} ${vTime}-ზე ${vWho} ვიზიტი მაქვს`;
  const visit = {
    id: ids.visit, userId: uid, title: assistantTitle([{ role: 'user', content: vq }]), mode: 'ASSISTANT',
    messages: [
      msg('user', vq, at(-3, '20:12')),
      msg('assistant', 'ვიზიტს პირად კალენდარში ჩავწერ — ეს კლინიკაში ჯავშანი არ არის. გადაამოწმე და შეინახე.', at(-3, '20:12')),
      msg('assistant', 'შენახულია.', at(-3, '20:14')),
    ],
    createdAt: at(-3, '20:12'), updatedAt: at(-3, '20:14'),
  };
  const hq = 'თავი 3 დღეა მტკივა — რატომ?';
  const headache = {
    id: ids.headache, userId: uid, title: buildTitle(hq), mode: 'DOCTOR',
    messages: [
      msg('user', hq, at(-65, '08:40')),
      msg('assistant', doctorAnswer(rq, 'headache'), at(-65, '08:41'), { interactionId: uuidFrom(`ia:${ids.headache}:1`) }),
    ],
    createdAt: at(-65, '08:40'), updatedAt: at(-65, '08:41'),
  };
  return [visit, thread, doctorThread, consilium, headache];
}

function lastAssistantPreview(messages) {
  if (!Array.isArray(messages)) return '';
  const last = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!last?.content) return '';
  const clean = last.content.replace(/[#*`>\-\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length <= 100 ? clean : `${clean.slice(0, 97)}…`;
}

function linkedConsultationIds(sessions) {
  const ids = new Set();
  for (const s of sessions) {
    if (s.mode !== 'ASSISTANT' || !Array.isArray(s.messages)) continue;
    for (const m of s.messages) if (m && typeof m.linkedSessionId === 'string') ids.add(m.linkedSessionId);
  }
  return ids;
}

function mediState(state) {
  if (!state.medi) init(state, { persona: state.persona || 'women', today: state.createdForDay || new Date().toISOString().slice(0, 10) });
  return state.medi;
}

export function init(state, ctx) {
  state.medi = { sessions: seedSessions(state, ctx), operations: {}, planDelayMs: 700, answerDelayMs: 1100, deepDelayMs: 2200 };
}

// ---------------------------------------------------------------------------------------------
// Planner (rule-based stand-in for the model; replies in the server's voice and shapes)
// ---------------------------------------------------------------------------------------------
const MED_NAMES = [
  [/ვიტამინ\S*\s*d3?|vitamin\s*d3?/i, 'ვიტამინი D3', 'Vitamin D3'],
  [/მაგნიუმ|magnesium/i, 'მაგნიუმი B6', 'Magnesium B6'],
  [/ომეგა|omega/i, 'ომეგა-3', 'Omega-3'],
  [/მეტფორმინ|metformin/i, 'მეტფორმინი', 'Metformin'],
  [/ფოლიუმ|folic/i, 'ფოლიუმის მჟავა', 'Folic acid'],
  [/რკინ|\biron\b/i, 'რკინა', 'Iron'],
  [/იბუპროფენ|ibuprofen/i, 'იბუპროფენი', 'Ibuprofen'],
];
const DOCTOR_TYPES = [
  [/ოჯახის ექიმ|თერაპევტთან|family doctor|\bgp\b/i, 'GP'],
  [/კარდიოლოგ|cardiolog/i, 'CARDIO'],
  [/სტომატოლოგ|კბილ|dentist/i, 'DENTIST'],
  [/გინეკოლოგ|gyn/i, 'GYN'],
  [/ნევროლოგ|neurolog/i, 'NEURO'],
  [/ორთოპედ|orthop/i, 'ORTHO'],
  [/თერაპევტ|internist|therapist/i, 'THERAPIST'],
  [/ოფთალმოლოგ|თვალის ექიმ|ophthalm|eye doctor/i, 'OPHTHALMO'],
  [/დერმატოლოგ|dermatolog/i, 'DERM'],
  [/პედიატრ|pediatric/i, 'PED'],
];
const pad = (n) => String(n).padStart(2, '0');

function timeFrom(text) {
  const clock = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/.exec(text);
  let hour = null;
  let minute = 0;
  if (clock) {
    hour = Number(clock[1]);
    minute = Number(clock[2]);
  } else {
    const ka = /(\d{1,2})\s*(?:-?ზე|\s*საათზე)/u.exec(text);
    const en = /\bat\s+(\d{1,2})(?:\s*(am|pm))?\b/i.exec(text);
    if (ka) hour = Number(ka[1]);
    else if (en) {
      hour = Number(en[1]);
      if (en[2]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
    }
  }
  if (hour == null || hour > 23) return null;
  if (hour < 12 && /საღამოს|ღამის|evening|\bpm\b/i.test(text)) hour += 12;
  return `${pad(hour)}:${pad(minute)}`;
}

function dateFrom(text, today) {
  if (/ზეგ|day after tomorrow/i.test(text)) return addDays(today, 2);
  if (/ხვალ|tomorrow/i.test(text)) return addDays(today, 1);
  if (/დღეს|today/i.test(text)) return today;
  return null;
}

function doseFrom(text) {
  const unit = /(\d+(?:[.,]\d+)?)\s*(მგ|mg|სე|iu|IU|მკგ|mcg|ერთეულ\S*)/u.exec(text);
  if (unit) return `${unit[1].replace(',', '.')} ${/ერთეულ/.test(unit[2]) ? 'IU' : unit[2].toLowerCase() === 'iu' ? 'IU' : unit[2]}`;
  const count = /(\d+|ერთი|ორი|სამი)\s*(ტაბლეტ\S*|კაფსულ\S*|აბ\S*|tablets?|capsules?)/iu.exec(text);
  if (count) {
    const n = { ერთი: 1, ორი: 2, სამი: 3 }[count[1]] ?? Number(count[1]);
    const capsule = /კაფსულ|capsule/i.test(count[2]);
    return /[a-z]/i.test(count[2]) ? `${n} ${capsule ? 'capsule' : 'tablet'}${n > 1 ? 's' : ''}` : `${n} ${capsule ? 'კაფსულა' : 'ტაბლეტი'}`;
  }
  return null;
}

function accountMed(state, kaName) {
  const meds = state.meds?.medications ?? [];
  return meds.find((m) => m.active !== false && m.medName === kaName) ?? null;
}

function humanDay(rq, ymd) {
  if (ymd === rq.today) return t(rq, 'დღეიდან', 'from today');
  if (ymd === addDays(rq.today, 1)) return t(rq, 'ხვალიდან', 'from tomorrow');
  const months = rq.lang === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['იანვრიდან', 'თებერვლიდან', 'მარტიდან', 'აპრილიდან', 'მაისიდან', 'ივნისიდან', 'ივლისიდან', 'აგვისტოდან', 'სექტემბრიდან', 'ოქტომბრიდან', 'ნოემბრიდან', 'დეკემბრიდან'];
  const [, m, d] = ymd.split('-').map(Number);
  return rq.lang === 'en' ? `from ${months[m - 1]} ${d}` : `${d} ${months[m - 1]}`;
}

function sealToken(plan) {
  return `mock.${Buffer.from(JSON.stringify(plan)).toString('base64url')}`;
}
function openToken(token) {
  if (typeof token !== 'string' || !token.startsWith('mock.')) return null;
  try {
    return JSON.parse(Buffer.from(token.slice(5), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** reviewFor(): a signed, validated action card. */
function reviewFor(rq, action) {
  const v = validated(action);
  const plan = { id: uuidFrom(`plan:${rq.state.resetAt}:${Date.now()}:${Math.random()}`), scope: 'human', today: rq.today, tool: v.tool, args: v.args };
  return { id: plan.id, scope: 'human', tool: plan.tool, args: plan.args, label: toolLabel(plan.tool, rq.lang), token: sealToken(plan) };
}

function draftFor(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.tool !== 'string') return null;
  const args = raw.args && typeof raw.args === 'object' ? { ...raw.args } : {};
  return { tool: raw.tool, args };
}

const WRITE_INTENT = /ჩამიწერე|შემახსენე|დამიმატე|დაამატე|შეხსენებ|ჩაწერე|remind|\badd\b|\blog\b/i;
const MED_WORD = /წამალ|წამლ|მედიკამენტ|ტაბლეტ|კაფსულ|ვიტამინ|medicine|medication|pill|vitamin/i;
const HEALTH_QUESTION =
  /\?|რატომ|რას ნიშნავს|ნორმაა|ხომ არ|მტკივა|ტკივ|სიმპტომ|რა ვქნა|ვინერვიულო|საშიშ|დაღლ|თავბრუ|სიცხ|ცხელებ|ხველ|წნევ|ქოლესტერინ|ფერიტინ|გლუკოზ|ანალიზ|შედეგ|დოზა|გვერდით|ჰემოგლობინ|შევამცირო|why|what does|should i|\bpain\b|hurt|symptom|worried/i;

function medicationPlan(rq, draft, text) {
  const args = { ...(draft?.args ?? {}) };
  const named = MED_NAMES.find(([re]) => re.test(text));
  if (named) {
    const own = accountMed(rq.state, named[1]);
    args.medName = rq.lang === 'en' ? named[2] : named[1];
    // Known account facts may be copied (planner rules): the dose she already takes.
    if (own && !args.dosage) args.dosage = rq.lang === 'en' ? own.dosage.replace('ტაბლეტი', 'tablet') : own.dosage;
  }
  if (!named && !args.medName) {
    const generic = /(ვიტამინი\s+[A-Za-z0-9]+|vitamin\s+[A-Za-z0-9]+)/iu.exec(text);
    if (generic) args.medName = generic[1];
  }
  const dose = doseFrom(text);
  if (dose) args.dosage = dose;
  const time = timeFrom(text);
  if (time) args.frequency = [time];
  const day = dateFrom(text, rq.today);
  if (day) args.startDate = day;
  const action = { tool: 'medication_add', args };
  const guidance = guidanceFor(action, rq.lang);
  if (guidance?.fields?.length) {
    return { reply: guidance.question || t(rq, 'დარჩენილი დეტალები შევავსოთ.', 'Let’s fill in the remaining details.'), review: null, draft: action, guidance, contextDomains: ['medications'] };
  }
  const review = reviewFor(rq, action);
  const times = review.args.frequency.join(', ');
  const from = review.args.startDate ? `, ${humanDay(rq, review.args.startDate)}` : '';
  const reply = t(
    rq,
    `${review.args.medName} — ${review.args.dosage}, ყოველდღე ${times}-ზე${from}. გადაამოწმე და შეინახე.`,
    `${review.args.medName} — ${review.args.dosage}, every day at ${times}${from}. Check it and save.`,
  );
  return { reply, review, draft: null, suggestions: [], subject: null, guidance: null, contextDomains: ['medications'] };
}

function visitPlan(rq, draft, text) {
  const args = { ...(draft?.args ?? {}) };
  const type = DOCTOR_TYPES.find(([re]) => re.test(text));
  if (type) args.doctorType = type[1];
  const day = dateFrom(text, rq.today);
  if (day) args.visitDate = day;
  const time = timeFrom(text);
  if (time) args.visitTime = time;
  const action = { tool: 'visit_add', args };
  if (!args.doctorType) {
    return {
      reply: t(rq, 'რომელი სპეციალობის ექიმთან გაქვს ვიზიტი?', 'Which kind of doctor is the visit with?'),
      review: null,
      draft: action,
      suggestions: t(
        rq,
        [{ label: 'ოჯახის ექიმი', text: 'ოჯახის ექიმთან' }, { label: 'კარდიოლოგი', text: 'კარდიოლოგთან' }, { label: 'სტომატოლოგი', text: 'სტომატოლოგთან' }],
        [{ label: 'Family doctor', text: 'With my family doctor' }, { label: 'Cardiologist', text: 'With a cardiologist' }, { label: 'Dentist', text: 'With the dentist' }],
      ),
      guidance: guidanceFor(action, rq.lang),
      contextDomains: ['visits'],
    };
  }
  if (!args.visitDate || !args.visitTime) {
    return { reply: t(rq, 'რომელ დღეს და რომელ საათზე გაქვს ვიზიტი?', 'Which day and at what time is the visit?'), review: null, draft: action, guidance: guidanceFor(action, rq.lang), contextDomains: ['visits'] };
  }
  return {
    reply: t(rq, 'ვიზიტს პირად კალენდარში ჩავწერ — ეს კლინიკაში ჯავშანი არ არის. გადაამოწმე და შეინახე.', 'I’ll put the visit in your personal calendar — this is not a booking at the clinic. Check it and save.'),
    review: reviewFor(rq, action),
    draft: null,
    suggestions: [],
    guidance: null,
    contextDomains: ['visits'],
  };
}

function waterPlan(rq, draft, text, history) {
  const ml = /(\d{2,4})\s*(?:მლ|მილილიტრ|ml)/iu.exec(text);
  const glassesNow = /(\d+)\s*(?:ჭიქა|glass)/iu.exec(text);
  const glassesBefore = [...history].reverse().map((h) => (h.role === 'user' ? /(\d+)\s*(?:ჭიქა|glass)/iu.exec(h.content) : null)).find(Boolean);
  const glasses = Number(glassesNow?.[1] ?? glassesBefore?.[1] ?? 1);
  if (ml) {
    const amount = Number(ml[1]) * (glassesNow || (draft && glassesBefore) ? glasses : 1);
    return {
      reply: t(rq, `${amount} მლ წყალს დღევანდელ დღეს ჩავწერ. გადაამოწმე და შეინახე.`, `I’ll log ${amount} ml of water for today. Check it and save.`),
      review: reviewFor(rq, { tool: 'hydration_add', args: { date: rq.today, amountMl: Math.min(5000, amount) } }),
      draft: null,
      guidance: null,
      contextDomains: ['metrics'],
    };
  }
  return {
    reply: t(rq, 'ერთი ჭიქა რამდენი მილილიტრია? მაგალითად, 250 მლ.', 'How many millilitres is one glass? For example, 250 ml.'),
    review: null,
    draft: { tool: 'hydration_add', args: { date: rq.today } },
    suggestions: t(rq, [{ label: '200 მლ', text: '200 მლ' }, { label: '250 მლ', text: '250 მლ' }, { label: '300 მლ', text: '300 მლ' }], [{ label: '200 ml', text: '200 ml' }, { label: '250 ml', text: '250 ml' }, { label: '300 ml', text: '300 ml' }]),
    guidance: { fields: ['amountMl'], question: null },
    contextDomains: ['metrics'],
  };
}

function planReply(rq) {
  const body = rq.body && typeof rq.body === 'object' ? rq.body : {};
  const text = String(body.text ?? '').trim();
  const history = Array.isArray(body.history) ? body.history.filter((h) => h && typeof h.content === 'string') : [];
  const draft = draftFor(body.draft);

  // 1. A draft waiting for its missing fields (the next answer fills it).
  if (draft?.tool === 'medication_add') return medicationPlan(rq, draft, text);
  if (draft?.tool === 'visit_add') return visitPlan(rq, draft, text);
  if (draft?.tool === 'hydration_add') return waterPlan(rq, draft, text, history);

  // 2. Exact navigation commands („გახსენი წყალი“) — the server's literal path.
  const nav = KNOWLEDGE?.literalAssistantNavigation?.({ text, scope: 'human', draft: null });
  if (nav) {
    return { reply: t(rq, 'შესაბამისი გვერდი მზადაა გასახსნელად.', 'The page is ready to open.'), review: reviewFor(rq, nav), draft: null, guidance: { fields: [], question: null }, contextDomains: [] };
  }

  // 3. Explicit consilium / deep analysis request.
  if (/კონსილიუმ|ღრმა ანალიზ|consilium|deep analysis/i.test(text)) {
    return { reply: t(rq, 'ამას კონსილიუმი განიხილავს.', 'The consilium will look at this.'), review: reviewFor(rq, { tool: 'consult', args: { mode: 'CONSILIUM', message: text } }), draft: null, suggestions: [], guidance: null, contextDomains: ['profile'] };
  }

  // 4. Writes: medication reminder, doctor visit, water.
  const medNamed = MED_NAMES.some(([re]) => re.test(text));
  if (WRITE_INTENT.test(text) && (medNamed || MED_WORD.test(text))) return medicationPlan(rq, null, text);
  if (/ვიზიტ|ექიმთან|appointment|doctor'?s? visit|visit/i.test(text) && (dateFrom(text, rq.today) || timeFrom(text) || /მაქვს|have/i.test(text))) return visitPlan(rq, null, text);
  if (/წყალ|water/i.test(text) && /\d/.test(text)) return waterPlan(rq, null, text, history);

  // 5. A question about her own health → the clinical model answers in the same thread.
  if (HEALTH_QUESTION.test(text)) {
    return {
      reply: t(rq, 'ამაზე ახლავე მოგწერ ჯანმრთელობის პასუხს.', 'I’ll write a health answer to that now.'),
      review: reviewFor(rq, { tool: 'consult', args: { mode: 'DOCTOR', message: text } }),
      draft: null,
      suggestions: [],
      guidance: null,
      contextDomains: ['profile', 'metrics', 'goals', 'medications', 'visits'],
    };
  }

  // 6. Anything else: a short reply and a few starting points.
  return {
    reply: t(
      rq,
      'შემიძლია წამალი შეხსენებით ჩავწერო, დალეული წყალი ან ექიმთან ვიზიტი აღვრიცხო, ან ვუპასუხო კითხვას შენს ჯანმრთელობაზე. რით დაგეხმარო?',
      'I can add a medicine with a reminder, log water or a doctor visit, or answer a question about your health. What would you like?',
    ),
    review: null,
    draft: null,
    suggestions: t(
      rq,
      [{ label: 'წამლის შეხსენება', text: 'დამიმატე წამლის შეხსენება' }, { label: 'წყლის ჩაწერა', text: 'ჩამიწერე 2 ჭიქა წყალი' }, { label: 'კითხვა ანალიზზე', text: 'რას ნიშნავს ჩემი ბოლო ანალიზი?' }],
      [{ label: 'Medicine reminder', text: 'Add a medicine reminder' }, { label: 'Log water', text: 'Log 2 glasses of water' }, { label: 'Ask about my tests', text: 'What do my latest lab results mean?' }],
    ),
    subject: null,
    guidance: null,
    contextDomains: ['profile', 'metrics', 'goals', 'medications', 'visits'],
  };
}

// ---------------------------------------------------------------------------------------------
// Execute (assistantExecution.js: navigate for handoffs, otherwise the module's own route)
// ---------------------------------------------------------------------------------------------
function nativeAction(plan) {
  const a = plan.args;
  if (plan.tool === 'nutrition_goal' || plan.tool === 'weight_goal') return { route: '/nutrition/goal', nutritionGoal: { ...(a.targetKg != null ? { targetKg: a.targetKg } : {}), ...(a.loseKg != null ? { loseKg: a.loseKg } : {}) } };
  if (plan.tool === 'record_open') return { route: `/record/${a.recordId}` };
  if (plan.tool === 'medication_open') return { route: `/medications/${a.medicationId}` };
  if (plan.tool === 'visit_open') return { route: `/visits/editor?id=${a.visitId}` };
  if (plan.tool === 'open') return { route: DESTINATIONS()[a.destination] ?? '/(tabs)/home' };
  if (plan.tool === 'consult') return { route: `/chat/${a.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}`, message: a.message, mode: a.mode };
  return null;
}

function operation(plan) {
  const a = plan.args;
  if (plan.tool === 'medication_add') {
    const { startDate, endDate, courseDays: _c, ...med } = a;
    return ['POST', '/api/medications', { ...med, frequency: a.frequency.join(','), ...(startDate || endDate ? { config: { frequencyKind: 'daily', ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) } } : {}) }];
  }
  if (plan.tool === 'visit_add') return ['POST', '/api/visits', { ...a, reminderConfig: { enabled: false, offsetsMinutes: [], repeatCount: 1 } }];
  if (plan.tool === 'hydration_add') return ['POST', '/api/health-metrics/sync', { hydrationEvents: [{ clientEventId: `medi:${plan.id}`, date: a.date, deltaMl: a.amountMl }] }];
  if (plan.tool === 'metric_record') return ['POST', '/api/health-metrics/sync', { daily: [{ date: a.date, ...a.values }] }];
  if (plan.tool === 'dose_record') return ['POST', '/api/push/dose-events', { events: [{ ...a, source: 'app', occurredAt: new Date().toISOString() }] }];
  return null;
}

async function dispatch(rq, plan) {
  const op = operation(plan);
  if (!op) return; // other writes are accepted without side effects in the mock
  const [method, path, body] = op;
  const route = healthRoutes.find((r) => (r.method || 'GET').toUpperCase() === method && r.path === path);
  if (!route) return;
  const out = await route.handler({ ...rq, method, path, params: {}, query: {}, body });
  if (out && typeof out.status === 'number' && 'body' in out && out.status >= 400) {
    const error = typeof out.body?.error === 'string' ? out.body.error : t(rq, 'ჩანაწერი ვერ შეინახა.', 'The entry couldn’t be saved.');
    throw Object.assign(new Error(error), { status: out.status, fields: out.body?.fields });
  }
}

// ---------------------------------------------------------------------------------------------
// Catalog choices (assistant.routes.js GET /catalog)
// ---------------------------------------------------------------------------------------------
const SPECIES_EN = { dog: 'Dog', cat: 'Cat', bird: 'Bird', rabbit: 'Rabbit', rodent: 'Rodent', fish: 'Fish', reptile: 'Reptile', horse: 'Horse', other: 'Other' };
function catalogChoices(rq) {
  const choices = {};
  const pets = Array.isArray(rq.state.pets) ? rq.state.pets : [];
  choices.petId = pets.map((p) => ({ value: p.id, label: p.name }));
  try {
    const species = PETS?.publicPetsCatalog?.(rq.lang)?.species ?? [];
    choices.speciesId = species.map((s) => ({ value: s.id, label: t(rq, s.labelKa, SPECIES_EN[s.id] || s.labelKa) }));
    for (const s of species) {
      choices[`breedId:${s.id}`] = [
        ...(s.sentinels ?? []).map((value) => ({ value, label: t(rq, { unknown: 'უცნობია', custom: 'სხვა ჯიში', mixed: 'მეტისი' }, { unknown: 'Unknown', custom: 'Other breed', mixed: 'Mixed' })[value] || value })),
        ...(s.breeds ?? []).map((b) => ({ value: b.id, label: b.label || b.id })),
      ];
    }
  } catch {
    choices.speciesId = [];
  }
  const typeLabel = (type) => t(rq, { LAB: 'ანალიზი', IMAGING: 'გამოსახულება', SKIN: 'კანი', SKINCARE: 'კანის მოვლა' }, { LAB: 'Lab test', IMAGING: 'Imaging', SKIN: 'Skin', SKINCARE: 'Skincare' })[type] || t(rq, 'შედეგი', 'Result');
  choices.recordId = [...(rq.state.records ?? [])]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 20)
    .map((r) => ({ value: r.id, label: `${typeLabel(r.type)} · ${String(r.createdAt).slice(0, 10)}` }));
  choices.medicationId = (rq.state.meds?.medications ?? []).slice(0, 40).map((m) => ({ value: m.id, label: `${m.medName} · ${m.dosage}` }));
  choices.visitId = [...(rq.state.visits ?? [])]
    .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)))
    .slice(0, 40)
    .map((v) => ({ value: v.id, label: `${v.doctorLastName || v.doctorType} · ${v.visitDate} ${v.visitTime}` }));
  for (const pet of choices.petId) choices[`productId:${pet.value}`] = [];
  return choices;
}

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------
const zod400 = (rq, field, message) =>
  rq.reply(400, { error: t(rq, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'), fields: [{ field, message }] });

function sseBody(answer, done) {
  const parts = [];
  const words = answer.split(/(\s+)/);
  let chunk = '';
  for (const w of words) {
    chunk += w;
    if (chunk.length >= 28) {
      parts.push(chunk);
      chunk = '';
    }
  }
  if (chunk) parts.push(chunk);
  return [...parts.map((text) => `data: ${JSON.stringify({ type: 'delta', text })}\n\n`), `data: ${JSON.stringify(done)}\n\n`].join('');
}

const RAW_ROUTES = [
  // QA control (not an app route): pauses that make "ვფიქრობ…" / "პასუხს ვწერ…" visible, in ms.
  {
    method: 'ANY',
    path: '/__medi/config',
    handler: (rq) => {
      const m = mediState(rq.state);
      for (const key of ['planDelayMs', 'answerDelayMs', 'deepDelayMs']) {
        if (rq.query[key] != null && Number.isFinite(Number(rq.query[key]))) m[key] = Math.max(0, Math.min(60000, Number(rq.query[key])));
      }
      return { ok: true, planDelayMs: m.planDelayMs, answerDelayMs: m.answerDelayMs, deepDelayMs: m.deepDelayMs, chats: chatIds(rq.persona) };
    },
  },
  {
    method: 'GET',
    path: '/api/assistant/catalog',
    handler: (rq) => {
      const features = (KNOWLEDGE?.assistantFeatures?.('auto', rq.lang) ?? []).map(({ route: _r, scopes: _s, ...f }) => f);
      const choices = catalogChoices(rq);
      choices.destination = features.map((f) => ({ value: f.id, label: f.label }));
      return {
        tools: publicTools(rq.lang),
        features,
        groups: KNOWLEDGE?.assistantGroups?.(rq.lang) ?? [],
        choices,
        voiceInput: true,
        voiceOutput: true,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/assistant/state',
    handler: (rq) => ({ weightGoal: rq.state.weight?.goal ?? null, stepsGoal: rq.state.appState?.stepsGoal ?? null }),
  },
  {
    method: 'POST',
    path: '/api/assistant/plan',
    handler: async (rq) => {
      const text = String(rq.body?.text ?? '').trim();
      if (!text) return zod400(rq, 'text', 'Too small');
      await sleep(mediState(rq.state).planDelayMs);
      try {
        return planReply(rq);
      } catch (error) {
        if (error?.issues || error?.name === 'ZodError') return zod400(rq, error.issues?.[0]?.path?.join('.') || '', error.issues?.[0]?.message || 'Invalid');
        throw error;
      }
    },
  },
  {
    method: 'POST',
    path: '/api/assistant/prepare',
    handler: (rq) => {
      const action = rq.body?.action;
      if (!action || typeof action.tool !== 'string') return zod400(rq, 'action', 'Required');
      try {
        return { review: reviewFor(rq, { tool: action.tool, args: action.args ?? {} }) };
      } catch (error) {
        const issue = error?.issues?.[0];
        return zod400(rq, issue?.path?.join('.') || '', issue?.message || String(error?.message || 'Invalid'));
      }
    },
  },
  {
    method: 'POST',
    path: '/api/assistant/execute',
    handler: async (rq) => {
      const plan = openToken(rq.body?.token);
      if (!plan || rq.body?.confirmed !== true) {
        return rq.reply(409, { error: t(rq, 'მოქმედების ვადა ამოიწურა. თავიდან გადაამოწმე შევსებული ინფორმაცია.', 'This action has expired. Please check the details again.'), code: 'ASSISTANT_PLAN_EXPIRED' });
      }
      const native = nativeAction(plan);
      if (native) return { status: 'navigate', native, operationId: plan.id };
      const m = mediState(rq.state);
      if (m.operations[plan.id] === 'DONE') return { status: 'saved', replayed: true, operationId: plan.id };
      try {
        await dispatch(rq, plan);
      } catch (error) {
        return rq.reply(error.status || 400, { error: error.message, code: 'ASSISTANT_REJECTED', ...(error.fields ? { fields: error.fields } : {}) });
      }
      m.operations[plan.id] = 'DONE';
      await sleep(350);
      return { status: 'saved', operationId: plan.id };
    },
  },
  // Voice is not used on web; an empty transcript is the server's "nothing heard" answer.
  { method: 'POST', path: '/api/assistant/transcribe', handler: () => ({ text: '' }) },

  // ---- saved conversations (chats.routes.js) ----
  {
    method: 'GET',
    path: '/api/chats',
    handler: (rq) => {
      const sessions = [...mediState(rq.state).sessions].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 50);
      const linked = linkedConsultationIds(sessions);
      return {
        sessions: sessions
          .filter((s) => s.mode === 'ASSISTANT' || !linked.has(s.id))
          .map(({ messages, userId: _u, ...rest }) => ({ ...rest, messageCount: Array.isArray(messages) ? messages.length : 0, preview: lastAssistantPreview(messages) })),
      };
    },
  },
  {
    method: 'POST',
    path: '/api/chats/assistant',
    handler: (rq) => {
      const body = rq.body && typeof rq.body === 'object' ? rq.body : {};
      const turns = (Array.isArray(body.turns) ? body.turns : [])
        .filter((x) => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string' && x.content.trim())
        .slice(0, 40);
      if (!turns.length) return zod400(rq, 'turns', 'Too small');
      const m = mediState(rq.state);
      const now = new Date().toISOString();
      const stamped = turns.map((x) => ({ role: x.role, content: x.content.slice(0, 12000), timestamp: now, ...(x.kind ? { kind: x.kind } : {}), ...(x.linkedSessionId ? { linkedSessionId: x.linkedSessionId } : {}) }));
      let session = body.sessionId ? m.sessions.find((s) => s.id === body.sessionId && s.mode === 'ASSISTANT') : null;
      if (!session) {
        session = { id: typeof body.sessionId === 'string' && body.sessionId.length >= 8 ? body.sessionId : uuidFrom(`thread:${now}:${Math.random()}`), userId: userIdOf(rq.state), mode: 'ASSISTANT', title: assistantTitle(turns), messages: [], createdAt: now, updatedAt: now };
        m.sessions.push(session);
      }
      session.messages = [...session.messages, ...stamped].slice(-200);
      session.updatedAt = now;
      return { sessionId: session.id };
    },
  },
  {
    method: 'GET',
    path: '/api/chats/:id',
    handler: (rq) => {
      const session = mediState(rq.state).sessions.find((s) => s.id === rq.params.id);
      if (!session) return rq.reply(404, { error: t(rq, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
      return { session };
    },
  },
  {
    method: 'DELETE',
    path: '/api/chats/:id',
    handler: (rq) => {
      const m = mediState(rq.state);
      const before = m.sessions.length;
      m.sessions = m.sessions.filter((s) => s.id !== rq.params.id);
      if (m.sessions.length === before) return rq.reply(404, { error: t(rq, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
      return { deleted: true };
    },
  },

  // ---- clinical answer (ai.routes.js POST /query; SSE when `stream: true` or Accept: text/event-stream) ----
  {
    method: 'POST',
    path: '/api/ai/query',
    handler: async (rq) => {
      const body = rq.body && typeof rq.body === 'object' ? rq.body : {};
      const message = String(body.message ?? '').trim();
      if (message.length < 2) return zod400(rq, 'message', t(rq, 'შეკითხვა ძალიან მოკლეა', 'Your question is too short'));
      const mode = body.mode === 'CONSILIUM' ? 'CONSILIUM' : 'DOCTOR';
      const m = mediState(rq.state);
      let session = body.sessionId ? m.sessions.find((s) => s.id === body.sessionId && (s.mode === 'DOCTOR' || s.mode === 'CONSILIUM')) : null;
      const history = Array.isArray(session?.messages) ? session.messages : [];
      const answer = answerFor(rq, message, mode, typeof body.context === 'string' ? body.context : '', history);
      await sleep(mode === 'CONSILIUM' ? m.deepDelayMs : m.answerDelayMs);
      const now = new Date().toISOString();
      const interactionId = uuidFrom(`ia:${now}:${Math.random()}`);
      const turns = [{ role: 'user', content: message, timestamp: now }, { role: 'assistant', content: answer, timestamp: now, interactionId }];
      if (session) {
        session.messages = [...history, ...turns];
        session.updatedAt = now;
      } else {
        session = { id: uuidFrom(`consult:${now}:${Math.random()}`), userId: userIdOf(rq.state), mode, title: buildTitle(message), messages: turns, createdAt: now, updatedAt: now };
        m.sessions.push(session);
      }
      const done = { sessionId: session.id, title: session.title, mode, answer, model: MODEL, engine: 'openrouter', interactionId, usage: usageFor(rq.today) };
      const wantsStream = body.stream === true || String(rq.req?.headers?.accept || '').includes('text/event-stream');
      if (!wantsStream) return done;
      return rq.reply(200, sseBody(answer, { type: 'done', ...done }), {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      });
    },
  },
  {
    method: 'POST',
    path: '/api/ai/feedback',
    handler: (rq) => {
      const { interactionId, rating } = rq.body ?? {};
      if (typeof interactionId !== 'string' || ![1, -1].includes(rating)) return zod400(rq, 'rating', 'Invalid input');
      return { feedback: { id: uuidFrom(`fb:${interactionId}`), interactionId, userId: userIdOf(rq.state), rating, comment: null, createdAt: new Date().toISOString() } };
    },
  },
];

export const routes = RAW_ROUTES.map((route) =>
  String(route.path).startsWith('/api/') ? { ...route, handler: (rq) => unauthorized(rq) ?? route.handler(rq) } : route,
);

export { planReply, answerFor, doctorAnswer, consiliumAnswer };
