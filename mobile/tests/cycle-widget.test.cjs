// „MEDICARD ციკლი“ Home-screen widget and the expected-day Live Activity (train 1.0.0.20): the layouts the
// app ships are evaluated exactly like the iOS widget extension does — the app's Babel pipeline stringifies
// the 'widget' functions and expo-widgets' own runtime bundle renders them — with props from the real
// snapshot builder. Every state must render without a JavaScript error, show the right words, and never
// show a cycle word when discreet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const runtimeBundle = path.join(root, 'node_modules/expo-widgets/bundle/build/ExpoWidgets.bundle');
const load = require('./helpers/loadTs.cjs')();
const snap = load('src/lib/cycleWidgetSnapshot.ts');
const { cycleLight, cycleDark } = load('src/theme/cyclePalette.ts');

/** The layout string exactly as Metro/Babel produces it for the iOS app bundle. */
function shippedLayout(relative, factoryName) {
  const babel = require(require.resolve('@babel/core', { paths: [root] }));
  const file = path.join(root, relative);
  const { code } = babel.transformFileSync(file, {
    cwd: root,
    filename: file,
    babelrc: false,
    configFile: path.join(root, 'babel.config.js'),
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false },
  });
  let captured = null;
  const fakeRequire = (id) => {
    if (id === 'expo-widgets') {
      return {
        [factoryName]: (name, layout) => (captured = { name, layout }),
      };
    }
    return new Proxy({}, { get: () => () => null });
  };
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(fakeRequire, module, module.exports);
  assert.ok(captured, `${factoryName} was called`);
  assert.equal(typeof captured.layout, 'string', "the 'widget' directive turned the layout into a string");
  return captured;
}

/** A JSContext-like sandbox with the expo-widgets runtime loaded (what the extension evaluates). */
function widgetRuntime(layout) {
  if (!fs.existsSync(runtimeBundle)) {
    execFileSync(process.execPath, [path.join(root, 'node_modules/expo-widgets/scripts/build-bundle.mjs'), root], { cwd: root, stdio: 'ignore' });
  }
  const context = vm.createContext({ console });
  context.globalThis = context;
  vm.runInContext(fs.readFileSync(runtimeBundle, 'utf8'), context);
  context.__expoWidgetLayout = vm.runInContext(`(${layout})`, context);
  return (props, environment) => JSON.parse(JSON.stringify(context.__expoWidgetRender(props, environment)));
}

const texts = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((child) => texts(child, out));
  else if (node && typeof node === 'object') {
    if (node.type === 'TextView' && typeof node.props?.text === 'string') out.push(node.props.text);
    texts(node.props?.children, out);
  }
  return out;
};
const find = (node, type, out = []) => {
  if (Array.isArray(node)) node.forEach((child) => find(child, type, out));
  else if (node && typeof node === 'object') {
    if (node.type === type) out.push(node);
    find(node.props?.children, type, out);
  }
  return out;
};
const modifiers = (node) => (node?.props?.modifiers ?? []).map((m) => m.$type);
const modifier = (node, type) => (node?.props?.modifiers ?? []).find((m) => m.$type === type);

const TODAY = '2026-10-14';
function bundle(over = {}) {
  const base = {
    profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-10-03', privacyEnabled: false, expectsBleeding: true, fertilityDisplay: 'auto', isIrregular: false },
    meta: { today: TODAY },
    phase: 'fertile',
    phaseKa: 'ნაყოფიერი ფანჯარა',
    cycleDay: 12,
    averages: { usedCycleLength: 28, cycleCount: 6 },
    forecastEligibility: { allowed: true, reason: 'STANDARD' },
    periodStatus: { state: 'ended', day: null, typicalLength: 5, autoEnded: true },
    predictions: { nextPeriodStart: '2026-10-30', calendar: {}, confidence: 'high', estimated: true },
    logs: [{ date: TODAY, flow: 'none', sexualActivity: true, bbt: 36.71 }],
    trends: { cycleLengths: [] },
  };
  return { ...base, ...over, profile: { ...base.profile, ...(over.profile || {}) }, predictions: { ...base.predictions, ...(over.predictions || {}) } };
}
const on = { discreet: false, available: true };
const STATES = {
  normal: snap.cycleWidgetSnapshot({ bundle: bundle(), day: TODAY, ...on }),
  window: snap.cycleWidgetSnapshot({
    bundle: bundle({ profile: { isIrregular: true }, predictions: { nextPeriodRange: { from: '2026-10-27', to: '2026-11-02' } } }),
    day: TODAY,
    ...on,
  }),
  today: snap.cycleWidgetSnapshot({ bundle: bundle({ predictions: { nextPeriodStart: TODAY } }), day: TODAY, ...on }),
  period: snap.cycleWidgetSnapshot({
    bundle: bundle({ periodStatus: { state: 'active', day: 3, typicalLength: 5, autoEnded: false }, logs: [{ date: TODAY, flow: 'medium' }] }),
    day: TODAY,
    ...on,
  }),
  learning: snap.cycleWidgetSnapshot({ bundle: bundle({ profile: { lastPeriodStart: null } }), day: TODAY, ...on }),
  tracking: snap.cycleWidgetSnapshot({ bundle: bundle({ profile: { mode: 'PERIMENOPAUSE' } }), day: TODAY, ...on }),
  discreet: snap.cycleWidgetSnapshot({ bundle: bundle(), day: TODAY, discreet: true, available: true }),
};
const small = { widgetFamily: 'systemSmall', colorScheme: 'light', timestamp: Date.now() };
const medium = { widgetFamily: 'systemMedium', colorScheme: 'light', timestamp: Date.now() };
const darkSmall = { ...small, colorScheme: 'dark' };

