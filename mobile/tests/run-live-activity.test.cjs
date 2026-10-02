// MEDIRUN Live Activity: the layout the app ships is evaluated exactly like the iOS widget extension does —
// the app's Babel pipeline stringifies the 'widget' function, and expo-widgets' own runtime bundle renders it.
// Every state must render without a JavaScript error, with the right texts, clock and action.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const runtimeBundle = path.join(root, 'node_modules/expo-widgets/bundle/build/ExpoWidgets.bundle');

/** The layout string exactly as Metro/Babel produces it for the iOS app bundle. */
function shippedLayout() {
  const babel = require(require.resolve('@babel/core', { paths: [root] }));
  const file = path.join(root, 'src/lib/run/runActivityLayout.tsx');
  const { code } = babel.transformFileSync(file, {
    cwd: root,
    filename: file,
    babelrc: false,
    configFile: path.join(root, 'babel.config.js'),
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false },
  });
  let captured = null;
  const fakeRequire = (id) => {
    if (id === 'expo-widgets') return { createLiveActivity: (name, layout) => (captured = { name, layout }) };
    return new Proxy({}, { get: () => () => null });
  };
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(fakeRequire, module, module.exports);
  assert.ok(captured, 'createLiveActivity was called');
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

const base = {
  tone: 'live', status: 'შენი გზა იწერება', distance: '3.24', unit: 'კმ', distanceLabel: 'მანძილი', timeLabel: 'აქტიური დრო',
  ticking: true, clockStart: Date.now() - 1471000, clock: '24:31', lit: 47, litLabel: 'ანთია', pauseLabel: 'პაუზა',
  resumeLabel: 'გაგრძელება', resumeUrl: 'medicard://run/active?resume=1', staleText: 'განახლება შეჩერდა · გახსენი აპი',
};

const texts = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((child) => texts(child, out));
  else if (node && typeof node === 'object') {
    if (node.type === 'TextView' && typeof node.props?.text === 'string') out.push(node.props.text);
    if (node.type === 'TextView' && node.props?.timerInterval) out.push('⏱timer');
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
const symbols = (node) => find(node, 'ImageView').map((image) => image.props.systemName);

test('the shipped layout renders every region while recording', () => {
  const { name, layout } = shippedLayout();
  assert.equal(name, 'MedirunActivity');
  const render = widgetRuntime(layout);
  const out = render(base, { colorScheme: 'dark' });
  for (const region of ['banner', 'compactLeading', 'compactTrailing', 'minimal', 'expandedLeading', 'expandedTrailing', 'expandedBottom']) {
    assert.ok(out[region], `${region} is rendered`);
  }
  const banner = texts(out.banner);
  for (const expected of ['MEDI', 'RUN', 'შენი გზა იწერება', '3.24', 'კმ', 'მანძილი', '⏱timer', 'აქტიური დრო', '47', 'ანთია']) {
    assert.ok(banner.includes(expected), `banner shows ${expected}`);
  }
  const timer = find(out.banner, 'TextView').find((node) => node.props.timerInterval);
  assert.equal(timer.props.timerInterval.lower, base.clockStart, 'the clock counts from the session start');
  assert.equal(timer.props.countsDown, false);
  const pause = find(out.banner, 'Button');
  assert.equal(pause.length, 1);
  assert.equal(pause[0].props.target, 'pause', 'the lock-screen button pauses the session');
  assert.deepEqual(find(out.banner, 'LinkView'), []);
  assert.ok(symbols(out.compactLeading).includes('figure.run'));
  assert.ok(texts(out.compactTrailing).includes('⏱timer'));
});

test('paused: the clock stands still and the action opens the app to continue', () => {
  const render = widgetRuntime(shippedLayout().layout);
  const out = render({ ...base, tone: 'pause', status: 'პაუზა', ticking: false }, { colorScheme: 'dark' });
  const banner = texts(out.banner);
  assert.ok(banner.includes('24:31') && !banner.includes('⏱timer'), 'static clock');
  assert.deepEqual(find(out.banner, 'Button'), []);
  const link = find(out.banner, 'LinkView');
  assert.equal(link.length, 1);
  assert.equal(link[0].props.destination, 'medicard://run/active?resume=1');
  assert.ok(symbols(out.minimal).includes('pause.fill'));
});

test('in a vehicle the time is on hold with a car symbol; no lit counter before the first building', () => {
  const render = widgetRuntime(shippedLayout().layout);
  const out = render({ ...base, tone: 'hold', status: 'მანქანაში · ავტო-პაუზა', ticking: false, lit: 0 }, { colorScheme: 'dark' });
  const banner = texts(out.banner);
  assert.ok(banner.includes('მანქანაში · ავტო-პაუზა'));
  assert.ok(!banner.includes('ანთია'), 'no lit counter at zero');
  assert.ok(symbols(out.banner).includes('car.fill'));
  assert.ok(symbols(out.compactLeading).includes('car.fill'));
  assert.equal(find(out.banner, 'Button')[0].props.target, 'pause', 'still pausable while driving');
});

test('a stale activity (the app stopped updating) says so instead of ticking on', () => {
  const render = widgetRuntime(shippedLayout().layout);
  const out = render(base, { colorScheme: 'dark', isStale: true });
  const banner = texts(out.banner);
  assert.ok(banner.includes('განახლება შეჩერდა · გახსენი აპი'));
  assert.ok(!banner.includes('⏱timer'), 'no running clock on stale content');
  assert.ok(banner.includes('24:31'));
});
