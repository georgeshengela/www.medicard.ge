const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serial = process.env.ADB_SERIAL || 'emulator-5554';
const root = __dirname;
const shots = path.join(root, 'shots');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function openRoute(route) {
  const url = `exp://10.0.2.2:8081/--${route.startsWith('/') ? route : '/' + route}`;
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "${url}"`);
  sleep(4000);
}
function shot(name) {
  fs.mkdirSync(shots, { recursive: true });
  const dest = path.join(shots, `${name}.png`);
  sh(`adb -s ${serial} shell screencap -p /sdcard/l10n-qa.png`);
  sh(`adb -s ${serial} pull /sdcard/l10n-qa.png "${dest}"`);
  console.log('SHOT', name);
  return dest;
}
function dump() {
  try {
    sh(`adb -s ${serial} shell uiautomator dump /sdcard/ui-l10n.xml`);
  } catch {
    /* ignore */
  }
  const xmlPath = path.join(root, '_live.xml');
  sh(`adb -s ${serial} pull /sdcard/ui-l10n.xml "${xmlPath}"`);
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const nodes = [...xml.matchAll(/text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map(
    (m) => ({
      t: m[1],
      x: Math.round((Number(m[2]) + Number(m[4])) / 2),
      y: Math.round((Number(m[3]) + Number(m[5])) / 2),
    }),
  );
  return { xml, nodes: nodes.filter((n) => n.t) };
}
function tapRe(re) {
  const { nodes } = dump();
  const hit = nodes.find((n) => re.test(n.t || ''));
  if (!hit) {
    console.log('NOT_FOUND', re);
    return false;
  }
  console.log('TAP', hit.t, hit.x, hit.y);
  sh(`adb -s ${serial} shell input tap ${hit.x} ${hit.y}`);
  return true;
}
function waitRe(re, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const { xml } = dump();
    if (re.test(xml)) return true;
    sleep(1200);
  }
  return false;
}

const notes = [];

function rec(id, status, extra) {
  notes.push({ id, status, extra });
  console.log(status, id, extra || '');
}

// Home → real assessment CTA
openRoute('/home');
waitRe(/დაასრულეთ შეფასება|გამარჯობა/, 20000);
shot('26-home-before-assessment');
if (tapRe(/დაასრულეთ შეფასება/)) {
  sleep(5000);
  waitRe(/გსურთ|ეწევ|მედიკამენტ|მდგომარეობ|გაგრძელება|სახელი/, 20000);
  shot('27-assessment-from-home');
  rec('27-assessment-from-home', 'captured', dump().nodes.map((n) => n.t).slice(0, 20).join(' | '));
} else {
  rec('27-assessment-from-home', 'blocked', 'CTA not tappable');
}

// Sign-in validation
openRoute('/sign-in?preview=1');
waitRe(/შესვლა/, 15000);
if (tapRe(/^შესვლა$/)) {
  sleep(1500);
  shot('28-sign-in-validation');
  rec('28-sign-in-validation', 'captured', dump().nodes.map((n) => n.t).slice(0, 16).join(' | '));
}

// Network error: disable radios, submit dummy creds, restore
openRoute('/sign-in?preview=1');
waitRe(/შესვლა/, 15000);
tapRe(/შეიყვანეთ ელ-ფოსტა/);
sleep(400);
sh('adb -s emulator-5554 shell input text qa.offline@medicard.ge');
sleep(400);
tapRe(/შეიყვანეთ პაროლი/);
sleep(400);
sh('adb -s emulator-5554 shell input text WrongPass123');
try {
  sh('adb -s emulator-5554 shell svc wifi disable');
  sh('adb -s emulator-5554 shell svc data disable');
} catch (e) {
  rec('29-network', 'wifi-toggle-error', String(e.message || e));
}
sleep(800);
tapRe(/^შესვლა$/);
sleep(4000);
shot('29-sign-in-network');
rec('29-sign-in-network', 'captured', dump().nodes.map((n) => n.t).slice(0, 20).join(' | '));
try {
  sh('adb -s emulator-5554 shell svc wifi enable');
  sh('adb -s emulator-5554 shell svc data enable');
} catch {
  /* ignore */
}
sleep(2500);

// Hydration expand level 2
openRoute('/health-metrics/hydration/level');
waitRe(/წყლის მიღება/, 15000);
tapRe(/წყლის მიღება დაბალია/);
sleep(800);
shot('30-hydration-level-2');
rec('30-hydration-level-2', 'captured', dump().nodes.map((n) => n.t).slice(0, 20).join(' | '));

// Cycle settings for contraception
openRoute('/cycle/settings');
waitRe(/ციკლ|კონტრაცეპტ|პარამეტრ|საშუალო/, 18000);
shot('31-cycle-settings');
rec('31-cycle-settings', 'captured', dump().nodes.map((n) => n.t).slice(0, 24).join(' | '));
if (tapRe(/კონტრაცეპტ|დაცვის მეთოდ|პლასტირ/)) {
  sleep(1500);
  shot('32-contraception-picker');
  rec('32-contraception-picker', 'captured', dump().nodes.map((n) => n.t).slice(0, 24).join(' | '));
}

// Cycle log wait
openRoute('/cycle/log');
waitRe(/გამონადენ|სიმპტომ|ტკივილ|შენახვ/, 20000);
shot('33-cycle-log-loaded');
rec('33-cycle-log-loaded', 'captured', dump().nodes.map((n) => n.t).slice(0, 20).join(' | '));

// Compact viewport: 1080x1920
sh('adb -s emulator-5554 shell wm size 1080x1920');
sleep(1500);
openRoute('/health-metrics/hydration/level');
waitRe(/წყლის მიღება/, 15000);
shot('34-hydration-compact');
openRoute('/sign-in?preview=1');
waitRe(/შესვლა/, 15000);
shot('35-sign-in-compact');
openRoute('/cycle');
waitRe(/მენსტრუაცია|ციკლ/, 15000);
shot('36-cycle-compact');
sh('adb -s emulator-5554 shell wm size reset');
sleep(1000);

// Large-ish: keep 1080x2400 reset is standard. Try 1440x3120 if emulator allows
try {
  sh('adb -s emulator-5554 shell wm size 1440x3120');
  sleep(1500);
  openRoute('/home');
  waitRe(/გამარჯობა/, 15000);
  shot('37-home-large');
} catch (e) {
  rec('37-home-large', 'blocked', String(e.message || e));
}
sh('adb -s emulator-5554 shell wm size reset');

fs.writeFileSync(path.join(root, 'visual-followup.json'), JSON.stringify(notes, null, 2));
console.log('FOLLOWUP DONE', notes.length);
