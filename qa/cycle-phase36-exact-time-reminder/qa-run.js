/**
 * Phase 36 Android capture helper.
 * Usage: node qa/cycle-phase36-exact-time-reminder/qa-run.js dump|shot name|tap regex|coord x y|font 1.0|night yes|size 1080x2400|open cycle|events|grant
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serial = process.env.ADB_SERIAL || 'emulator-5554';
const dir = __dirname;

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function tap(x, y) {
  sh(`adb -s ${serial} shell input tap ${x} ${y}`);
}
function shot(name) {
  const dest = path.join(dir, `${name}.png`);
  sh(`adb -s ${serial} shell screencap -p /sdcard/cycle-qa.png`);
  sh(`adb -s ${serial} pull /sdcard/cycle-qa.png "${dest}"`);
  console.log('SHOT', dest);
}
function dump() {
  try {
    sh(`adb -s ${serial} shell uiautomator dump /sdcard/ui-p36.xml`);
  } catch {
    /* ignore */
  }
  const xmlPath = path.join(dir, '_live.xml');
  sh(`adb -s ${serial} pull /sdcard/ui-p36.xml "${xmlPath}"`);
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const nodes = [...xml.matchAll(/text="([^"]*)"[^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map(
    (m) => ({
      t: m[1],
      d: m[2],
      x: Math.round((Number(m[3]) + Number(m[5])) / 2),
      y: Math.round((Number(m[4]) + Number(m[6])) / 2),
      y1: Number(m[4]),
      y2: Number(m[6]),
    }),
  );
  return { xml, nodes };
}
function find(nodes, re) {
  return nodes.find((n) => re.test(`${n.t} ${n.d}`));
}

const action = process.argv[2];
if (action === 'dump') {
  const { nodes } = dump();
  console.log(JSON.stringify(nodes.filter((n) => n.t || n.d).slice(0, 180), null, 2));
} else if (action === 'shot') {
  shot(process.argv[3]);
} else if (action === 'tap') {
  const { nodes } = dump();
  const hit = find(nodes, new RegExp(process.argv[3]));
  if (!hit) {
    console.error('NOT_FOUND', process.argv[3]);
    process.exit(2);
  }
  console.log('TAP', hit.t || hit.d, hit.x, hit.y);
  tap(hit.x, hit.y);
} else if (action === 'coord') {
  tap(process.argv[3], process.argv[4]);
} else if (action === 'font') {
  sh(`adb -s ${serial} shell settings put system font_scale ${process.argv[3]}`);
} else if (action === 'night') {
  sh(`adb -s ${serial} shell cmd uimode night ${process.argv[3]}`);
} else if (action === 'size') {
  if (process.argv[3] === 'reset') sh(`adb -s ${serial} shell wm size reset`);
  else sh(`adb -s ${serial} shell wm size ${process.argv[3]}`);
} else if (action === 'wait') {
  const t0 = Date.now();
  const timeout = Number(process.argv[4]) || 40000;
  const needle = new RegExp(process.argv[3] || 'ჟურნალი');
  let ok = false;
  while (Date.now() - t0 < timeout) {
    const { xml } = dump();
    if (needle.test(xml)) {
      ok = true;
      break;
    }
    sleep(1500);
  }
  console.log(ok ? 'READY' : 'TIMEOUT');
  process.exit(ok ? 0 : 1);
} else if (action === 'open') {
  const dest = process.argv[3] || 'cycle';
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/${dest}"`);
} else if (action === 'grant') {
  const pkgs = ['host.exp.exponent', 'ge.medicard.app'];
  for (const pkg of pkgs) {
    try {
      sh(`adb -s ${serial} shell pm grant ${pkg} android.permission.POST_NOTIFICATIONS`);
      console.log('GRANTED', pkg);
    } catch (err) {
      console.log('SKIP', pkg, String(err.message || err).split('\n')[0]);
    }
  }
} else if (action === 'events') {
  const out = sh(
    `adb -s ${serial} shell content query --uri content://com.android.calendar/events --projection _id:title:dtstart:dtend:allDay:hasAlarm:description`,
  );
  const dest = path.join(dir, 'native-events.txt');
  fs.writeFileSync(dest, out);
  console.log(out);
  console.log('WROTE', dest);
} else if (action === 'swipe') {
  const x1 = process.argv[3] || 540;
  const y1 = process.argv[4] || 1700;
  const x2 = process.argv[5] || x1;
  const y2 = process.argv[6] || 700;
  sh(`adb -s ${serial} shell input swipe ${x1} ${y1} ${x2} ${y2} 400`);
} else if (action === 'scrollto') {
  const needle = new RegExp(process.argv[3] || 'შემახსენე');
  const timeout = Number(process.argv[4]) || 18000;
  const swipeDir = process.argv[5] === 'up' ? 'up' : 'down';
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < timeout) {
    const { xml } = dump();
    if (needle.test(xml)) {
      ok = true;
      break;
    }
    if (swipeDir === 'up') {
      sh(`adb -s ${serial} shell input swipe 540 800 540 1900 320`);
    } else {
      sh(`adb -s ${serial} shell input swipe 540 1550 540 1050 320`);
    }
    sleep(650);
  }
  console.log(ok ? 'READY' : 'TIMEOUT');
  process.exit(ok ? 0 : 1);
} else {
  console.log('dump|shot name|tap regex|coord x y|font 1.0|night yes|size 1080x2400|open cycle|events|grant');
}
