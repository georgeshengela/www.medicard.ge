export type ConditionEntry = {
  id: string;
  ka: string;
  /** English label for documents printed in English (health passport). */
  en: string;
  aliases?: readonly string[];
};

/** Common chronic conditions — Georgian labels, Latin aliases for search. */
export const CONDITION_CATALOG: ConditionEntry[] = [
  { id: 'hypertension', ka: 'ჰიპერტენზია', en: 'Hypertension', aliases: ['წნევა', 'მაღალი წნევა', 'hypertension', 'high blood pressure'] },
  { id: 'hypotension', ka: 'ჰიპოტენზია', en: 'Hypotension', aliases: ['დაბალი წნევა', 'hypotension'] },
  { id: 'diabetes', ka: 'დიაბეტი', en: 'Diabetes', aliases: ['შაქრიანი დიაბეტი', 'diabetes'] },
  { id: 'type1_diabetes', ka: '1 ტიპის დიაბეტი', en: 'Type 1 diabetes', aliases: ['type 1', 'insulin'] },
  { id: 'type2_diabetes', ka: '2 ტიპის დიაბეტი', en: 'Type 2 diabetes', aliases: ['type 2'] },
  { id: 'prediabetes', ka: 'პრედიაბეტი', en: 'Prediabetes', aliases: ['prediabetes'] },
  { id: 'asthma', ka: 'ასთმა', en: 'Asthma', aliases: ['asthma'] },
  { id: 'copd', ka: 'ფილტვის ქრონიკული დაავადება', en: 'COPD', aliases: ['copd'] },
  { id: 'chronic_bronchitis', ka: 'ქრონიკული ბრონქიტი', en: 'Chronic bronchitis', aliases: ['bronchitis'] },
  { id: 'allergies', ka: 'ალერგია', en: 'Allergy', aliases: ['allergy', 'allergies'] },
  { id: 'obesity', ka: 'სიმსუქნე', en: 'Obesity', aliases: ['obesity'] },
  { id: 'hyperlipidemia', ka: 'მაღალი ქოლესტერინი', en: 'High cholesterol (hyperlipidemia)', aliases: ['cholesterol', 'ქოლესტერინი'] },
  { id: 'heart_disease', ka: 'გულის იშემიური დაავადება', en: 'Coronary heart disease', aliases: ['ihd', 'cad', 'გულის დაავადება'] },
  { id: 'heart_failure', ka: 'გულის უკმარისობა', en: 'Heart failure', aliases: ['heart failure'] },
  { id: 'arrhythmia', ka: 'არითმია', en: 'Arrhythmia', aliases: ['arrhythmia'] },
  { id: 'atrial_fibrillation', ka: 'წინაგულების ფიბრილაცია', en: 'Atrial fibrillation', aliases: ['afib'] },
  { id: 'stroke', ka: 'ინსულტი', en: 'Stroke', aliases: ['stroke'] },
  { id: 'thrombosis', ka: 'თრომბოზი', en: 'Thrombosis', aliases: ['thrombosis', 'dvt'] },
  { id: 'hypothyroidism', ka: 'ჰიპოთირეოზი', en: 'Hypothyroidism', aliases: ['ფარისებრი', 'thyroid'] },
  { id: 'hyperthyroidism', ka: 'ჰიპერთირეოზი', en: 'Hyperthyroidism', aliases: ['hyperthyroid'] },
  { id: 'anemia', ka: 'ანემია', en: 'Anemia', aliases: ['anemia', 'რკინა'] },
  { id: 'kidney_disease', ka: 'თირკმლის დაავადება', en: 'Chronic kidney disease', aliases: ['ckd', 'kidney'] },
  { id: 'kidney_stones', ka: 'თირკმლის კენჭი', en: 'Kidney stones', aliases: ['stones', 'კენჭი'] },
  { id: 'liver_disease', ka: 'ღვიძლის დაავადება', en: 'Liver disease', aliases: ['liver'] },
  { id: 'hepatitis', ka: 'ჰეპატიტი', en: 'Hepatitis', aliases: ['hepatitis'] },
  { id: 'fatty_liver', ka: 'ღვიძლის ცხიმოვანი დაავადება', en: 'Fatty liver disease', aliases: ['nafld', 'fatty liver'] },
  { id: 'gallstones', ka: 'ნაღვლის კენჭი', en: 'Gallstones', aliases: ['gallstones'] },
  { id: 'gastritis', ka: 'გასტრიტი', en: 'Gastritis', aliases: ['gastritis'] },
  { id: 'ulcer', ka: 'კუჭის წყლული', en: 'Peptic ulcer', aliases: ['ulcer', 'წყლული'] },
  { id: 'gerd', ka: 'რეფლუქსი', en: 'Gastroesophageal reflux (GERD)', aliases: ['gerd', 'reflux'] },
  { id: 'ibs', ka: 'გაღიზიანებული ნაწლავის სინდრომი', en: 'Irritable bowel syndrome', aliases: ['ibs'] },
  { id: 'ibd', ka: 'ნაწლავის ანთებითი დაავადება', en: 'Inflammatory bowel disease', aliases: ['crohn', 'colitis', 'ibd'] },
  { id: 'celiac', ka: 'ცელიაკია', en: 'Celiac disease', aliases: ['celiac', 'gluten'] },
  { id: 'pancreatitis', ka: 'პანკრეატიტი', en: 'Pancreatitis', aliases: ['pancreatitis'] },
  { id: 'migraine', ka: 'შაკიკი', en: 'Migraine', aliases: ['migraine'] },
  { id: 'epilepsy', ka: 'ეპილეფსია', en: 'Epilepsy', aliases: ['epilepsy', 'seizure'] },
  { id: 'depression', ka: 'დეპრესია', en: 'Depression', aliases: ['depression'] },
  { id: 'anxiety', ka: 'შფოთვა', en: 'Anxiety', aliases: ['anxiety'] },
  { id: 'bipolar', ka: 'ბიპოლარული აშლილობა', en: 'Bipolar disorder', aliases: ['bipolar'] },
  { id: 'insomnia', ka: 'უძილობა', en: 'Insomnia', aliases: ['insomnia'] },
  { id: 'sleep_apnea', ka: 'ძილის აპნოე', en: 'Sleep apnea', aliases: ['apnea', 'cpap'] },
  { id: 'chronic_pain', ka: 'ქრონიკული ტკივილი', en: 'Chronic pain', aliases: ['pain'] },
  { id: 'arthritis', ka: 'ართრიტი', en: 'Arthritis', aliases: ['arthritis'] },
  { id: 'rheumatoid_arthritis', ka: 'რევმატოიდული ართრიტი', en: 'Rheumatoid arthritis', aliases: ['ra', 'rheumatoid'] },
  { id: 'osteoarthritis', ka: 'ოსტეოართრიტი', en: 'Osteoarthritis', aliases: ['osteoarthritis'] },
  { id: 'osteoporosis', ka: 'ოსტეოპოროზი', en: 'Osteoporosis', aliases: ['osteoporosis'] },
  { id: 'gout', ka: 'პოდაგრა', en: 'Gout', aliases: ['gout'] },
  { id: 'fibromyalgia', ka: 'ფიბრომიალგია', en: 'Fibromyalgia', aliases: ['fibromyalgia'] },
  { id: 'psoriasis', ka: 'ფსორიაზი', en: 'Psoriasis', aliases: ['psoriasis'] },
  { id: 'eczema', ka: 'ეგზემა', en: 'Eczema', aliases: ['eczema', 'atopic'] },
  { id: 'pcos', ka: 'პოლიკისტოზური საკვერცხეების სინდრომი', en: 'Polycystic ovary syndrome (PCOS)', aliases: ['pcos'] },
  { id: 'endometriosis', ka: 'ენდომეტრიოზი', en: 'Endometriosis', aliases: ['endometriosis'] },
  { id: 'glaucoma', ka: 'გლაუკომა', en: 'Glaucoma', aliases: ['glaucoma'] },
  { id: 'cataract', ka: 'კატარაქტა', en: 'Cataract', aliases: ['cataract'] },
  { id: 'varicose', ka: 'ვარიკოზი', en: 'Varicose veins', aliases: ['varicose'] },
  { id: 'bph', ka: 'პროსტატის გადიდება', en: 'Benign prostatic hyperplasia', aliases: ['bph', 'prostate'] },
  { id: 'scoliosis', ka: 'სქოლიოზი', en: 'Scoliosis', aliases: ['scoliosis'] },
  { id: 'hernia', ka: 'თიაქარი', en: 'Hernia', aliases: ['hernia'] },
  { id: 'lupus', ka: 'წითელი მგლურა', en: 'Systemic lupus erythematosus', aliases: ['lupus'] },
  { id: 'ms', ka: 'გაფანტული სკლეროზი', en: 'Multiple sclerosis', aliases: ['ms', 'sclerosis'] },
  { id: 'parkinson', ka: 'პარკინსონი', en: "Parkinson's disease", aliases: ['parkinson'] },
  { id: 'alzheimer', ka: 'ალცჰაიმერი', en: "Alzheimer's disease", aliases: ['alzheimer', 'dementia'] },
  { id: 'cancer', ka: 'ონკოლოგიური დაავადება', en: 'Cancer', aliases: ['cancer', 'oncology'] },
  { id: 'tuberculosis', ka: 'ტუბერკულოზი', en: 'Tuberculosis', aliases: ['tb', 'tuberculosis'] },
  { id: 'hiv', ka: 'აივ', en: 'HIV', aliases: ['hiv', 'aids'] },
];

