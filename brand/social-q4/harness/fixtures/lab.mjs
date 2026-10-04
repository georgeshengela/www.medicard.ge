// MEDILAB data: three lab sheets over ~10 months (CBC + biochemistry), the saved reports list and a skin check.
//
// Where the app reads it (mobile):
//   useLab() → pullLabPanels() → pullAccountState() → GET /api/account/app-state `state.labPanels`
//     (served by health.mjs from `state.appState.labPanels`; this module only fills that slice — its init
//     runs after health.mjs because fixtures load alphabetically). LabPanel / LabParameter: mobile/src/types/lab.ts.
//   Records tab „ჩანაწერები“ → GET /api/records (health.mjs serves `state.records`; filled here).
//   Records tab „საუბრები“ → GET /api/chats (medi.mjs).
// Keys are the canonical lab keys (mobile/src/lib/labNames.ts LAB_TITLE_CATALOG): /lab/param/vitamin_d,
// /lab/param/hemoglobin, … Server shapes: server/src/lib/appState.js (sanitizeLabPanel), records.routes.js.
// Stored text (analyses, record previews) is Georgian, as it would be for a Georgian account.
import { addDays, clone, isoAt } from '../lib.mjs';
import { uuidFrom, userIdOf } from './_mockkit.mjs';

/** Days before "today" for the three sheets: ~10 months, ~5 months and 12 days ago. */
export const LAB_OFFSETS = [-296, -158, -12];

// key → names (catalog titles), unit and the printed reference range per persona [low, high].
const DEF = {
  hemoglobin: { ka: 'ჰემოგლობინი', en: 'Hemoglobin', unit: 'g/L', women: [120, 150], man: [130, 170] },
  rbc: { ka: 'ერითროციტები', en: 'RBC', unit: '10¹²/L', women: [3.8, 5.1], man: [4.3, 5.7] },
  wbc: { ka: 'ლეიკოციტები', en: 'WBC', unit: '10⁹/L', both: [4.0, 9.0] },
  plt: { ka: 'თრომბოციტები', en: 'Platelets', unit: '10⁹/L', both: [150, 400] },
  hct: { ka: 'ჰემატოკრიტი', en: 'Hematocrit', unit: '%', women: [36, 46], man: [40, 50] },
  glucose: { ka: 'გლუკოზა', en: 'Glucose', unit: 'mmol/L', both: [3.9, 5.6] },
  cholesterol: { ka: 'საერთო ქოლესტერინი', en: 'Cholesterol', unit: 'mmol/L', both: [0, 5.2] },
  ldl: { ka: 'LDL ქოლესტერინი', en: 'LDL', unit: 'mmol/L', both: [0, 3.0] },
  hdl: { ka: 'HDL ქოლესტერინი', en: 'HDL', unit: 'mmol/L', women: [1.2, null], man: [1.0, null] },
  triglycerides: { ka: 'ტრიგლიცერიდები', en: 'Triglycerides', unit: 'mmol/L', both: [0, 1.7] },
  tsh: { ka: 'თირეოტროპინი', en: 'TSH', unit: 'mIU/L', both: [0.4, 4.0] },
  vitamin_d: { ka: 'ვიტამინი D', en: 'Vitamin D', unit: 'ng/mL', both: [30, 100] },
  ferritin: { ka: 'ფერიტინი', en: 'Ferritin', unit: 'ng/mL', women: [15, 150], man: [30, 400] },
  vitamin_b12: { ka: 'ვიტამინი B12', en: 'Vitamin B12', unit: 'pg/mL', both: [187, 883] },
  alt: { ka: 'ალანინამინოტრანსფერაზა', en: 'ALT', unit: 'U/L', women: [0, 33], man: [0, 41] },
  ast: { ka: 'ასპარტატამინოტრანსფერაზა', en: 'AST', unit: 'U/L', women: [0, 32], man: [0, 40] },
  creatinine: { ka: 'კრეატინინი', en: 'Creatinine', unit: 'µmol/L', women: [45, 84], man: [62, 106] },
};

