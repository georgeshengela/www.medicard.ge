'use strict';

function plantedFromGarden(garden, plotIndex, catalogKey) {
  const plant = (garden?.plots || []).find((row) => Number(row.index) === Number(plotIndex))?.plant;
  if (!plant) return false;
  if (catalogKey && plant.catalogKey && plant.catalogKey !== catalogKey) return false;
  return true;
}

function interpretGardenPlantFailure(code, garden, plotIndex, catalogKey) {
  if (code === 'INSUFFICIENT_CARE_ENERGY') return 'insufficient';
  if (code === 'GARDEN_PLOT_OCCUPIED' && plantedFromGarden(garden, plotIndex, catalogKey)) return 'planted';
  return 'fail';
}

module.exports = { plantedFromGarden, interpretGardenPlantFailure };
