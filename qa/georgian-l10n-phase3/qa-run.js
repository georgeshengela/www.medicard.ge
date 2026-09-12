/**
 * Phase 3 Georgian localization Android capture helper.
 * Usage: node qa/georgian-l10n-phase3/qa-run.js dump|shot name|tap regex|coord x y|font 1.0|night yes|size 1080x2400|open path|reload|swipe
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serial = process.env.ADB_SERIAL || 'emulator-5554';
const dir = path.join(__dirname, 'shots');

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
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${name}.png`);
  sh(`adb -s ${serial} shell screencap -p /sdcard/l10n-qa.png`);
  sh(`adb -s ${serial} pull /sdcard/l10n-qa.png "${dest}"`);
  console.log('SHOT', dest);
}
function dump() {
  try {
    sh(`adb -s ${serial} shell uiautomator dump /sdcard/ui-l10n.xml`);
  } catch {
    /* ignore */
  }
  const xmlPath = path.join(__dirname, '_live.xml');
  sh(`adb -s ${serial} pull /sdcard/ui-l10n.xml "${xmlPath}"`);
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const nodes = [...xml.matchAll(/text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map(
    (m) => ({
      t: m[1],
      x: Math.round((Number(m[2]) + Number(m[4])) / 2),
      y: Math.round((Number(m[3]) + Number(m[5])) / 2),
      y1: Number(m[3]),
      y2: Number(m[5]),
      x1: Number(m[2]),
      x2: Number(m[4]),
    }),
  );
  return { xml, nodes };
}
function find(nodes, re) {
  return nodes.find((n) => re.test(n.t || ''));
}
function openPath(dest) {
  const route = dest.startsWith('/') ? dest : `/${dest}`;
  const url = `exp://10.0.2.2:8081/--${route}`;
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "${url}"`);
  console.log('OPEN', url);
}

const action = process.argv[2];
if (action === 'dump') {
  const { nodes } = dump();
  console.log(JSON.stringify(nodes.filter((n) => n.t).slice(0, 240), null, 2));
} else if (action === 'shot') {
  shot(process.argv[3]);
} else if (action === 'tap') {
  const { nodes } = dump();
  const hit = find(nodes, new RegExp(process.argv[3]));
  if (!hit) {
    console.error('NOT_FOUND', process.argv[3]);
    process.exit(2);
  }
  console.log('TAP', hit.t, hit.x, hit.y);
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
  const needle = new RegExp(process.argv[3] || '.');
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
  openPath(process.argv[3] || '/home');
} else if (action === 'reload') {
  sh(`adb -s ${serial} shell am force-stop host.exp.exponent`);
  sleep(800);
  openPath(process.argv[3] || '/home');
} else if (action === 'swipe') {
  const x1 = process.argv[3] || 540;
  const y1 = process.argv[4] || 1700;
  const x2 = process.argv[5] || x1;
  const y2 = process.argv[6] || 700;
  sh(`adb -s ${serial} shell input swipe ${x1} ${y1} ${x2} ${y2} 400`);
} else if (action === 'text') {
  sh(`adb -s ${serial} shell input text ${JSON.stringify(process.argv[3] || '')}`);
} else if (action === 'key') {
  sh(`adb -s ${serial} shell input keyevent ${process.argv[3]}`);
} else {
  console.log('dump|shot name|tap regex|coord x y|open path|reload|swipe|wait regex|size|font|night');
}
