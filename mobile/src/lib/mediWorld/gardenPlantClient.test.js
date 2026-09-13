'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { plantedFromGarden, interpretGardenPlantFailure } = require('./gardenPlantClient.js');

describe('Garden plant client reconcile', () => {
  const planted = {
    plots: [{ index: 1, plant: { catalogKey: 'pulse_fern', stage: 'seed' } }],
  };

  it('treats a lost-response occupied replay as planted when the plot already has that seed', () => {
    assert.equal(plantedFromGarden(planted, 1, 'pulse_fern'), true);
    assert.equal(interpretGardenPlantFailure('GARDEN_PLOT_OCCUPIED', planted, 1, 'pulse_fern'), 'planted');
  });

  it('does not call a different plant on an occupied plot a success', () => {
    assert.equal(interpretGardenPlantFailure('GARDEN_PLOT_OCCUPIED', planted, 1, 'dew_lily'), 'fail');
    assert.equal(interpretGardenPlantFailure('GARDEN_PLOT_OCCUPIED', { plots: [{ index: 1, plant: null }] }, 1, 'pulse_fern'), 'fail');
  });

  it('keeps insufficient energy distinct from total failure', () => {
    assert.equal(interpretGardenPlantFailure('INSUFFICIENT_CARE_ENERGY', planted, 2, 'pulse_fern'), 'insufficient');
    assert.equal(interpretGardenPlantFailure('WORLD_ERROR', planted, 1, 'pulse_fern'), 'fail');
  });
});
