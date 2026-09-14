import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCitedSourceIds,
  filterCitationsToRetrieved,
  retrievePetVetReferences,
} from './petsVetReferences.js';

describe('Medi Vet reference grounding', () => {
  it('retrieves curated source content, not a link list only', () => {
    const rows = retrievePetVetReferences({ speciesId: 'dog', query: 'რწყილი bravecto' });
    assert.ok(rows.length >= 1);
    assert.ok(rows[0].summary.length > 40);
    assert.ok(rows[0].url.startsWith('https://'));
  });

  it('drops citation IDs that were not retrieved', () => {
    const retrieved = retrievePetVetReferences({ speciesId: 'dog', query: 'rabies ცოფი' });
    const raw = 'ტექსტი [ref:woah-rabies] და გამოგონილი [ref:made-up-source]';
    const filtered = filterCitationsToRetrieved(raw, retrieved);
    assert.ok(filtered.citations.every((row) => retrieved.some((item) => item.id === row.id)));
    assert.equal(filtered.citations.some((row) => row.id === 'made-up-source'), false);
    assert.doesNotMatch(filtered.content, /\[ref:made-up-source\]/);
    assert.ok(extractCitedSourceIds(raw).includes('made-up-source'));
  });

  it('does not fetch arbitrary URLs from user or model text', () => {
    const src = retrievePetVetReferences({ query: 'https://evil.example/steal' });
    assert.equal(src.some((row) => row.url.includes('evil.example')), false);
  });
});
