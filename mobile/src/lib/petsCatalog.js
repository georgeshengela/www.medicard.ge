/**
 * Pets species/breed catalog — pets-species-v1
 *
 * Species labels (labelKa) are product copy we author.
 * Breed display names stay in the source language (English). We do not invent
 * Georgian translations for breed names.
 *
 * Dog and cat lists are a LIMITED companion subset, not FCI/CFA complete.
 * Source: Wikipedia "List of dog breeds" and "List of cat breeds"
 * (CC BY-SA 4.0), curated down to common household animals plus the Caucasian
 * Shepherd Dog (Georgian-relevant). Identifiers are stable kebab-case slugs;
 * labels may be refined later without renaming ids.
 *
 * Other species have no verified breed catalog — only sentinels.
 */

export const PETS_CATALOG_VERSION = 'pets-species-v1';

export const BREED_SENTINELS = Object.freeze({
  unknown: { id: 'unknown', label: 'Unknown' },
  mixed: { id: 'mixed', label: 'Mixed' },
  custom: { id: 'custom', label: 'Custom' },
});

function breed(id, label, aliases = []) {
  return { id, label, aliases };
}

const DOG_BREEDS = [
  breed('labrador-retriever', 'Labrador Retriever', ['labrador', 'lab']),
  breed('golden-retriever', 'Golden Retriever'),
  breed('german-shepherd', 'German Shepherd', ['gsd']),
  breed('french-bulldog', 'French Bulldog'),
  breed('poodle', 'Poodle'),
  breed('beagle', 'Beagle'),
  breed('rottweiler', 'Rottweiler'),
  breed('yorkshire-terrier', 'Yorkshire Terrier', ['yorkie']),
  breed('boxer', 'Boxer'),
  breed('dachshund', 'Dachshund'),
  breed('siberian-husky', 'Siberian Husky', ['husky']),
  breed('great-dane', 'Great Dane'),
  breed('doberman', 'Dobermann', ['doberman pinscher']),
  breed('shih-tzu', 'Shih Tzu'),
  breed('miniature-schnauzer', 'Miniature Schnauzer'),
  breed('boston-terrier', 'Boston Terrier'),
  breed('pomeranian', 'Pomeranian'),
  breed('australian-shepherd', 'Australian Shepherd'),
  breed('cavalier-king-charles-spaniel', 'Cavalier King Charles Spaniel'),
  breed('chihuahua', 'Chihuahua'),
  breed('pug', 'Pug'),
  breed('border-collie', 'Border Collie'),
  breed('cocker-spaniel', 'Cocker Spaniel'),
  breed('maltese', 'Maltese'),
  breed('english-bulldog', 'English Bulldog'),
  breed('cane-corso', 'Cane Corso'),
  breed('shiba-inu', 'Shiba Inu'),
  breed('akita', 'Akita'),
  breed('bernese-mountain-dog', 'Bernese Mountain Dog'),
  breed('newfoundland', 'Newfoundland'),
  breed('bichon-frise', 'Bichon Frise'),
  breed('jack-russell-terrier', 'Jack Russell Terrier'),
  breed('samoyed', 'Samoyed'),
  breed('collie', 'Collie'),
  breed('weimaraner', 'Weimaraner'),
  breed('vizsla', 'Vizsla'),
  breed('dalmatian', 'Dalmatian'),
  breed('chow-chow', 'Chow Chow'),
  breed('malamute', 'Alaskan Malamute'),
  breed('greyhound', 'Greyhound'),
  breed('whippet', 'Whippet'),
  breed('belgian-malinois', 'Belgian Malinois'),
  breed('caucasian-shepherd', 'Caucasian Shepherd Dog', ['ovcharka', 'kavkaz']),
  breed('staffordshire-bull-terrier', 'Staffordshire Bull Terrier'),
];

