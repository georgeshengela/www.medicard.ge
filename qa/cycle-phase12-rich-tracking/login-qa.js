const { execSync } = require('child_process');
const path = require('path');
const serial = process.env.ADB_SERIAL || 'emulator-5554';
const tapJs = path.join(__dirname, 'qa-run.js');

function sh(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function typePassword() {
  const seq = [
    [59, 31], // C
    53, // y
    31, // c
    40, // l
    33, // e
    [59, 45], // Q
    29, // a
    [59, 44], // P
    36, // h
    29, // a
    47, // s
    33, // e
    13, // 6
    [59, 8], // !
  ];
  for (const code of seq) {
    const args = Array.isArray(code) ? code.join(' ') : String(code);
    sh(`adb -s ${serial} shell input keyevent ${args}`);
    sleep(50);
  }
}

sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081"`);
sleep(12000);
sh(`node "${tapJs}" tap "უკვე გაქვთ ანგარიში"`);
sleep(2500);
sh(`adb -s ${serial} shell input tap 577 1116`);
sleep(400);
sh(`adb -s ${serial} shell input text "cycle.qa.phase6\\@medicard.ge"`);
sleep(400);
sh(`adb -s ${serial} shell input tap 551 1369`);
sleep(400);
typePassword();
sleep(300);
sh(`adb -s ${serial} shell input tap 540 1006`);
sleep(700);
sh(`node "${tapJs}" tap "შესვლა"`);
sleep(8000);
sh(`node "${tapJs}" dump`);
