import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';

function run(args) {
  return execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function dump() {
  run(['shell', 'rm', '-f', '/sdcard/uidump.xml']);
  run(['shell', 'uiautomator', 'dump', '/sdcard/uidump.xml']);
  execFileSync(adb, ['-s', serial, 'pull', '/sdcard/uidump.xml', join(process.env.TEMP, 'uidump.xml')]);
  return readFileSync(join(process.env.TEMP, 'uidump.xml'), 'utf8');
}

function attr(node, name) {
  const match = node.match(new RegExp(`${name}="([^"]*)"`));
  return match ? mDecode(match[1]) : '';
}

function mDecode(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function bounds(node) {
  const raw = attr(node, 'bounds');
  const match = raw.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return null;
  return {
    x1: Number(match[1]),
    y1: Number(match[2]),
    x2: Number(match[3]),
    y2: Number(match[4]),
  };
}

const cmd = process.argv[2];
const needle = process.argv[3] || '';

if (cmd === 'shot') {
  const name = needle;
  const buf = execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 20 * 1024 * 1024 });
  const dest = join('qa', 'medi-world-phase40', `${name}.png`);
  writeFileSync(dest, buf);
  console.log(`wrote ${dest} bytes=${buf.length}`);
  process.exit(0);
}

if (cmd === 'open') {
  const path = needle || 'medi-world/care-space';
  run([
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `exp://127.0.0.1:8081/--/${path}`,
  ]);
  console.log(`opened ${path}`);
  process.exit(0);
}

if (cmd === 'swipe') {
  run(['shell', 'input', 'swipe', '540', '1800', '540', '700', '400']);
  console.log('swiped up');
  process.exit(0);
}

if (cmd === 'tap-text') {
  const xml = dump();
  const nodes = [...xml.matchAll(/<node [^>]+>/g)].map((m) => m[0]);
  const hit = nodes.find((node) => attr(node, 'text').includes(needle) || attr(node, 'content-desc').includes(needle));
  if (!hit) {
    console.error(`not found: ${needle}`);
    process.exit(2);
  }
  const box = bounds(hit);
  const x = Math.round((box.x1 + box.x2) / 2);
  const y = Math.round((box.y1 + box.y2) / 2);
  run(['shell', 'input', 'tap', String(x), String(y)]);
  console.log(`tapped ${needle} at ${x},${y}`);
  process.exit(0);
}

if (cmd === 'texts') {
  const xml = dump();
  const nodes = [...xml.matchAll(/<node [^>]+>/g)].map((m) => m[0]);
  const texts = nodes
    .map((node) => attr(node, 'text') || attr(node, 'content-desc'))
    .filter(Boolean);
  console.log(texts.slice(0, 80).join('\n'));
  process.exit(0);
}

const xml = dump();
console.log(xml.slice(0, 400));