/** Printed values per sheet (oldest → newest). Strings are what the sheet shows; the number is parsed from it. */
const VALUES = {
  women: [
    { hemoglobin: '118', rbc: '4.08', wbc: '6.2', plt: '238', hct: '36.1', glucose: '5.1', tsh: '2.1', vitamin_d: '18', ferritin: '14' },
    {
      hemoglobin: '124', rbc: '4.31', wbc: '5.8', plt: '251', hct: '37.4', glucose: '5.0',
      cholesterol: '5.1', ldl: '2.9', hdl: '1.5', triglycerides: '1.1', tsh: '1.8', vitamin_d: '24', ferritin: '22', vitamin_b12: '312',
    },
    {
      hemoglobin: '129', rbc: '4.42', wbc: '6.4', plt: '246', hct: '38.9', glucose: '4.9',
      cholesterol: '5.4', ldl: '3.4', hdl: '1.6', triglycerides: '1.2', tsh: '2.3', vitamin_d: '34', ferritin: '31', vitamin_b12: '428',
      alt: '21', ast: '22', creatinine: '71',
    },
  ],
  man: [
    { hemoglobin: '148', rbc: '4.98', wbc: '6.9', plt: '241', hct: '44.1', glucose: '6.0', tsh: '1.7', vitamin_d: '18', ferritin: '96' },
    {
      hemoglobin: '151', rbc: '5.05', wbc: '6.6', plt: '235', hct: '44.6', glucose: '5.7',
      cholesterol: '5.3', ldl: '3.4', hdl: '1.0', triglycerides: '1.9', tsh: '2.0', vitamin_d: '24', ferritin: '104', vitamin_b12: '352',
    },
    {
      hemoglobin: '153', rbc: '5.12', wbc: '7.1', plt: '228', hct: '45.2', glucose: '5.8',
      cholesterol: '5.1', ldl: '3.3', hdl: '1.1', triglycerides: '1.6', tsh: '1.9', vitamin_d: '34', ferritin: '112', vitamin_b12: '380',
      alt: '34', ast: '27', creatinine: '88',
    },
  ],
};

const DISCLAIMER = 'ეს დიაგნოზი არ არის — შედეგები შენს ექიმთან განიხილე.';

