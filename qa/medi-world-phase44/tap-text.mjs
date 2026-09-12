import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';
const dest = 'qa/medi-world-phase44/uidump.xml';
mkdirSync('qa/medi-world-phase44', { recursive: true });

const needle = (process.argv[2] || '').toLowerCase();
if (!needle) {
  console.error('usage: node tap-text.mjs <substring>');
  process.exit(1);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function dump() {
  try {
    execFileSync(adb, ['-s', serial, 'shell', 'rm', '-f', '/sdcard/uidump.xml'], { stdio: 'pipe' });
  } catch {
    /* ignore */
  }
  execFileSync(adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/uidump.xml'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  execFileSync(adb, ['-s', serial, 'pull', '/sdcard/uidump.xml', dest], { stdio: 'pipe' });
  return readFileSync(dest, 'utf8');
}

let xml = '';
for (let i = 0; i < 8; i += 1) {
  try {
    xml = dump();
    if (xml.includes('<node') && xml.length > 8000) break;
  } catch (err) {
    xml = String(err?.stderr || err?.message || '');
  }
  sleep(700);
}

const nodes = [...xml.matchAll(/<node [^>]+>/g)].map((row) => row[0]);
const hit = [...nodes].reverse().find((node) => {
  const text = (node.match(/text="([^"]*)"/)?.[1] || '').toLowerCase();
  const desc = (node.match(/content-desc="([^"]*)"/)?.[1] || '').toLowerCase();
  return text.includes(needle) || desc.includes(needle);
});
if (!hit) {
  const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((row) => row[1]).filter(Boolean);
  console.error('not-found', needle);
  console.error('texts', texts.slice(0, 40).join(' | '));
  process.exit(2);
}
const bounds = hit.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
const x = Math.floor((Number(bounds[1]) + Number(bounds[3])) / 2);
const y = Math.floor((Number(bounds[2]) + Number(bounds[4])) / 2);
execFileSync(adb, ['-s', serial, 'shell', 'input', 'tap', String(x), String(y)]);
console.log('tapped', needle, x, y);
