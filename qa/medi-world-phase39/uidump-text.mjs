import { readFileSync } from 'node:fs';

const xml = readFileSync(`${process.env.TEMP}/uidump.xml`, 'utf8');
const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).filter((t) => t.trim());
const contentDesc = [...xml.matchAll(/content-desc="([^"]+)"/g)].map((m) => m[1]).filter((t) => t.trim());
console.log('TEXT:');
console.log([...new Set(texts)].join('\n'));
console.log('DESC:');
console.log([...new Set(contentDesc)].join('\n'));