test('the widget layout registers as MedicardCycle (the name in app.json)', () => {
  const { name } = shippedLayout('src/lib/cycleWidgetLayout.tsx', 'createWidget');
  assert.equal(name, 'MedicardCycle');
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const plugin = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-widgets');
  const widget = plugin[1].widgets.find((w) => w.name === 'MedicardCycle');
  assert.ok(widget, 'registered in the expo-widgets plugin');
  assert.deepEqual(widget.ios.supportedFamilies, ['systemSmall', 'systemMedium']);
  assert.equal(plugin[1].groupIdentifier, 'group.ge.medicard.app');
  assert.equal(plugin[1].bundleIdentifier, 'ge.medicard.app.widgets');
});

test('normal: small shows „მენსტრუაციამდე · 16 დღე · სავარაუდოდ“, medium adds the date and „დაიწყო“', () => {
  const render = widgetRuntime(shippedLayout('src/lib/cycleWidgetLayout.tsx', 'createWidget').layout);
  const out = render(STATES.normal, small);
  const shown = texts(out);
  for (const expected of ['MEDICARD', 'მენსტრუაციამდე', '16', 'დღე', 'სავარაუდოდ']) assert.ok(shown.includes(expected), `small shows ${expected}`);
  assert.deepEqual(find(out, 'LinkView'), [], 'no button on the small widget');
  assert.ok(modifiers(out).includes('containerBackground'), 'adopts the iOS 17 container background');
  assert.equal(modifier(out, 'widgetURL').url, 'medicard://cycle');
  const wide = render(STATES.normal, medium);
  const wideText = texts(wide);
  assert.ok(wideText.includes('პარ, 30 ოქტ'), 'medium shows the date');
  const links = find(wide, 'LinkView');
  assert.equal(links.length, 1);
  assert.equal(links[0].props.destination, 'medicard://cycle?periodStart=1');
  assert.ok(texts(links[0]).includes('დაიწყო'));
  assert.equal(modifier(links[0], 'accessibilityLabel').label, 'მენსტრუაცია დაიწყო');
});

test('window, today, period day, learning and tracking each render their words', () => {
  const render = widgetRuntime(shippedLayout('src/lib/cycleWidgetLayout.tsx', 'createWidget').layout);
  const cases = {
    window: ['მენსტრუაციამდე', '13–19', 'სავარაუდოდ · ციკლები ცვალებადია'],
    today: ['სავარაუდოდ', 'დღეს', 'სავარაუდო მენსტრუაცია'],
    period: ['მენსტრუაციის დღე', '3'],
    learning: ['ვსწავლობთ შენს რიტმს', 'მიუთითე ბოლო მენსტრუაცია'],
    tracking: ['თვალყურის დევნება', '14', 'ოქტ'],
  };
  for (const [state, words] of Object.entries(cases)) {
    for (const env of [small, medium, darkSmall]) {
      const out = render(STATES[state], env);
      const shown = texts(out);
      for (const word of words) assert.ok(shown.includes(word), `${state} ${env.widgetFamily} ${env.colorScheme}: ${word} in ${shown.join(' / ')}`);
      assert.doesNotMatch(shown.join(' '), snap.CYCLE_WIDGET_FORBIDDEN, state);
    }
  }
  // A period day has no start button; the expected day's dot is a dashed rose ring.
  assert.deepEqual(find(render(STATES.period, medium), 'LinkView'), []);
  const ring = find(render(STATES.today, small), 'CircleView').find((c) => modifiers(c).includes('strokeBorder'));
  assert.ok(ring, 'dashed ring on the expected day');
  assert.deepEqual(modifier(ring, 'strokeBorder').style.dash, [3, 2.5]);
  const solid = find(render(STATES.period, darkSmall), 'CircleView')[0];
  assert.ok(JSON.stringify(solid).includes(cycleDark.period), 'dark mode period dot from the cycle palette');
});

