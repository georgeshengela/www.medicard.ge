import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PETS_CATALOG_VERSION, SPECIES, isBreedAllowedForSpecies } from './petsCatalog.js';

describe('mobile pets catalog snapshot', () => {
  it('matches the server species ids and honest coverage', () => {
    assert.equal(PETS_CATALOG_VERSION, 'pets-species-v1');
    assert.equal(SPECIES.length, 9);
    assert.equal(isBreedAllowedForSpecies('dog', 'unknown'), true);
    assert.equal(isBreedAllowedForSpecies('fish', 'mixed'), false);
    assert.equal(getBirdBreedCount(), 0);
  });
});

function getBirdBreedCount() {
  return SPECIES.find((row) => row.id === 'bird')?.breeds.length ?? -1;
}
