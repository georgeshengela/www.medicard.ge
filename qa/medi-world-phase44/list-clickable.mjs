import { readFileSync } from 'node:fs';
const xml = readFileSync('qa/medi-world-phase44/uidump.xml', 'utf8');
for (const match of xml.matchAll(/<node [^>]+>/g)) {
  const s = match[0];
  if (!s.includes('clickable="true"')) continue;
  const t = s.match(/text="([^"]*)"/)?.[1] || '';
  const d = s.match(/content-desc="([^"]*)"/)?.[1] || '';
  const b = s.match(/bounds="([^"]+)"/)?.[1];
  console.log(b, JSON.stringify(t || d));
}
