import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BREED_SENTINELS,
  PETS_CATALOG_VERSION,
  SPECIES,
  getSpecies,
  isBreedAllowedForSpecies,
  publicPetsCatalog,
  searchBreeds,
} from './petsCatalog.js';

describe('pets catalog', () => {
  it('versions the catalog and covers the handoff species list', () => {
    assert.equal(PETS_CATALOG_VERSION, 'pets-species-v1');
    assert.deepEqual(
      SPECIES.map((row) => row.id),
      ['dog', 'cat', 'bird', 'rabbit', 'rodent', 'fish', 'reptile', 'horse', 'other'],
    );
  });

  it('does not claim complete breed coverage', () => {
    const pub = publicPetsCatalog();
    assert.equal(pub.coverageNotes.complete, false);
    assert.equal(pub.coverageNotes.dog, 'limited-not-fci');
    assert.equal(getSpecies('dog').coverage, 'limited');
    assert.equal(getSpecies('cat').coverage, 'limited');
    for (const id of ['bird', 'rabbit', 'rodent', 'fish', 'reptile', 'horse', 'other']) {
      assert.equal(getSpecies(id).coverage, 'sentinels-only');
      assert.equal(getSpecies(id).breeds.length, 0);
    }
  });

  it('always allows unknown and custom; mixed only where it makes sense', () => {
    assert.equal(isBreedAllowedForSpecies('dog', 'unknown'), true);
    assert.equal(isBreedAllowedForSpecies('dog', 'mixed'), true);
    assert.equal(isBreedAllowedForSpecies('dog', 'custom'), true);
    assert.equal(isBreedAllowedForSpecies('dog', 'labrador-retriever'), true);
    assert.equal(isBreedAllowedForSpecies('cat', 'labrador-retriever'), false);
    assert.equal(isBreedAllowedForSpecies('fish', 'mixed'), false);
    assert.equal(isBreedAllowedForSpecies('other', 'mixed'), false);
    assert.equal(isBreedAllowedForSpecies('other', 'unknown'), true);
    assert.equal(isBreedAllowedForSpecies('bird', BREED_SENTINELS.mixed.id), true);
  });

  it('search is identifier-stable and matches aliases without requiring Georgian labels', () => {
    const labs = searchBreeds('dog', 'labrador');
    assert.ok(labs.some((row) => row.id === 'labrador-retriever'));
    assert.equal(searchBreeds('cat', 'labrador').length, 0);
    const empty = searchBreeds('bird', 'persian');
    assert.equal(empty.length, 0);
  });
});
