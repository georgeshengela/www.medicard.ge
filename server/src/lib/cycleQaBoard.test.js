import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildCycleQaBoard,
  resolveQaFile,
  resolveContractFile,
  PHASE_CATALOG,
} from './cycleQaBoard.js';

describe('cycle QA board', () => {
  it('includes frozen Phase 40 and live screenshot counts', () => {
    const board = buildCycleQaBoard();
    assert.equal(board.now?.phase, 42);
    assert.equal(board.now?.folder, 'cycle-phase42-postpartum-return-to-track');
    const p42 = board.phases.find((p) => p.folder === 'cycle-phase42-postpartum-return-to-track');
    assert.ok(p42, 'phase 42 missing');
    assert.equal(p42.status, 'FINAL-FROZEN');
    assert.ok(p42.screenshotCount >= 12, `expected ≥12 Phase 42 Android shots, got ${p42.screenshotCount}`);
    const p41 = board.phases.find((p) => p.folder === 'cycle-phase41-postpartum-period-classification');
    assert.ok(p41, 'phase 41 missing');
    assert.equal(p41.status, 'FINAL-FROZEN');
    assert.ok(p41.screenshotCount >= 12, `expected ≥12 Phase 41 Android shots, got ${p41.screenshotCount}`);
    const p40 = board.phases.find((p) => p.folder === 'cycle-phase40-postpartum-copy');
    assert.ok(p40, 'phase 40 missing');
    assert.equal(p40.status, 'FINAL-FROZEN');
    assert.ok(p40.screenshotCount >= 12, `expected ≥12 Phase 40 Android shots, got ${p40.screenshotCount}`);
    const p39 = board.phases.find((p) => p.folder === 'cycle-phase39-postpartum-doctor');
    assert.ok(p39, 'phase 39 missing');
    assert.equal(p39.status, 'FINAL-FROZEN');
    assert.ok(p39.screenshotCount >= 12, `expected ≥12 Android shots, got ${p39.screenshotCount}`);
    const p38 = board.phases.find((p) => p.folder === 'cycle-phase38-postpartum');
    assert.ok(p38, 'phase 38 missing');
    assert.equal(p38.status, 'FINAL-FROZEN');
    assert.ok(p38.screenshotCount >= 12, `expected ≥12 Phase 38 Android shots, got ${p38.screenshotCount}`);
    const p37 = board.phases.find((p) => p.folder === 'cycle-phase37-visit-place');
    assert.ok(p37, 'phase 37 missing');
    assert.equal(p37.status, 'FINAL-FROZEN');
    assert.ok(board.kpis.screenshotCount > 100);
  });

  it('catalog folders are unique', () => {
    const folders = PHASE_CATALOG.map((p) => p.folder);
    assert.equal(folders.length, new Set(folders).size);
  });

  it('rejects path traversal for QA files', () => {
    assert.equal(resolveQaFile('../server', 'package.json'), null);
    assert.equal(resolveQaFile('cycle-phase38-postpartum', '../package.json'), null);
    assert.equal(resolveQaFile('cycle-phase38-postpartum', 'qa-run.js'), null);
    const shot = resolveQaFile('cycle-phase37-visit-place', '03-place-saved.png');
    assert.ok(shot);
    assert.equal(shot.mime, 'image/png');
    assert.equal(path.basename(shot.abs), '03-place-saved.png');
  });

  it('serves catalog contracts only from docs/', () => {
    const ok = resolveContractFile('CYCLE_POSTPARTUM_DOCTOR_SUMMARY_CONTRACT.md');
    assert.ok(ok);
    assert.equal(resolveContractFile('../package.json'), null);
    assert.equal(resolveContractFile('README.md'), null);
  });
});
