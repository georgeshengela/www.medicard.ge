import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';
const dest = 'qa/medi-world-phase43/uidump.xml';

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

let lastErr = '';
for (let i = 0; i < 12; i += 1) {
  try {
    execFileSync(adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/uidump.xml'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    execFileSync(adb, ['-s', serial, 'pull', '/sdcard/uidump.xml', dest], { stdio: 'pipe' });
    const xml = readFileSync(dest, 'utf8');
    if (xml.includes('<node') && xml.length > 500) {
      console.log('dump-ok', i, 'bytes', xml.length);
      process.exit(0);
    }
  } catch (err) {
    lastErr = String(err?.stderr || err?.message || err);
  }
  sleep(800);
}

writeFileSync(dest, lastErr || 'dump-failed');
console.error('dump-failed', lastErr.slice(0, 400));
process.exit(1);
