/**
 * Phase 17 Android capture helper.
 * Usage: node qa/cycle-phase17-ttc-coldstart/qa-run.js dump|shot name|tap regex|coord x y|reload|font 1.0|night yes|size 1080x2400|cold
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
    sh(`adb -s ${serial} shell uiautomator dump /sdcard/ui-p17.xml`);
  } catch {
    /* ignore */
  }
  const xmlPath = path.join(dir, '_live.xml');
  sh(`adb -s ${serial} pull /sdcard/ui-p17.xml "${xmlPath}"`);
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
function waitFor(re, timeoutMs) {
  const t0 = Date.now();
  const needle = re && String(re) !== '1' ? new RegExp(re) : null;
  while (Date.now() - t0 < timeoutMs) {
    const { xml } = dump();
    if (needle ? needle.test(xml) : xml.length > 40000) {
      return true;
    }
    sleep(1500);
  }
  return false;
}

function closeExpo() {
  const { nodes } = dump();
  const overlay = nodes.some((n) => /^(Tools|Reload|Debug)$/i.test(n.t) || /^(Tools|Reload|Debug)$/i.test(n.d));
  if (!overlay) return false;
  const closer = find(nodes, /^(Close|Got it|OK)$/i);
  if (closer) {
    tap(closer.x, closer.y);
    sleep(800);
    return true;
  }
  return false;
}

function cold() {
  sh(`adb -s ${serial} shell am force-stop host.exp.exponent`);
  sleep(800);
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/cycle"`);
  console.log('COLD started exp://10.0.2.2:8081/--/cycle');
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'dump') {
  const { nodes } = dump();
  console.log(nodes.filter((n) => n.t || n.d).slice(0, 80));
} else if (cmd === 'shot') {
  shot(a);
} else if (cmd === 'tap') {
  const { nodes } = dump();
  const n = find(nodes, new RegExp(a, 'i'));
  if (!n) {
    console.error('NOT FOUND', a);
    process.exit(1);
  }
  tap(n.x, n.y);
  console.log('TAP', n);
} else if (cmd === 'coord') {
  tap(Number(a), Number(b));
} else if (cmd === 'font') {
  sh(`adb -s ${serial} shell settings put system font_scale ${a}`);
} else if (cmd === 'night') {
  sh(`adb -s ${serial} shell cmd uimode night ${a}`);
} else if (cmd === 'size') {
  sh(`adb -s ${serial} shell wm size ${a}`);
} else if (cmd === 'reload') {
  sh(`adb -s ${serial} shell input keyevent 82`);
  sleep(400);
} else if (cmd === 'wait') {
  const ok = waitFor(a || 'მიმოხილვა', Number(b) || 40000);
  console.log(ok ? 'READY' : 'TIMEOUT');
  process.exit(ok ? 0 : 1);
} else if (cmd === 'cold') {
  cold();
} else if (cmd === 'close') {
  console.log(closeExpo() ? 'CLOSED' : 'NO_EXPO');
} else if (cmd === 'swipe') {
  sh(`adb -s ${serial} shell input swipe ${a || 540} ${b || 1700} ${a || 540} ${process.argv[5] || 700} 400`);
} else {
  console.log('dump|shot name|tap regex|coord x y|font 1.0|night yes|size 1080x2400|cold|close|swipe');
}
