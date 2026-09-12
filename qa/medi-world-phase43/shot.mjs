import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';
const outDir = join('qa', 'medi-world-phase43');
mkdirSync(outDir, { recursive: true });

const name = process.argv[2];
if (!name) {
  console.error('usage: node qa/medi-world-phase43/shot.mjs <filename-without-ext>');
  process.exit(1);
}

const buf = execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p'], {
  maxBuffer: 20 * 1024 * 1024,
});
const dest = join(outDir, `${name}.png`);
writeFileSync(dest, buf);
console.log(`wrote ${dest} bytes=${buf.length}`);
