const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const serial = process.env.ADB_SERIAL || 'emulator-5554';
const xmlPath = path.join(__dirname, '_ui-live.xml');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}

function dump() {
  try {
    sh(`adb -s ${serial} shell uiautomator dump /sdcard/ui.xml`);
  } catch {
    /* dump can fail while animating */
  }
  sh(`adb -s ${serial} pull /sdcard/ui.xml "${xmlPath}"`);
  return fs.readFileSync(xmlPath, 'utf8');
}

function nodes(xml) {
  return [...xml.matchAll(/text="([^"]*)"[^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map(
    (m) => ({
      text: m[1],
      desc: m[2],
      x: Math.round((Number(m[3]) + Number(m[5])) / 2),
      y: Math.round((Number(m[4]) + Number(m[6])) / 2),
    }),
  );
}

function tap(x, y) {
  sh(`adb -s ${serial} shell input tap ${x} ${y}`);
}

function findAndTap(needles) {
  const xml = dump();
  const list = nodes(xml);
  const hit = list.find((n) => needles.some((needle) => (n.text + ' ' + n.desc).includes(needle)));
  if (!hit) {
    console.error('NOT_FOUND', needles, list.map((n) => n.text || n.desc).filter(Boolean).slice(0, 30));
    process.exit(2);
  }
  console.log('TAP', hit.text || hit.desc, hit.x, hit.y);
  tap(hit.x, hit.y);
}

const action = process.argv[2];
if (action === 'dump') {
  const xml = dump();
  console.log(JSON.stringify(nodes(xml).filter((n) => n.text || n.desc), null, 2));
} else if (action === 'tap') {
  findAndTap(process.argv.slice(3));
} else if (action === 'coord') {
  tap(process.argv[3], process.argv[4]);
} else {
  console.error('usage: dump | tap <needle...> | coord x y');
  process.exit(1);
}
