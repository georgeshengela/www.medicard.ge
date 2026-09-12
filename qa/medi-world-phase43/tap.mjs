import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';
const needle = process.argv[2];
if (!needle) process.exit(1);

mkdirSync('qa/medi-world-phase43', { recursive: true });
execFileSync(adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/uidump.xml']);
execFileSync(adb, ['-s', serial, 'pull', '/sdcard/uidump.xml', 'qa/medi-world-phase43/uidump.xml']);
const xml = readFileSync('qa/medi-world-phase43/uidump.xml', 'utf8');
const nodes = [...xml.matchAll(/<node [^>]+>/g)].map((row) => row[0]);
const hit = nodes.reverse().find((node) => node.includes(`text="${needle}"`) || node.includes(`content-desc="${needle}"`));
if (!hit) {
  console.error('NOTFOUND', needle);
  process.exit(2);
}
const bounds = hit.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
const x = Math.floor((Number(bounds[1]) + Number(bounds[3])) / 2);
const y = Math.floor((Number(bounds[2]) + Number(bounds[4])) / 2);
execFileSync(adb, ['-s', serial, 'shell', 'input', 'tap', String(x), String(y)]);
console.log('tapped', needle, x, y);
