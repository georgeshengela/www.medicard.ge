import { readFileSync } from 'node:fs';
const xml = readFileSync('qa/medi-world-phase43/uidump.xml', 'utf8');
const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((row) => row[1]);
console.log([...new Set(texts)].join('\n'));
