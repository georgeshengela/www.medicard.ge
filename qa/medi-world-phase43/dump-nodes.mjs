import { readFileSync } from 'node:fs';
const xml = readFileSync('qa/medi-world-phase43/uidump.xml', 'utf8');
const nodes = [...xml.matchAll(/<node [^>]+>/g)].map((row) => row[0]);
for (const node of nodes) {
  const klass = node.match(/class="([^"]+)"/)?.[1] || '';
  const text = node.match(/text="([^"]*)"/)?.[1] || '';
  const bounds = node.match(/bounds="([^"]+)"/)?.[1] || '';
  if (klass.includes('Edit') || text) {
    console.log(`${klass}\t${JSON.stringify(text)}\t${bounds}`);
  }
}
