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

const action = process.argv[2];
if (action === 'shot') shot(process.argv[3]);
else if (action === 'tap') tap(process.argv[3], process.argv[4]);
else {
  console.error('shot name | tap x y');
  process.exit(1);
}
