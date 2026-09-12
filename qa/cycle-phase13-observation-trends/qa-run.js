/**
 * Phase 12 Android capture helper.
 * Usage: node qa/cycle-phase12-rich-tracking/qa-run.js dump|shot name|tap regex|coord x y|cycle|reload|font 1.0|night yes|size 1080x2400
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
    sh(`adb -s ${serial} shell uiautomator dump /sdcard/ui-p12.xml`);
  } catch {
    /* ignore */
  }
  const xmlPath = path.join(dir, '_live.xml');
  sh(`adb -s ${serial} pull /sdcard/ui-p12.xml "${xmlPath}"`);
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
  console.log(JSON.stringify(nodes.filter((n) => n.t || n.d).slice(0, 120), null, 2));
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
} else if (action === 'cycle') {
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/cycle"`);
} else if (action === 'reload') {
  sh(`adb -s ${serial} shell am force-stop host.exp.exponent`);
  sleep(800);
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/cycle"`);
} else if (action === 'font') {
  sh(`adb -s ${serial} shell settings put system font_scale ${process.argv[3]}`);
} else if (action === 'night') {
  sh(`adb -s ${serial} shell cmd uimode night ${process.argv[3]}`);
} else if (action === 'size') {
  sh(`adb -s ${serial} shell wm size ${process.argv[3]}`);
} else if (action === 'swipe') {
  sh(`adb -s ${serial} shell input swipe ${process.argv.slice(3).join(' ')}`);
} else {
  console.error('dump | shot name | tap regex | coord x y | cycle | reload | font n | night yes|no | size WxH | swipe x1 y1 x2 y2 ms');
  process.exit(1);
}