const CAT_BREEDS = [
  breed('persian', 'Persian'),
  breed('siamese', 'Siamese'),
  breed('maine-coon', 'Maine Coon'),
  breed('british-shorthair', 'British Shorthair'),
  breed('ragdoll', 'Ragdoll'),
  breed('bengal', 'Bengal'),
  breed('abyssinian', 'Abyssinian'),
  breed('scottish-fold', 'Scottish Fold'),
  breed('sphynx', 'Sphynx'),
  breed('russian-blue', 'Russian Blue'),
  breed('norwegian-forest', 'Norwegian Forest Cat'),
  breed('siberian', 'Siberian'),
  breed('birman', 'Birman'),
  breed('turkish-angora', 'Turkish Angora'),
  breed('american-shorthair', 'American Shorthair'),
  breed('exotic-shorthair', 'Exotic Shorthair'),
  breed('devon-rex', 'Devon Rex'),
  breed('cornish-rex', 'Cornish Rex'),
  breed('oriental-shorthair', 'Oriental Shorthair'),
  breed('burmese', 'Burmese'),
  breed('egyptian-mau', 'Egyptian Mau'),
  breed('manx', 'Manx'),
  breed('chartreux', 'Chartreux'),
  breed('bombay', 'Bombay'),
  breed('british-longhair', 'British Longhair'),
  breed('tonkinese', 'Tonkinese'),
  breed('turkish-van', 'Turkish Van'),
];

export const SPECIES = Object.freeze([
  {
    id: 'dog',
    labelKa: 'ძაღლი',
    coverage: 'limited',
    allowsMixed: true,
    breeds: DOG_BREEDS,
  },
  {
    id: 'cat',
    labelKa: 'კატა',
    coverage: 'limited',
    allowsMixed: true,
    breeds: CAT_BREEDS,
  },
  {
    id: 'bird',
    labelKa: 'ფრინველი',
    coverage: 'sentinels-only',
    allowsMixed: true,
    breeds: [],
  },
  {
    id: 'rabbit',
    labelKa: 'კურდღელი',
    coverage: 'sentinels-only',
    allowsMixed: true,
    breeds: [],
  },
  {
    id: 'rodent',
    labelKa: 'მღრღნელი',
    coverage: 'sentinels-only',
    allowsMixed: true,
    breeds: [],
  },
  {
    id: 'fish',
    labelKa: 'თევზი',
    coverage: 'sentinels-only',
    allowsMixed: false,
    breeds: [],
  },
  {
    id: 'reptile',
    labelKa: 'ქვეწარმავალი',
    coverage: 'sentinels-only',
    allowsMixed: false,
    breeds: [],
  },
  {
    id: 'horse',
    labelKa: 'ცხენი',
    coverage: 'sentinels-only',
    allowsMixed: true,
    breeds: [],
  },
  {
    id: 'other',
    labelKa: 'სხვა',
    coverage: 'sentinels-only',
    allowsMixed: false,
    breeds: [],
  },
]);

const SPECIES_BY_ID = new Map(SPECIES.map((row) => [row.id, row]));

export function getSpecies(speciesId) {
  return SPECIES_BY_ID.get(String(speciesId || '')) ?? null;
}

export function sentinelIdsForSpecies(species) {
  const ids = ['unknown', 'custom'];
  if (species?.allowsMixed) ids.splice(1, 0, 'mixed');
  return ids;
}

export function isSentinelBreedId(breedId) {
  return breedId === 'unknown' || breedId === 'mixed' || breedId === 'custom';
}

export function isBreedAllowedForSpecies(speciesId, breedId) {
  const species = getSpecies(speciesId);
  if (!species || !breedId) return false;
  if (breedId === 'unknown' || breedId === 'custom') return true;
  if (breedId === 'mixed') return species.allowsMixed === true;
  return species.breeds.some((row) => row.id === breedId);
}

export function searchBreeds(speciesId, query) {
  const species = getSpecies(speciesId);
  if (!species) return [];
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return species.breeds;
  return species.breeds.filter((row) => {
    if (row.label.toLowerCase().includes(q) || row.id.includes(q)) return true;
    return (row.aliases || []).some((alias) => String(alias).toLowerCase().includes(q));
  });
}

export function publicPetsCatalog() {
  return {
    version: PETS_CATALOG_VERSION,
    coverageNotes: {
      complete: false,
      license: 'CC BY-SA 4.0 (Wikipedia breed lists, curated subset)',
      dog: 'limited-not-fci',
      cat: 'limited-not-cfa',
      otherSpecies: 'sentinels-only',
    },
    species: SPECIES.map((row) => ({
      id: row.id,
      labelKa: row.labelKa,
      coverage: row.coverage,
      allowsMixed: row.allowsMixed,
      breeds: row.breeds.map((rowBreed) => ({ id: rowBreed.id, label: rowBreed.label })),
      sentinels: sentinelIdsForSpecies(row),
    })),
  };
}
