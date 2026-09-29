import { isEn } from '../i18n/locale.js';

export type AllergyEntry = {
  id: string;
  ka: string;
  /** English label for documents printed in English (health passport). */
  en: string;
  aliases?: readonly string[];
};

/** Common food, drug, and environmental allergens — Georgian labels, Latin aliases for search. */
export const ALLERGY_CATALOG: AllergyEntry[] = [
  { id: 'peanuts', ka: 'არაქისი', en: 'Peanuts', aliases: ['peanut', 'peanuts', 'არაქისის კარაქი'] },
  { id: 'tree-nuts', ka: 'თხილი', en: 'Tree nuts', aliases: ['nuts', 'nut', 'walnut', 'almond', 'hazelnut', 'ნუში'] },
  { id: 'milk', ka: 'რძე', en: 'Milk', aliases: ['milk', 'lactose', 'dairy', 'ლაქტოზა'] },
  { id: 'cheese', ka: 'ყველი', en: 'Cheese', aliases: ['cheese'] },
  { id: 'eggs', ka: 'კვერცხი', en: 'Eggs', aliases: ['egg', 'eggs'] },
  { id: 'wheat', ka: 'ხორბალი', en: 'Wheat', aliases: ['wheat', 'bread', 'პური'] },
  { id: 'bread', ka: 'პური', en: 'Bread', aliases: ['bread'] },
  { id: 'gluten', ka: 'გლუტენი', en: 'Gluten', aliases: ['gluten'] },
  { id: 'soy', ka: 'სოია', en: 'Soy', aliases: ['soy', 'soya'] },
  { id: 'fish', ka: 'თევზი', en: 'Fish', aliases: ['fish'] },
  { id: 'shellfish', ka: 'ზღვის პროდუქტები', en: 'Shellfish', aliases: ['shellfish', 'shrimp', 'crab', 'კრევეტი'] },
  { id: 'sesame', ka: 'სეზამი', en: 'Sesame', aliases: ['sesame', 'tahini'] },
  { id: 'penicillin', ka: 'პენიცილინი', en: 'Penicillin', aliases: ['penicillin', 'amoxicillin'] },
  { id: 'aspirin', ka: 'ასპირინი', en: 'Aspirin', aliases: ['aspirin', 'nsaid'] },
  { id: 'ibuprofen', ka: 'იბუპროფენი', en: 'Ibuprofen', aliases: ['ibuprofen'] },
  { id: 'pollen', ka: 'მტვერი', en: 'Pollen', aliases: ['pollen', 'hay fever'] },
  { id: 'dust-mite', ka: 'მტვრის ტკიპა', en: 'Dust mites', aliases: ['dust', 'mite'] },
  { id: 'pet-dander', ka: 'ცხოველის ბეწვი', en: 'Pet dander', aliases: ['cat', 'dog', 'pet', 'dander'] },
  { id: 'latex', ka: 'ლატექსი', en: 'Latex', aliases: ['latex'] },
  { id: 'iodine', ka: 'იოდი', en: 'Iodine', aliases: ['iodine', 'contrast'] },
  { id: 'strawberry', ka: 'მარწყვი', en: 'Strawberries', aliases: ['strawberry'] },
  { id: 'chocolate', ka: 'შოკოლადი', en: 'Chocolate', aliases: ['chocolate', 'cocoa'] },
  { id: 'honey', ka: 'თაფლი', en: 'Honey', aliases: ['honey', 'bee'] },
  { id: 'garlic', ka: 'ნიორი', en: 'Garlic', aliases: ['garlic'] },
  { id: 'mustard', ka: 'მდოგვი', en: 'Mustard', aliases: ['mustard'] },
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
  return [entry.ka, entry.en, entry.id, ...(entry.aliases ?? [])].map(fold).filter(Boolean);
}

/** Label in the app language (English users pick and store English labels). */
export function allergyLabel(entry: AllergyEntry) {
  return isEn() ? entry.en : entry.ka;
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
    .sort((a, b) => b.score - a.score || allergyLabel(a.entry).localeCompare(allergyLabel(b.entry), isEn() ? 'en' : 'ka'));

  return ranked.slice(0, limit).map((row) => row.entry);
}

export function commonAllergies() {
  return COMMON_ALLERGY_IDS.map((id) => ALLERGY_CATALOG.find((entry) => entry.id === id)).filter(
    (entry): entry is AllergyEntry => Boolean(entry),
  );
}

/** A stored allergy (catalog label in either language, id or alias) in the app language; free text unchanged. */
export function allergyDisplayLabel(value: string): string {
  const folded = fold(value);
  if (!folded) return value;
  const found = ALLERGY_CATALOG.find((entry) => fold(entry.ka) === folded || fold(entry.id) === folded || fold(entry.en) === folded);
  return found ? allergyLabel(found) : value;
}

export function hasAllergy(list: string[], name: string) {
  const needle = fold(allergyDisplayLabel(name));
  return list.some((item) => fold(allergyDisplayLabel(item)) === needle);
}

/** English label for a stored allergy (catalog label, id or alias); free text comes back unchanged. */
export function allergyEnglishLabel(value: string): string {
  const folded = fold(value);
  if (!folded) return value;
  const found = ALLERGY_CATALOG.find((entry) => fold(entry.ka) === folded || fold(entry.id) === folded || fold(entry.en) === folded)
    ?? ALLERGY_CATALOG.find((entry) => haystack(entry).includes(folded));
  return found?.en ?? value;
}
