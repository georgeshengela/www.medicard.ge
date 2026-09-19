import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const logoSvg = readFileSync(join(here, '../../../assets/logo.svg'), 'utf8');
const markSrc = readFileSync(join(here, 'MedicardLogoMark.tsx'), 'utf8');

describe('Medicard logomark', () => {
  it('ships a vector SVG (not a raster wrapper)', () => {
    assert.match(logoSvg, /^<svg\b/);
    assert.doesNotMatch(logoSvg, /<image\b|<rect[^>]*fill="#808080"/);
    assert.match(logoSvg, /linearGradient/);
    assert.match(logoSvg, /viewBox="24\.75 12\.75 36 36"/);
  });

  it('renders the Figma login mark as react-native-svg Path', () => {
    assert.match(markSrc, /from 'react-native-svg'/);
    assert.match(markSrc, /VIEW_BOX = '24\.75 12\.75 36 36'/);
    assert.doesNotMatch(markSrc, /logo-light\.png|Image/);
  });
});
