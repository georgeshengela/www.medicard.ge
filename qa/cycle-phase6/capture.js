const { execSync } = require('child_process');
const path = require('path');
const serial = process.env.ADB_SERIAL || 'emulator-5554';
const outDir = __dirname;

function sh(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function shot(name) {
  const dest = path.join(outDir, `${name}.png`);
  sh(`adb -s ${serial} shell screencap -p /sdcard/cycle-qa.png`);
  sh(`adb -s ${serial} pull /sdcard/cycle-qa.png "${dest}"`);
  console.log('SHOT', dest);
}

function tap(x, y) {
  sh(`adb -s ${serial} shell input tap ${x} ${y}`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const action = process.argv[2];
if (action === 'shot') shot(process.argv[3]);
else if (action === 'tap') tap(process.argv[3], process.argv[4]);
else if (action === 'cycle') {
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/cycle"`);
} else if (action === 'refresh') {
  sh(`adb -s ${serial} shell input swipe 540 480 540 980 280`);
} else {
  console.error('shot name | tap x y | cycle | refresh');
  process.exit(1);
}