/** Medi's written explanation stored with each sheet (what POST /api/ai/explain-lab returned back then). */
const ANALYSIS = {
  women: [
    `სამი მაჩვენებელი ნორმაზე ოდნავ დაბალია: ვიტამინი D, ფერიტინი და ჰემოგლობინი. დანარჩენი ნორმაშია.

## რას მიაქციო ყურადღება
- **ვიტამინი D — 18 ng/mL** (ნორმა 30–100) დაბალია. ზამთრის თვეებში ეს ხშირია.
- **ფერიტინი — 14 ng/mL** (ნორმა 15–150) და **ჰემოგლობინი — 118 g/L** (ნორმა 120–150) ოდნავ დაბალია — ეს რკინის მარაგის შემცირებაზე შეიძლება მიუთითებდეს.

## რა არის კარგად
- ლეიკოციტები, თრომბოციტები, გლუკოზა და თირეოტროპინი (TSH) ნორმაშია.

## რა ჰკითხო ექიმს
- საჭიროა თუ არა ვიტამინი D-ს და რკინის დანამატი და რა დოზით?
- როდის გავიმეორო ანალიზი?

${DISCLAIMER}`,
    `სისხლის საერთო ანალიზი და ლიპიდები ნორმაშია. ვიტამინი D ჯერ ისევ ნორმაზე დაბალია, თუმცა წინა ანალიზთან შედარებით გაიზარდა.

## რას მიაქციო ყურადღება
- **ვიტამინი D — 24 ng/mL** (ნორმა 30–100): ჯერ ისევ დაბალია, მაგრამ 18-დან გაიზარდა.

## რა არის კარგად
- **ფერიტინი** 14-დან 22 ng/mL-მდე გაიზარდა და ნორმაშია.
- **ჰემოგლობინი** — 124 g/L, ნორმაშია.
- **ვიტამინი B12** და ლიპიდური პროფილი ნორმაშია.

## რა ჰკითხო ექიმს
- ვიტამინი D-ს მიღება როგორ გავაგრძელო და როდის გავიმეორო ანალიზი?

${DISCLAIMER}`,
    `ანალიზების უმეტესობა ნორმაშია, ხოლო ვიტამინი D და ფერიტინი წინა ანალიზთან შედარებით შესამჩნევად გაუმჯობესდა.

## რას მიაქციო ყურადღება
- **საერთო ქოლესტერინი — 5.4 mmol/L** (ნორმა 0–5.2) და **LDL — 3.4 mmol/L** (ნორმა 0–3.0) ოდნავ მაღალია. ეს ხშირად კვებასა და მოძრაობაზეა დამოკიდებული და ჩვეულებრივ 2–3 თვეში მეორდება.

## რა არის კარგად
- **ვიტამინი D** 24-დან 34 ng/mL-მდე გაიზარდა და ახლა ნორმაშია.
- **ფერიტინი** (31 ng/mL) და **ჰემოგლობინი** (129 g/L) ნორმაშია — რკინის მარაგი აღდგა.
- ფარისებრი ჯირკვალი (TSH), ღვიძლი (ALT, AST) და თირკმელი (კრეატინინი) ნორმაშია.

## რა ჰკითხო ექიმს
- ლიპიდური პროფილი როდის გავიმეორო?
- ვიტამინი D-ს დოზა ახლა შევამცირო თუ იგივე დავტოვო?

${DISCLAIMER}`,
  ],
  man: [
    `ორი მაჩვენებელი ნორმის გარეთაა: ვიტამინი D დაბალია, უზმოზე გლუკოზა კი — ოდნავ მაღალი. სისხლის საერთო ანალიზი ნორმაშია.

## რას მიაქციო ყურადღება
- **ვიტამინი D — 18 ng/mL** (ნორმა 30–100) დაბალია. ზამთრის თვეებში ეს ხშირია.
- **გლუკოზა (უზმოზე) — 6.0 mmol/L** (ნორმა 3.9–5.6) მაღალია. ერთი გაზომვა დიაგნოზი არ არის — ექიმი ხშირად განმეორებით ანალიზს ან HbA1c-ს გირჩევს.

## რა არის კარგად
- ჰემოგლობინი, ლეიკოციტები, თრომბოციტები და TSH ნორმაშია.

## რა ჰკითხო ექიმს
- საჭიროა თუ არა HbA1c-ის გაკეთება?
- ვიტამინი D-ს დანამატი რა დოზით და რამდენ ხანს?

${DISCLAIMER}`,
    `გლუკოზა წინა ანალიზთან შედარებით შემცირდა, ვიტამინი D გაიზარდა. ლიპიდებში რამდენიმე მაჩვენებელი ოდნავ მაღალია.

## რას მიაქციო ყურადღება
- **გლუკოზა — 5.7 mmol/L** (ნორმა 3.9–5.6) ოდნავ მაღალია, თუმცა 6.0-დან შემცირდა.
- **საერთო ქოლესტერინი — 5.3**, **LDL — 3.4** და **ტრიგლიცერიდები — 1.9 mmol/L** ნორმის ზედა ზღვარს ოდნავ აღემატება.
- **ვიტამინი D — 24 ng/mL** ჯერ ისევ დაბალია, მაგრამ 18-დან გაიზარდა.

## რა არის კარგად
- სისხლის საერთო ანალიზი, ფერიტინი და ვიტამინი B12 ნორმაშია.

## რა ჰკითხო ექიმს
- კვებისა და მოძრაობის რა ცვლილებები დაეხმარება ლიპიდებს?
- ლიპიდური პროფილი და გლუკოზა როდის გავიმეორო?

${DISCLAIMER}`,
    `ანალიზების უმეტესობა ნორმაშია. ვიტამინი D ნორმას დაუბრუნდა, ტრიგლიცერიდები და საერთო ქოლესტერინი კი შემცირდა.

## რას მიაქციო ყურადღება
- **გლუკოზა (უზმოზე) — 5.8 mmol/L** (ნორმა 3.9–5.6) ოდნავ მაღალია. ერთი გაზომვა დიაგნოზი არ არის — ექიმმა შეიძლება HbA1c გირჩიოს.
- **LDL — 3.3 mmol/L** (ნორმა 0–3.0) ოდნავ მაღალია.

## რა არის კარგად
- **ვიტამინი D** 24-დან 34 ng/mL-მდე გაიზარდა და ნორმაშია.
- **ტრიგლიცერიდები** 1.9-დან 1.6 mmol/L-მდე შემცირდა, **საერთო ქოლესტერინი** ნორმას დაუბრუნდა.
- სისხლის საერთო ანალიზი, ღვიძლი (ALT, AST) და თირკმელი (კრეატინინი) ნორმაშია.

## რა ჰკითხო ექიმს
- ღირს თუ არა HbA1c-ის გაკეთება?
- LDL-ის შესამცირებლად კვების გარდა სხვა რამე მჭირდება?

${DISCLAIMER}`,
  ],
};

