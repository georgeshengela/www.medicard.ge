import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const svgDir = join(here, '../../../assets/figma/welcome-circles');
const layout = readFileSync(join(here, '../../constants/figmaWelcomeLayout.ts'), 'utf8');
const field = readFileSync(join(here, 'WelcomeCircleField.tsx'), 'utf8');

function svg(name) {
  return readFileSync(join(svgDir, name), 'utf8');
}

describe('welcome Figma circle field', () => {
  it('keeps downloaded ellipse SVGs identical to the layout tokens', () => {
    const outer = svg('ellipse-1.svg');
    const middle = svg('ellipse-2.svg');
    const inner = svg('ellipse-3.svg');

    assert.match(outer, /stroke="#5EEAD4"/);
    assert.match(outer, /stroke-width="48"/);
    assert.match(outer, /r="652.5"/);
    assert.match(outer, /opacity="0.64"/);
    assert.match(outer, /width="1353"/);

    assert.match(middle, /stroke="#5EEAD4"/);
    assert.match(middle, /r="321.5"/);
    assert.doesNotMatch(middle, /opacity="/);
    assert.match(middle, /width="691"/);

    assert.match(inner, /opacity="0.32"/);
    assert.match(inner, /r="273"/);
    assert.match(inner, /width="594"/);

    assert.match(layout, /LANDING_RING_COLOR = '#5EEAD4'/);
    assert.match(layout, /LANDING_RING_STROKE = 48/);
    assert.match(layout, /radius: 652.5/);
    assert.match(layout, /radius: 321.5/);
    assert.match(layout, /radius: 273/);
    assert.match(layout, /left: -974/);
    assert.match(layout, /left: 52/);
    assert.match(layout, /left: -351/);
    assert.match(layout, /progress: true/);
    assert.match(field, /WelcomeCircleField/);
    assert.match(field, /LANDING_RINGS/);
    assert.match(field, /withRepeat/);
    assert.match(field, /rotate:/);
    assert.doesNotMatch(field, /strokeDashoffset/);
    assert.doesNotMatch(field, /useAnimatedProps/);
  });
});

describe('auth splash percent', () => {
  it('keeps the percent glyphs inside the line box', () => {
    const splash = readFileSync(join(here, '../../../app/(auth)/index.tsx'), 'utf8');
    assert.match(splash, /PERCENT_LINE = 76/);
    assert.match(splash, /paddingTop: insets\.top/);
    assert.doesNotMatch(splash, /leading-none/);
  });
});
