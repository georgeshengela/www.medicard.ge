const { execSync } = require('child_process');
const path = require('path');
const serial = process.env.ADB_SERIAL || 'emulator-5554';
const root = path.resolve(__dirname, '../..');
const outDir = __dirname;

function sh(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function shot(name) {
  const dest = path.join(outDir, `${name}.png`);
  sh(`adb -s ${serial} shell screencap -p /sdcard/cycle-qa.png`);
  sh(`adb -s ${serial} pull /sdcard/cycle-qa.png "${dest}"`);
  console.log('SHOT', dest);
}

function seed(state) {
  sh(`node scripts/cycle-phase6-qa-seed.js --state=${state}`, {
    cwd: path.join(root, 'server'),
  });
}

function refresh() {
  sh(`adb -s ${serial} shell input swipe 540 480 540 980 280`);
}

const state = process.argv[2];
const name = process.argv[3];
if (!state || !name) {
  console.error('usage: node state-shot.js <state> <shot-name>');
  process.exit(1);
}

seed(state);
sleep(800);
refresh();
sleep(4500);
shot(name);
