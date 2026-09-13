import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('World map reuses Running Mapbox', () => {
  it('embeds Mapbox GL JS 3.8.0 Standard with day/night lightPreset like Running', () => {
    const world = readFileSync(join(here, 'worldMapHtml.ts'), 'utf8');
    const run = readFileSync(join(here, '../run/mapHtml.ts'), 'utf8');
    assert.match(world, /mapbox-gl-js\/v3\.8\.0/);
    assert.match(run, /mapbox-gl-js\/v3\.8\.0/);
    assert.match(world, /lightPreset/);
    assert.match(world, /mapbox:\/\/styles\/mapbox\/standard/);
    assert.equal(world.includes('leaflet'), false);
    assert.equal(world.includes('openstreetmap.org'), false);
  });
});
