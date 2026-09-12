import fs from 'fs';
const xml = fs.readFileSync(new URL('./_live.xml', import.meta.url), 'utf8');
const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
for (const t of texts.slice(0, 80)) console.log(t);
