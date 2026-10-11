// MEDISLEEP Live Activity and lock-screen widget: the layouts the app ships are evaluated like the iOS widget
// extension does (Babel stringifies the 'widget' function, expo-widgets' runtime bundle renders it). Every state
// and family must render without a JavaScript error and say the right things.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const runtimeBundle = path.join(root, 'node_modules/expo-widgets/bundle/build/ExpoWidgets.bundle');

function shipped(file, factory) {
  const babel = require(require.resolve('@babel/core', { paths: [root] }));
  const abs = path.join(root, file);
  const { code } = babel.transformFileSync(abs, {
    cwd: root, filename: abs, babelrc: false, configFile: path.join(root, 'babel.config.js'),
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false },
  });
  let captured = null;
  const fakeRequire = (id) => {
    if (id === 'expo-widgets') return { [factory]: (name, layout) => (captured = { name, layout }) };
    return new Proxy({}, { get: () => () => null });
  };
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(fakeRequire, module, module.exports);
  assert.ok(captured, `${factory} was called`);
  assert.equal(typeof captured.layout, 'string', "the 'widget' directive turned the layout into a string");
  return captured;
}

function runtime(layout) {
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
    if (node.type === 'TextView' && node.props?.timerInterval) out.push('⏱timer');
    texts(node.props?.children, out);
    if (node.props && typeof node.props === 'object') for (const v of Object.values(node.props)) if (v && typeof v === 'object' && v !== node.props.children) texts(v, out);
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

const activity = {
  startedAt: Date.now() - 2 * 3600_000, title: 'ძილის რეჟიმი', elapsedLabel: 'ძილის რეჟიმში', alarm: '07:15', alarmLabel: 'მაღვიძარა',
  sound: 'წვიმა · ზღვა', soundNote: 'ჩაქრება 23:45-ზე', soundPlaying: true, pauseLabel: 'ხმის პაუზა', playLabel: 'ხმის ჩართვა',
  wakeLabel: 'ვიღვიძებ', wakeUrl: 'medicard://sleep/night?wake=1', staleText: 'გახსენი აპი',
};

test('sleep Live Activity: every region renders with the clock, alarm, sound and the wake link', () => {
  const { name, layout } = shipped('src/lib/sleep/sleepActivityLayout.tsx', 'createLiveActivity');
  assert.equal(name, 'SleepActivity');
  const render = runtime(layout);
  const out = render(activity, { colorScheme: 'dark' });
  for (const region of ['banner', 'compactLeading', 'compactTrailing', 'minimal', 'expandedLeading', 'expandedTrailing', 'expandedBottom']) {
    assert.ok(out[region], `${region} rendered`);
  }
  const banner = texts(out.banner);
  assert.ok(banner.includes('⏱timer'), 'the elapsed clock ticks natively');
  assert.ok(banner.includes('07:15') && banner.includes('წვიმა · ზღვა') && banner.includes('ჩაქრება 23:45-ზე'));
  const links = find(out.banner, 'LinkView');
  assert.equal(links[0]?.props?.destination, 'medicard://sleep/night?wake=1');
  assert.equal(find(out.banner, 'Button').length, 1, 'one sound button');
  // No sound, no alarm, stale: still renders, no button, „გახსენი აპი“ instead of a running clock.
  const quiet = render({ ...activity, sound: '', alarm: '' }, { colorScheme: 'dark', isStale: true });
  assert.equal(find(quiet.banner, 'Button').length, 0);
  assert.ok(texts(quiet.banner).includes('გახსენი აპი'));
});

const widgetProps = {
  rest: { state: 'rest', label: 'ბოლო ღამე', value: '7:40', detail: 'დაწოლა 23:00', inline: 'ძილი 7:40', fraction: 0.95, countdownTo: 0, countdownLabel: '', openUrl: 'medicard://sleep' },
  evening: { state: 'evening', label: 'დაწოლამდე', value: '23:00', detail: 'ბოლო ღამე 7 სთ 40 წთ', inline: 'დაწოლა 23:00', fraction: 0, countdownTo: Date.now() + 90 * 60_000, countdownLabel: 'დაწოლა 23:00-ზე', openUrl: 'medicard://sleep' },
  night: { state: 'night', label: 'ძილის რეჟიმი', value: '07:15', detail: 'მაღვიძარა', inline: 'მაღვიძარა 07:15', fraction: 0, countdownTo: 0, countdownLabel: '', openUrl: 'medicard://sleep/night' },
  empty: { state: 'empty', detail: 'დააყენე ძილის გეგმა MEDISLEEP-ში', openUrl: 'medicard://sleep' },
};

test('sleep widget: every family and state renders; the evening counts down', () => {
  const { name, layout } = shipped('src/lib/sleep/sleepWidgetLayout.tsx', 'createWidget');
  assert.equal(name, 'MedicardSleep');
  const render = runtime(layout);
  for (const family of ['systemSmall', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline']) {
    for (const [state, props] of Object.entries(widgetProps)) {
      const out = render(props, { widgetFamily: family, colorScheme: 'dark', date: new Date() });
      assert.ok(out, `${family} ${state}`);
    }
    assert.ok(render({}, { widgetFamily: family, colorScheme: 'dark', date: new Date() }), `${family} with no props (gallery)`);
  }
  const evening = texts(render(widgetProps.evening, { widgetFamily: 'accessoryRectangular', colorScheme: 'dark', date: new Date() }));
  assert.ok(evening.includes('⏱timer') && evening.includes('დაწოლა 23:00-ზე'));
  const inline = texts(render(widgetProps.night, { widgetFamily: 'accessoryInline', colorScheme: 'dark', date: new Date() }));
  assert.ok(inline.includes('მაღვიძარა 07:15'));
  assert.ok(find(render(widgetProps.rest, { widgetFamily: 'accessoryCircular', colorScheme: 'dark', date: new Date() }), 'Gauge').length >= 0);
});

test('app.json declares the sleep widget next to (not inside) the cycle widget, and background audio', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const widgets = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-widgets')[1].widgets;
  const sleep = widgets.find((w) => w.name === 'MedicardSleep');
  assert.deepEqual(sleep.supportedFamilies, ['systemSmall', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline']);
  assert.deepEqual(widgets.find((w) => w.name === 'MedicardCycle').supportedFamilies, ['systemSmall', 'systemMedium']);
  assert.ok(app.ios.infoPlist.UIBackgroundModes.includes('audio'));
  assert.ok(app.ios.infoPlist.NSAlarmKitUsageDescription);
  assert.equal(app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-audio')[1].enableBackgroundPlayback, true);
  assert.ok(fs.existsSync(path.join(root, 'assets/sleep/medisleep_dawn.wav')));
});
