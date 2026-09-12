import { execFileSync } from 'node:child_process';
const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const [x, y] = process.argv.slice(2);
execFileSync(adb, ['-s', 'emulator-5554', 'shell', 'input', 'tap', String(x), String(y)]);
console.log('tapped', x, y);
