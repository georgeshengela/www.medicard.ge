import { execFileSync } from 'node:child_process';

const adb = 'C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const serial = 'emulator-5554';
const origin = { lat: 37.422, lng: -122.084 };
const stepM = 16;
const latStep = stepM / 111_320;
const count = Number(process.argv[2] || 6);
const pauseMs = Number(process.argv[3] || 10_000);
const startIndex = Number(process.argv[4] || 1);

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

for (let i = startIndex; i < startIndex + count; i += 1) {
  const lat = origin.lat + latStep * i;
  execFileSync(adb, ['-s', serial, 'emu', 'geo', 'fix', String(origin.lng), String(lat)]);
  console.log('fix', i, lat.toFixed(6), origin.lng);
  if (i < startIndex + count - 1) sleep(pauseMs);
}
console.log('done');
