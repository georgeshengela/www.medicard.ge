import { readFileSync } from 'node:fs';

const svg = readFileSync('C:/Users/User/Desktop/Medicard DESIGN/assets/Comprehensive Health Assessment.svg', 'utf8');
const re = /transform="translate\((\d+) 360\)"/g;
const xs = [];
for (const m of svg.matchAll(re)) xs.push(Number(m[1]));
console.log('screens:', xs.length);
xs.forEach((x, i) => console.log(String(i + 1).padStart(2), x));
