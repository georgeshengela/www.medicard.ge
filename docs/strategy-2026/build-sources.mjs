// Builds parts/95-sources.html (the source appendix) from refs/*.json written by each section.
// node docs/strategy-2026/build-sources.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SECTIONS = [
  ['p1', 'ნაწილი 1 · პრობლემა'],
  ['p2', 'ნაწილი 2 · მომხმარებლები'],
  ['p3', 'ნაწილი 3–4 · მეცნიერება და MEDICARD დღეს'],
  ['p5', 'ნაწილი 5 · პროდუქტი'],
  ['p6', 'ნაწილი 6 · პოპულარიზაცია'],
  ['p7', 'ნაწილი 7 · იდეის განვითარება'],
];
const PER_SLIDE = 22;

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const seen = new Set();
const rows = [];
for (const [key, label] of SECTIONS) {
  const file = join(here, 'refs', `${key}.json`);
  if (!existsSync(file)) continue;
  let list = [];
  try { list = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.warn(`bad json ${file}: ${e.message}`); }
  for (const r of list) {
    const url = (r.url || '').trim();
    const id = url || r.short;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({ label, short: r.short, full: r.full, url });
  }
}

const chunks = [];
for (let i = 0; i < rows.length; i += PER_SLIDE) chunks.push(rows.slice(i, i + PER_SLIDE));
const shortUrl = u => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const slides = chunks.map((chunk, i) => {
  let last = '';
  const items = chunk.map(r => {
    const head = r.label !== last ? `<li class="grp">${esc(r.label)}</li>` : '';
    last = r.label;
    const web = /^https?:\/\//.test(r.url || '');
    const repoPath = (r.url || '').replace(/^file:\/\/\/home\/user\/www\.medicard\.ge\//, '');
    const link = web ? `<a href="${esc(r.url)}">${esc(shortUrl(r.url).slice(0, 90))}</a>`
      : `<span class="repo">MEDICARD-ის კოდი${repoPath && repoPath !== r.url ? ': ' + esc(repoPath) : ''}</span>`;
    return `${head}<li><b>${esc(r.short)}</b>${r.full ? ` — ${esc(r.full)}` : ''}<br>${link}</li>`;
  }).join('\n');
  return `<section class="slide sources">
  <div class="eyebrow">დანართი · წყაროები ${chunks.length > 1 ? `${i + 1} / ${chunks.length}` : ''}</div>
  <h2 style="font-size:40px">სად შევამოწმეთ ყოველი ციფრი</h2>
  <div class="body" style="margin-top:20px">
    <ul class="refs">${items}</ul>
  </div>
  <div class="chrome"><span class="brand"><svg style="fill:#14B8A6"><use href="#mk"/></svg>მედიქარდი</span><span class="part">დანართი · წყაროები</span><span class="num"></span></div>
</section>`;
}).join('\n');

writeFileSync(join(here, 'parts', '95-sources.html'), slides + '\n');
console.log(`${rows.length} sources on ${chunks.length} slide(s) → parts/95-sources.html`);