const SKIN_ANALYSIS = `ფოტოზე ხალი სიმეტრიულია, ერთგვაროვანი ფერით და მკაფიო კიდეებით — საგანგაშო ნიშნები არ ჩანს.

## რას დააკვირდე
- ზომის, ფორმის ან ფერის ცვლილებას
- ქავილს, სისხლდენას ან ქერქს

## შემდეგი ნაბიჯი
- 3 თვეში იმავე სინათლეზე გადაიღე და შეადარე.
- წელიწადში ერთხელ კანის შემოწმება დერმატოლოგთან.

ეს დიაგნოზი არ არის — ცვლილებას თუ შეამჩნევ, დერმატოლოგს მიმართე.`;

function flagOf(value, low, high) {
  if (low != null && value < low) return 'L';
  if (high != null && value > high) return 'H';
  return low != null || high != null ? 'N' : 'U';
}

/** One LabParameter (mobile/src/types/lab.ts) for a persona. */
export function labParam(persona, key, display) {
  const d = DEF[key];
  const [refLow, refHigh] = d.both ?? d[persona === 'man' ? 'man' : 'women'];
  const value = Number(display);
  return { key, nameKa: d.ka, nameEn: d.en, value, display, unit: d.unit, refLow, refHigh, flag: flagOf(value, refLow, refHigh) };
}

export const LAB_DEFS = DEF;

/** The persona's sheets, newest first (the order server mergeLabPanelLists stores them in), plus their records. */
export function buildLab(persona, today) {
  const who = persona === 'man' ? 'man' : 'women';
  const panels = [];
  const records = [];
  LAB_OFFSETS.forEach((offset, i) => {
    const date = addDays(today, offset);
    const recordId = uuidFrom(`lab-record:${who}:${i}`);
    const analysis = ANALYSIS[who][i];
    panels.push({
      id: `lab-${date}-seed${i + 1}`,
      date,
      createdAt: isoAt(date, '12:40'),
      recordIds: [recordId],
      analysis,
      parameters: Object.entries(VALUES[who][i]).map(([key, display]) => labParam(who, key, display)),
    });
    records.push({ id: recordId, userId: null, type: 'LAB', imageUrl: null, aiAnalysis: analysis, createdAt: isoAt(date, '12:38') });
  });
  const skinDate = addDays(today, -47);
  records.push({ id: uuidFrom(`skin-record:${who}`), userId: null, type: 'SKIN', imageUrl: null, aiAnalysis: SKIN_ANALYSIS, createdAt: isoAt(skinDate, '18:05') });
  panels.sort((a, b) => b.date.localeCompare(a.date));
  return { panels, records };
}

/** Curated explanation for a sheet date, or null (scan.mjs falls back to a generated one). */
export function curatedAnalysis(state, date) {
  return (state.lab?.panels ?? []).find((p) => p.date === date)?.analysis ?? null;
}

export function latestPanel(state) {
  return [...(state.lab?.panels ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export function init(state, ctx) {
  const { panels, records } = buildLab(ctx.persona, ctx.today);
  const uid = userIdOf(state);
  for (const r of records) r.userId = uid;
  state.lab = { panels: clone(panels), seededFor: ctx.today };
  // health.mjs owns /api/account/app-state and /api/records; fill its slices (its init ran first).
  state.appState = state.appState ?? {};
  state.appState.labPanels = clone(panels);
  state.records = [...(state.records ?? []).filter((r) => !records.some((x) => x.id === r.id)), ...records];
}

export const routes = [
  // QA helper (not an app route): the localStorage key the app keeps lab sheets under, if a run wants the
  // very first frame of /records or /lab to already show them (normally they arrive with the app-state pull).
  {
    method: 'GET',
    path: '/__lab/local-seed',
    handler: (rq) => {
      const userId = String(rq.query.userId || userIdOf(rq.state));
      return { userId, keys: { [`medicard.lab.panels.v1.${userId}`]: JSON.stringify(rq.state.appState?.labPanels ?? []) } };
    },
  },
];
