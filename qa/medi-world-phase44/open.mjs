import { execFileSync } from 'node:child_process';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const path = process.argv[2] || 'medi-world/garden';
execFileSync(adb, [
  '-s',
  'emulator-5554',
  'shell',
  'am',
  'start',
  '-a',
  'android.intent.action.VIEW',
  '-d',
  `exp://10.0.2.2:8081/--/${path}`,
]);
console.log('opened', path);
