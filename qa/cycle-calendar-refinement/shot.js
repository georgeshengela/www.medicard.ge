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

const name = process.argv[2];
if (!name) {
  console.error('usage: node shot.js <name>');
  process.exit(1);
}
shot(name);
