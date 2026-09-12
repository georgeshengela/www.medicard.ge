const { execSync } = require('child_process');
const path = require('path');
const serial = process.env.ADB_SERIAL || 'emulator-5554';
const tapJs = path.join(__dirname, 'adb-tap.js');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function tapNeedles(...needles) {
  execSync(`node "${tapJs}" tap ${needles.map((n) => `"${n}"`).join(' ')}`, { stdio: 'inherit' });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const dump = () => execSync(`node "${tapJs}" dump`, { encoding: 'utf8' });

let ui = dump();
if (ui.includes('უკვე გაქვთ ანგარიში')) {
  tapNeedles('უკვე გაქვთ ანგარიში');
  sleep(2500);
  ui = dump();
}

if (!ui.includes('ელ-ფოსტა')) {
  console.log(ui);
  throw new Error('Not on sign-in');
}

sh(`adb -s ${serial} shell input tap 577 1116`);
sleep(400);
sh(`adb -s ${serial} shell input keyevent 279`); // paste sometimes
sh(`adb -s ${serial} shell input keyevent 123`); // move end? skip
sh(`adb -s ${serial} shell input keyevent 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67`);
sleep(200);
sh(`adb -s ${serial} shell input text "cycle.qa.phase6\\@medicard.ge"`);
sleep(400);
sh(`adb -s ${serial} shell input tap 551 1369`);
sleep(400);
sh(`adb -s ${serial} shell input text "CycleQaPhase6\\!"`);
sleep(400);
sh(`adb -s ${serial} shell input keyevent 4`);
sleep(400);
tapNeedles('შესვლა');
sleep(8000);
console.log(dump());