export const COMMON_CONDITION_IDS = [
  'hypertension',
  'diabetes',
  'asthma',
  'hypothyroidism',
  'hyperlipidemia',
  'arthritis',
  'migraine',
  'gastritis',
  'anemia',
  'depression',
] as const;

function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u10A0-\u10FF]+/gi, '');
}

function haystack(entry: ConditionEntry) {
  return [entry.ka, entry.id, ...(entry.aliases ?? [])].map(fold).filter(Boolean);
}

export function conditionLabel(entry: ConditionEntry) {
  return entry.ka;
}

export function resolveConditionLabel(value: string) {
  const folded = fold(value);
  if (!folded) return value;
  const found = CONDITION_CATALOG.find((entry) => haystack(entry).includes(folded));
  return found?.ka ?? value;
}

export function searchConditions(query: string, limit = 8): ConditionEntry[] {
  const q = fold(query);
  if (!q) return CONDITION_CATALOG.slice(0, limit);

  const ranked = CONDITION_CATALOG.map((entry) => {
    const fields = haystack(entry);
    let score = 0;
    for (const field of fields) {
      if (field === q) score = Math.max(score, 100);
      else if (field.startsWith(q)) score = Math.max(score, 80 - Math.min(20, field.length - q.length));
      else if (field.includes(q)) score = Math.max(score, 40);
    }
    return { entry, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.ka.localeCompare(b.entry.ka, 'ka'));

  return ranked.slice(0, limit).map((row) => row.entry);
}

export function commonConditions() {
  return COMMON_CONDITION_IDS.map((id) => CONDITION_CATALOG.find((entry) => entry.id === id)).filter(
    (entry): entry is ConditionEntry => Boolean(entry),
  );
}

export function hasCondition(list: string[], name: string) {
  const needle = fold(resolveConditionLabel(name));
  return list.some((item) => fold(resolveConditionLabel(item)) === needle);
}

/** English label for a stored condition (catalog label, id or alias); free text comes back unchanged. */
export function conditionEnglishLabel(value: string): string {
  const folded = fold(value);
  if (!folded) return value;
  const found = CONDITION_CATALOG.find((entry) => fold(entry.ka) === folded || fold(entry.id) === folded || fold(entry.en) === folded)
    ?? CONDITION_CATALOG.find((entry) => haystack(entry).includes(folded));
  return found?.en ?? value;
}
