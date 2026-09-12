import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';

function dump() {
  execFileSync(adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/uidump.xml']);
  execFileSync(adb, ['-s', serial, 'pull', '/sdcard/uidump.xml', 'qa/medi-world-phase43/uidump.xml']);
  return readFileSync('qa/medi-world-phase43/uidump.xml', 'utf8');
}

function edits(xml) {
  return [...xml.matchAll(/<node [^>]+>/g)]
    .map((row) => row[0])
    .filter((node) => node.includes('EditText') || node.includes('android.widget.EditText'))
    .map((node) => {
      const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      return {
        x: Math.floor((Number(bounds[1]) + Number(bounds[3])) / 2),
        y: Math.floor((Number(bounds[2]) + Number(bounds[4])) / 2),
        node,
      };
    });
}

function tap(x, y) {
  execFileSync(adb, ['-s', serial, 'shell', 'input', 'tap', String(x), String(y)]);
}

function typeSlow(text) {
  const encoded = text.replace(/ /g, '%s').replace(/@/g, '%40');
  execFileSync(adb, ['-s', serial, 'shell', 'input', 'text', encoded]);
}

function clearField() {
  for (let i = 0; i < 40; i += 1) {
    execFileSync(adb, ['-s', serial, 'shell', 'input', 'keyevent', '67']);
  }
}

execFileSync(adb, ['-s', serial, 'shell', 'input', 'keyevent', '4']);
await new Promise((r) => setTimeout(r, 400));
const xml = dump();
const fields = edits(xml);
console.log('edit-count', fields.length);
if (fields.length < 2) {
  console.log('texts', [...xml.matchAll(/text="([^"]+)"/g)].map((row) => row[1]).join(' | '));
  process.exit(2);
}

tap(fields[0].x, fields[0].y);
await new Promise((r) => setTimeout(r, 250));
clearField();
typeSlow('world.qa@medicard.test');
await new Promise((r) => setTimeout(r, 250));
tap(fields[1].x, fields[1].y);
await new Promise((r) => setTimeout(r, 250));
clearField();
typeSlow('Phase43WorldQa!');
console.log('filled');
