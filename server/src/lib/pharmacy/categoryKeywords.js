import { PHARMADEPOT_SUBCATEGORIES } from './categories.js';

/** Keyword hints per unified category slug (Georgian + Latin drug tokens). */
export const CATEGORY_KEYWORDS = {
  immunology: ['იმუნ', 'interferon', 'rituximab', 'adalimumab', 'infliximab', 'etanercept'],
  'ear-drops': ['ყურის', 'otic', 'ear drop', 'otipax', 'otofa'],
  endocrinology: ['ენდოკრ', 'levothyrox', 'thyrox', 'euthyrox', 'thyroid'],
  erectile: ['ერექც', 'sildenafil', 'tadalafil', 'vardenafil', 'viagra', 'cialis'],
  sedatives: ['დამამშვიდ', 'diazepam', 'alprazolam', 'zolpidem', 'melatonin'],
  diabetes: ['დიაბ', 'metformin', 'insulin', 'gliben', 'gliclazide', 'sitagliptin', 'empagliflozin'],
  'eye-drops': ['თვალის', 'eye drop', 'timolol', 'latanoprost', 'tobrex'],
  painkillers: ['ტკივ', 'ibuprofen', 'paracetamol', 'diclofenac', 'ketorolac', 'nurofen', 'analgin'],
  gastro: ['გასტრ', 'omeprazole', 'pantopraz', 'domperidone', 'mesalazine', 'loperamide'],
  antiseptic: ['ანტისეპ', 'chlorhexidine', 'miramistin', 'betadine'],
  corticosteroids: ['კორტიკ', 'prednisol', 'dexameth', 'hydrocortis', 'methylpred'],
  musculoskeletal: ['ძვალ', 'muscle', 'joint', 'diclofenac gel', 'chondroitin', 'glucosamine'],
  allergy: ['ალერგ', 'cetirizine', 'loratadine', 'desloratadine', 'antihist'],
  blood: ['სისხლ', 'warfarin', 'clopidogrel', 'apixaban', 'rivaroxaban', 'ferrous', 'iron'],
  antiinfective: ['ანტიბ', 'amoxicillin', 'azithromycin', 'ciproflox', 'augmentin', 'ceftriax'],
  gynecology: ['გინეკ', 'უროლ', 'contracept', 'estradiol', 'progesterone', 'clotrimazole vag'],
  antiparasitic: ['პარაზ', 'mebendazole', 'albendazole', 'ivermectin'],
  oncology: ['ონკო', 'chemo', 'tamoxifen', 'letrozole', 'imatinib'],
  solvents: ['გამხს', 'saline', 'water for injection', 'natrii chloridi'],
  vitamins: ['ვიტამ', 'vitamin', 'calcium', 'magnesium', 'omega', 'zinc', 'b12', 'd3'],
  nervous: ['ნერვ', 'pregabalin', 'gabapentin', 'carbamazepine', 'levetiracetam', 'sertraline', 'escitalopram'],
  cardio: ['გულ', 'cardio', 'amlodip', 'valsart', 'bisoprolol', 'atorvast', 'rosuvast', 'enalapril', 'losartan', 'perindopril'],
  dermatology: ['დერმ', 'skin', 'derm', 'mometasone cream', 'clotrimazole cream', 'acne'],
  respiratory: ['სასუნთ', 'salbutamol', 'budesonide', 'montelukast', 'ambroxol', 'inhal'],
  'ear-disease': ['ყური', 'otitis', 'ear'],
  hemorrhoids: ['ჰემორ', 'hemorrh', 'proctolog', 'posterisan'],
};

const NAME_HINTS = Object.fromEntries(PHARMADEPOT_SUBCATEGORIES.map((c) => [c.id, c.nameKa]));

export function inferCategorySlug(rawName, extra = '') {
  const text = `${rawName || ''} ${extra || ''}`.toLowerCase();
  if (!text.trim()) return null;

  let bestSlug = null;
  let bestScore = 0;

  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) score += Math.max(3, kw.length);
    }
    const hint = NAME_HINTS[slug];
    if (hint) {
      for (const part of hint.split(/\s+/).filter((p) => p.length > 4)) {
        if (text.includes(part.toLowerCase())) score += part.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
    }
  }

  return bestScore >= 4 ? bestSlug : null;
}
