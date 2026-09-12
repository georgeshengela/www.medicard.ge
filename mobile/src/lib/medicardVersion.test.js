import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_MEDICARD_VERSION,
  formatMedicardVersion,
  iosMarketingVersion,
  parseMedicardVersion,
  versionLegend,
} from './medicardVersion.js';

const here = dirname(fileURLToPath(import.meta.url));
const appJson = JSON.parse(readFileSync(join(here, '../../app.json'), 'utf8'));

describe('Medicard five-part version', () => {
  it('starts the public identity at 1.0.0.7.80', () => {
    assert.equal(appJson.expo.version, '1.0.0.7.80');
    assert.equal(appJson.expo.extra.medicardInternalVersion, '1.0.0.7.80');
    assert.equal(appJson.expo.ios.version, '1.7.80');
    assert.equal(appJson.expo.ios.buildNumber, '66');
    assert.equal(appJson.expo.android.versionCode, 66);
    assert.equal(DEFAULT_MEDICARD_VERSION, '1.0.0.7.80');
  });

  it('parses G.0.0.B.R and compresses iOS marketing to G.B.R', () => {
    assert.deepEqual(parseMedicardVersion('1.0.0.7.67'), {
      raw: '1.0.0.7.67',
      generation: 1,
      reservedMinor: 0,
      reservedPatch: 0,
      train: 7,
      revision: 67,
      kind: 'five',
    });
    assert.equal(formatMedicardVersion('1.0.0.7.67'), '1.0.0.7.67');
    assert.equal(iosMarketingVersion('1.0.0.7.67'), '1.7.67');
    assert.deepEqual(versionLegend('1.0.0.7.67'), {
      generation: 1,
      train: 7,
      revision: 67,
    });
  });

  it('does not invent a five-part string from historic 15–65 clients', () => {
    assert.equal(parseMedicardVersion('65.0.3')?.kind, 'three');
    assert.equal(formatMedicardVersion('nope'), DEFAULT_MEDICARD_VERSION);
  });
});
