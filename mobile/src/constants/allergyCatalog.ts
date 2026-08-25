export type AllergyEntry = {
  id: string;
  ka: string;
  aliases?: readonly string[];
};

/** Common food, drug, and environmental allergens — Georgian labels, Latin aliases for search. */
export const ALLERGY_CATALOG: AllergyEntry[] = [
  { id: 'peanuts', ka: 'არაქისი', aliases: ['peanut', 'peanuts', 'არაქისის კარაქი'] },
  { id: 'tree-nuts', ka: 'თხილი', aliases: ['nuts', 'nut', 'walnut', 'almond', 'hazelnut', 'ნუში'] },
  { id: 'milk', ka: 'რძე', aliases: ['milk', 'lactose', 'dairy', 'ლაქტოზა'] },
  { id: 'cheese', ka: 'ყველი', aliases: ['cheese'] },
  { id: 'eggs', ka: 'კვერცხი', aliases: ['egg', 'eggs'] },
  { id: 'wheat', ka: 'ხორბალი', aliases: ['wheat', 'bread', 'პური'] },
  { id: 'bread', ka: 'პური', aliases: ['bread'] },
  { id: 'gluten', ka: 'გლუტენი', aliases: ['gluten'] },
  { id: 'soy', ka: 'სოია', aliases: ['soy', 'soya'] },
  { id: 'fish', ka: 'თევზი', aliases: ['fish'] },
  { id: 'shellfish', ka: 'ზღვის პროდუქტები', aliases: ['shellfish', 'shrimp', 'crab', 'კრევეტი'] },
  { id: 'sesame', ka: 'სეზამი', aliases: ['sesame', 'tahini'] },
  { id: 'penicillin', ka: 'პენიცილინი', aliases: ['penicillin', 'amoxicillin'] },
  { id: 'aspirin', ka: 'ასპირინი', aliases: ['aspirin', 'nsaid'] },
  { id: 'ibuprofen', ka: 'იბუპროფენი', aliases: ['ibuprofen'] },
  { id: 'pollen', ka: 'მტვერი', aliases: ['pollen', 'hay fever'] },
  { id: 'dust-mite', ka: 'მტვრის ტკიპა', aliases: ['dust', 'mite'] },
  { id: 'pet-dander', ka: 'ცხოველის ბეწვი', aliases: ['cat', 'dog', 'pet', 'dander'] },
  { id: 'latex', ka: 'ლატექსი', aliases: ['latex'] },
  { id: 'iodine', ka: 'იოდი', aliases: ['iodine', 'contrast'] },
  { id: 'strawberry', ka: 'მარწყვი', aliases: ['strawberry'] },
  { id: 'chocolate', ka: 'შოკოლადი', aliases: ['chocolate', 'cocoa'] },
  { id: 'honey', ka: 'თაფლი', aliases: ['honey', 'bee'] },
  { id: 'garlic', ka: 'ნიორი', aliases: ['garlic'] },
  { id: 'mustard', ka: 'მდოგვი', aliases: ['mustard'] },
];

export const COMMON_ALLERGY_IDS = ['tree-nuts', 'cheese', 'bread', 'milk', 'eggs', 'penicillin'] as const;

export const MAX_ALLERGIES = 10;

function fold(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u10A0-\u10FF]+/gi, '');
}

function haystack(entry: AllergyEntry) {
  return [entry.ka, entry.id, ...(entry.aliases ?? [])].map(fold).filter(Boolean);
}

export function allergyLabel(entry: AllergyEntry) {
  return entry.ka;
}

export function searchAllergies(query: string, limit = 8): AllergyEntry[] {
  const q = fold(query);
  if (!q) return ALLERGY_CATALOG.slice(0, limit);

  const ranked = ALLERGY_CATALOG.map((entry) => {
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

export function commonAllergies() {
  return COMMON_ALLERGY_IDS.map((id) => ALLERGY_CATALOG.find((entry) => entry.id === id)).filter(
    (entry): entry is AllergyEntry => Boolean(entry),
  );
}

export function hasAllergy(list: string[], name: string) {
  const needle = fold(name);
  return list.some((item) => fold(item) === needle);
}