test('discreet and empty props draw the neutral tile: „MEDICARD“, a dot, no cycle word, opens Home', () => {
  const render = widgetRuntime(shippedLayout('src/lib/cycleWidgetLayout.tsx', 'createWidget').layout);
  for (const props of [STATES.discreet, {}, snap.neutralCycleWidget()]) {
    for (const env of [small, medium, darkSmall]) {
      const out = render(props, env);
      assert.deepEqual(texts(out), ['MEDICARD']);
      assert.deepEqual(find(out, 'LinkView'), []);
      assert.equal(find(out, 'CircleView').length, 1);
      assert.equal(modifier(out, 'widgetURL').url, 'medicard://');
    }
  }
  // The built-in fallback colours are the cycle palette's card / ink / mutedSoft.
  const light = JSON.stringify(render({}, small));
  for (const hex of [cycleLight.card, cycleLight.ink, cycleLight.mutedSoft]) assert.ok(light.includes(hex), `light fallback ${hex}`);
  const dark = JSON.stringify(render({}, darkSmall));
  for (const hex of [cycleDark.card, cycleDark.ink, cycleDark.mutedSoft]) assert.ok(dark.includes(hex), `dark fallback ${hex}`);
});

test('cycle words are privacy-sensitive (redacted on a locked device)', () => {
  const render = widgetRuntime(shippedLayout('src/lib/cycleWidgetLayout.tsx', 'createWidget').layout);
  const out = render(STATES.normal, small);
  const stacks = find(out, 'VStackView').filter((v) => modifiers(v).includes('privacySensitive'));
  assert.equal(stacks.length, 1);
  assert.ok(texts(stacks[0]).includes('მენსტრუაციამდე'));
  assert.ok(!texts(stacks[0]).includes('MEDICARD'), 'the brand stays visible');
});

test('the expected-day Live Activity renders every region; discreet = „MEDICARD“ only', () => {
  const { name, layout } = shippedLayout('src/lib/cycleDayActivityLayout.tsx', 'createLiveActivity');
  assert.equal(name, 'CycleDayActivity');
  const render = widgetRuntime(layout);
  const due = snap.activityProps(bundle({ predictions: { nextPeriodStart: TODAY } }), TODAY, false);
  const out = render(due, { colorScheme: 'dark' });
  for (const region of ['banner', 'compactLeading', 'compactTrailing', 'minimal', 'expandedLeading', 'expandedBottom']) {
    assert.ok(out[region], `${region} is rendered`);
  }
  const banner = texts(out.banner);
  for (const expected of ['MEDICARD', 'სავარაუდოდ · დღეს', 'სავარაუდო მენსტრუაცია', 'დაიწყო']) assert.ok(banner.includes(expected), `banner shows ${expected}`);
  assert.equal(find(out.banner, 'LinkView')[0].props.destination, 'medicard://cycle?periodStart=1');
  assert.ok(texts(out.compactTrailing).includes('დღეს'));
  // Stale (the app stopped updating): no start button.
  assert.deepEqual(find(render(due, { colorScheme: 'dark', isStale: true }).banner, 'LinkView'), []);
  const hidden = render(snap.activityProps(bundle({ predictions: { nextPeriodStart: TODAY } }), TODAY, true), { colorScheme: 'dark' });
  const hiddenText = [hidden.banner, hidden.compactLeading, hidden.compactTrailing, hidden.minimal, hidden.expandedLeading]
    .map((r) => texts(r).join(' '))
    .join(' ');
  assert.doesNotMatch(hiddenText, /[Ⴀ-ჿ]/, 'no Georgian word at all');
  assert.ok(hiddenText.includes('MEDICARD'));
  assert.equal(hidden.expandedBottom, undefined);
  assert.deepEqual(find(hidden.banner, 'LinkView'), []);
});
