import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';
const needle = (process.argv[2] || '').toLowerCase();
if (!needle) {
  console.error('usage: node tap-text.mjs <substring>');
  process.exit(1);
}

const xml = readFileSync('qa/medi-world-phase43/uidump.xml', 'utf8');
const nodes = [...xml.matchAll(/<node [^>]+>/g)].map((row) => row[0]);
const hit = nodes.find((node) => {
  const text = (node.match(/text="([^"]*)"/)?.[1] || '').toLowerCase();
  const desc = (node.match(/content-desc="([^"]*)"/)?.[1] || '').toLowerCase();
  return text.includes(needle) || desc.includes(needle);
});
if (!hit) {
  console.error('not-found', needle);
  process.exit(2);
}
const bounds = hit.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
const x = Math.floor((Number(bounds[1]) + Number(bounds[3]) ) / 2);
const y = Math.floor((Number(bounds[2]) + Number(bounds[4]) ) / 2);
execFileSync(adb, ['-s', serial, 'shell', 'input', 'tap', String(x), String(y)]);
console.log('tapped', needle, x, y, bounds[0]);
