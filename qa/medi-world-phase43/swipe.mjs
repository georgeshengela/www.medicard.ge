import { execFileSync } from 'node:child_process';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';
const [x1, y1, x2, y2] = process.argv.slice(2);
execFileSync(adb, [
  '-s',
  serial,
  'shell',
  'input',
  'swipe',
  String(x1),
  String(y1),
  String(x2),
  String(y2),
  '400',
]);
console.log('swiped', x1, y1, '->', x2, y2);
