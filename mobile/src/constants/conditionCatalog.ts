export type ConditionEntry = {
  id: string;
  ka: string;
  aliases?: readonly string[];
};

/** Common chronic conditions — Georgian labels, Latin aliases for search. */
export const CONDITION_CATALOG: ConditionEntry[] = [
  { id: 'hypertension', ka: 'ჰიპერტენზია', aliases: ['წნევა', 'მაღალი წნევა', 'hypertension', 'high blood pressure'] },
  { id: 'hypotension', ka: 'ჰიპოტენზია', aliases: ['დაბალი წნევა', 'hypotension'] },
  { id: 'diabetes', ka: 'დიაბეტი', aliases: ['შაქრიანი დიაბეტი', 'diabetes'] },
  { id: 'type1_diabetes', ka: '1 ტიპის დიაბეტი', aliases: ['type 1', 'insulin'] },
  { id: 'type2_diabetes', ka: '2 ტიპის დიაბეტი', aliases: ['type 2'] },
  { id: 'prediabetes', ka: 'პრედიაბეტი', aliases: ['prediabetes'] },
  { id: 'asthma', ka: 'ასთმა', aliases: ['asthma'] },
  { id: 'copd', ka: 'ფილტვის ქრონიკული დაავადება', aliases: ['copd'] },
  { id: 'chronic_bronchitis', ka: 'ქრონიკული ბრონქიტი', aliases: ['bronchitis'] },
  { id: 'allergies', ka: 'ალერგია', aliases: ['allergy', 'allergies'] },
  { id: 'obesity', ka: 'სიმსუქნე', aliases: ['obesity'] },
  { id: 'hyperlipidemia', ka: 'მაღალი ქოლესტერინი', aliases: ['cholesterol', 'ქოლესტერინი'] },
  { id: 'heart_disease', ka: 'გულის იშემიური დაავადება', aliases: ['ihd', 'cad', 'გულის დაავადება'] },
  { id: 'heart_failure', ka: 'გულის უკმარისობა', aliases: ['heart failure'] },
  { id: 'arrhythmia', ka: 'არითმია', aliases: ['arrhythmia'] },
  { id: 'atrial_fibrillation', ka: 'წინაგულების ფიბრილაცია', aliases: ['afib'] },
  { id: 'stroke', ka: 'ინსულტი', aliases: ['stroke'] },
  { id: 'thrombosis', ka: 'თრომბოზი', aliases: ['thrombosis', 'dvt'] },
  { id: 'hypothyroidism', ka: 'ჰიპოთირეოზი', aliases: ['ფარისებრი', 'thyroid'] },
  { id: 'hyperthyroidism', ka: 'ჰიპერთირეოზი', aliases: ['hyperthyroid'] },
  { id: 'anemia', ka: 'ანემია', aliases: ['anemia', 'რკინა'] },
  { id: 'kidney_disease', ka: 'თირკმლის დაავადება', aliases: ['ckd', 'kidney'] },
  { id: 'kidney_stones', ka: 'თირკმლის კენჭი', aliases: ['stones', 'კენჭი'] },
  { id: 'liver_disease', ka: 'ღვიძლის დაავადება', aliases: ['liver'] },
  { id: 'hepatitis', ka: 'ჰეპატიტი', aliases: ['hepatitis'] },
  { id: 'fatty_liver', ka: 'ღვიძლის ცხიმოვანი დაავადება', aliases: ['nafld', 'fatty liver'] },
  { id: 'gallstones', ka: 'ნაღვლის კენჭი', aliases: ['gallstones'] },
  { id: 'gastritis', ka: 'გასტრიტი', aliases: ['gastritis'] },
  { id: 'ulcer', ka: 'კუჭის წყლული', aliases: ['ulcer', 'წყლული'] },
  { id: 'gerd', ka: 'რეფლუქსი', aliases: ['gerd', 'reflux'] },
  { id: 'ibs', ka: 'გაღიზიანებული ნაწლავის სინდრომი', aliases: ['ibs'] },
  { id: 'ibd', ka: 'ნაწლავის ანთებითი დაავადება', aliases: ['crohn', 'colitis', 'ibd'] },
  { id: 'celiac', ka: 'ცელიაკია', aliases: ['celiac', 'gluten'] },
  { id: 'pancreatitis', ka: 'პანკრეატიტი', aliases: ['pancreatitis'] },
  { id: 'migraine', ka: 'შაკიკი', aliases: ['migraine'] },
  { id: 'epilepsy', ka: 'ეპილეფსია', aliases: ['epilepsy', 'seizure'] },
  { id: 'depression', ka: 'დეპრესია', aliases: ['depression'] },
  { id: 'anxiety', ka: 'შფოთვა', aliases: ['anxiety'] },
  { id: 'bipolar', ka: 'ბიპოლარული აშლილობა', aliases: ['bipolar'] },
  { id: 'insomnia', ka: 'უძილობა', aliases: ['insomnia'] },
  { id: 'sleep_apnea', ka: 'ძილის აპნოე', aliases: ['apnea', 'cpap'] },
  { id: 'chronic_pain', ka: 'ქრონიკული ტკივილი', aliases: ['pain'] },
  { id: 'arthritis', ka: 'ართრიტი', aliases: ['arthritis'] },
  { id: 'rheumatoid_arthritis', ka: 'რევმატოიდული ართრიტი', aliases: ['ra', 'rheumatoid'] },
  { id: 'osteoarthritis', ka: 'ოსტეოართრიტი', aliases: ['osteoarthritis'] },
  { id: 'osteoporosis', ka: 'ოსტეოპოროზი', aliases: ['osteoporosis'] },
  { id: 'gout', ka: 'პოდაგრა', aliases: ['gout'] },
  { id: 'fibromyalgia', ka: 'ფიბრომიალგია', aliases: ['fibromyalgia'] },
  { id: 'psoriasis', ka: 'ფსორიაზი', aliases: ['psoriasis'] },
  { id: 'eczema', ka: 'ეგზემა', aliases: ['eczema', 'atopic'] },
  { id: 'pcos', ka: 'პოლიკისტოზური საკვერცხეები', aliases: ['pcos'] },
  { id: 'endometriosis', ka: 'ენდომეტრიოზი', aliases: ['endometriosis'] },
  { id: 'glaucoma', ka: 'გლაუკომა', aliases: ['glaucoma'] },
  { id: 'cataract', ka: 'კატარაქტა', aliases: ['cataract'] },
  { id: 'varicose', ka: 'ვარიკოზი', aliases: ['varicose'] },
  { id: 'bph', ka: 'პროსტატის გადიდება', aliases: ['bph', 'prostate'] },
  { id: 'scoliosis', ka: 'სქოლიოზი', aliases: ['scoliosis'] },
  { id: 'hernia', ka: 'თიაქარი', aliases: ['hernia'] },
  { id: 'lupus', ka: 'წითელი მგლურა', aliases: ['lupus'] },
  { id: 'ms', ka: 'გაფანტული სკლეროზი', aliases: ['ms', 'sclerosis'] },
  { id: 'parkinson', ka: 'პარკინსონი', aliases: ['parkinson'] },
  { id: 'alzheimer', ka: 'ალცჰაიმერი', aliases: ['alzheimer', 'dementia'] },
  { id: 'cancer', ka: 'ონკოლოგიური დაავადება', aliases: ['cancer', 'oncology'] },
  { id: 'tuberculosis', ka: 'ტუბერკულოზი', aliases: ['tb', 'tuberculosis'] },
  { id: 'hiv', ka: 'აივ', aliases: ['hiv', 'aids'] },
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
