/**
 * Bounded veterinary reference retrieval.
 * Summaries are Medicard-authored. They are not copies of EMA/WSAVA/WOAH publications.
 * Product-specific claims require a retrieved source for this turn.
 */

export const PET_VET_GROUNDING_VERSION = 'pets-vet-refs-v1';
export const PET_VET_REF_CHAR_MAX = 1800;
export const PET_VET_REF_MAX = 3;

export const PET_VET_REFERENCES = Object.freeze([
  {
    id: 'ema-bravecto-epar',
    title: 'Bravecto EPAR',
    publisher: 'European Medicines Agency',
    url: 'https://www.ema.europa.eu/en/medicines/veterinary/EPAR/bravecto',
    species: ['dog', 'cat'],
    topics: ['flea', 'tick', 'რწყილი', 'ტკიპა', 'fluralaner', 'bravecto'],
    version: 'EPAR public overview',
    retrievedOn: '2026-09-14',
    summary:
      'Official EU product information exists for fluralaner (Bravecto). Dose, species, and interval must follow a veterinarian and the current product information. This app does not calculate a dose or invent a preventive interval.',
  },
  {
    id: 'ema-nexgard-epar',
    title: 'NexGard EPAR',
    publisher: 'European Medicines Agency',
    url: 'https://www.ema.europa.eu/en/medicines/veterinary/EPAR/nexgard',
    species: ['dog'],
    topics: ['flea', 'tick', 'რწყილი', 'ტკიპა', 'afoxolaner', 'nexgard'],
    version: 'EPAR public overview',
    retrievedOn: '2026-09-14',
    summary:
      'Official EU product information exists for afoxolaner (NexGard) in dogs. Individual dose and schedule are veterinarian- and label-dependent. This app does not prescribe or complete missing dose fields.',
  },
  {
    id: 'woah-rabies',
    title: 'Rabies',
    publisher: 'World Organisation for Animal Health (WOAH)',
    url: 'https://www.woah.org/en/disease/rabies/',
    species: ['dog', 'cat', 'other'],
    topics: ['rabies', 'ცოფი', 'vaccine', 'ვაქცინა'],
    version: 'WOAH disease page',
    retrievedOn: '2026-09-14',
    summary:
      'Rabies is a serious zoonosis. Vaccination and post-exposure steps are veterinarian- and public-health-authority decisions. This app does not invent a national vaccine calendar or emergency phone numbers.',
  },
  {
    id: 'wsava-vaccination-guidelines',
    title: 'WSAVA Vaccination Guidelines',
    publisher: 'World Small Animal Veterinary Association',
    url: 'https://wsava.org/global-guidelines/vaccination-guidelines/',
    species: ['dog', 'cat'],
    topics: ['vaccine', 'ვაქცინა', 'vaccination', 'core'],
    version: 'WSAVA guideline landing page',
    retrievedOn: '2026-09-14',
    summary:
      'WSAVA publishes vaccination guidelines for veterinarians. Core versus non-core choices and intervals are individualized. This app must not infer a preventive interval from breed, age, or a missing record.',
  },
]);

export function publicVetReference(row) {
  return {
    id: row.id,
    title: row.title,
    publisher: row.publisher,
    url: row.url,
    version: row.version,
    retrievedOn: row.retrievedOn,
  };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}+]+/u)
    .filter((token) => token.length >= 3);
}

export function retrievePetVetReferences({ speciesId, query, limit = PET_VET_REF_MAX } = {}) {
  const tokens = new Set(tokenize(query));
  const scored = [];
  for (const row of PET_VET_REFERENCES) {
    if (speciesId && row.species.length && !row.species.includes(speciesId) && !row.species.includes('other')) {
      continue;
    }
    let score = 0;
    for (const topic of row.topics) {
      if (tokens.has(topic.toLowerCase()) || String(query || '').toLowerCase().includes(topic.toLowerCase())) {
        score += 2;
      }
    }
    if (score > 0) scored.push({ score, row });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((row) => row.row);
}

export function formatRetrievedReferences(rows) {
  if (!rows.length) return '';
  return rows
    .map((row) =>
      [
        `source_id: ${row.id}`,
        `title: ${row.title}`,
        `publisher: ${row.publisher}`,
        `url: ${row.url}`,
        `version: ${row.version}`,
        `retrieved_on: ${row.retrievedOn}`,
        `summary: ${row.summary}`,
      ].join('\n'),
    )
    .join('\n\n')
    .slice(0, PET_VET_REF_CHAR_MAX);
}

export function extractCitedSourceIds(text) {
  const ids = [];
  const re = /\[ref:([a-z0-9-]+)\]/gi;
  let match;
  while ((match = re.exec(String(text || '')))) {
    ids.push(match[1]);
  }
  return ids;
}

export function filterCitationsToRetrieved(text, retrieved) {
  const allowed = new Set((retrieved || []).map((row) => row.id));
  const cited = extractCitedSourceIds(text).filter((id) => allowed.has(id));
  const unique = [...new Set(cited)];
  const sources = (retrieved || []).filter((row) => unique.includes(row.id)).map(publicVetReference);
  return {
    content: String(text || '').replace(/\[ref:([a-z0-9-]+)\]/gi, (full, id) => (allowed.has(id) ? full : '')),
    citations: sources,
  };
}
