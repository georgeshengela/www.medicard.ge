// Assembles parts/*.html (sorted by name) into deck.html.
// node docs/strategy-2026/build.mjs [--only parts/p3.html] [--out deck.html]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'deck.html';
const files = only ? [resolve(here, only)] : readdirSync(join(here, 'parts')).filter(f => f.endsWith('.html')).sort().map(f => join(here, 'parts', f));
const body = files.map(f => readFileSync(f, 'utf8')).join('\n');
const LOGO = 'M42.75 12.75C47.2687 12.75 50.9318 16.4131 50.9318 20.9318V22.5682H52.5682C57.0869 22.5682 60.75 26.2313 60.75 30.75C60.75 35.2687 57.0869 38.9318 52.5682 38.9318H50.9318V40.5682C50.9318 45.0869 47.2687 48.75 42.75 48.75C38.2313 48.75 34.5682 45.0869 34.5682 40.5682V38.9318H32.9318C28.4131 38.9318 24.75 35.2687 24.75 30.75C24.75 26.2313 28.4131 22.5682 32.9318 22.5682H34.5682V20.9318C34.5682 16.4131 38.2313 12.75 42.75 12.75ZM50.8407 25.8409C50.0861 32.6671 44.6671 38.0861 37.8409 38.8407V40.5682C37.8409 43.2794 40.0388 45.4773 42.75 45.4773C45.4612 45.4773 47.6591 43.2794 47.6591 40.5682V37.2955C47.6591 36.3917 48.3917 35.6591 49.2955 35.6591H52.5682C55.2794 35.6591 57.4773 33.4612 57.4773 30.75C57.4773 28.0388 55.2794 25.8409 52.5682 25.8409H50.8407ZM42.75 16.0227C40.0388 16.0227 37.8409 18.2206 37.8409 20.9318V24.2045C37.8409 25.1083 37.1083 25.8409 36.2045 25.8409H32.9318C30.2206 25.8409 28.0227 28.0388 28.0227 30.75C28.0227 33.4612 30.2206 35.6591 32.9318 35.6591H34.6593C35.4139 28.8329 40.8329 23.4131 47.6591 22.6585V20.9318C47.6591 18.2206 45.4612 16.0227 42.75 16.0227ZM47.5225 25.9767C42.616 26.7391 38.7391 30.616 37.9767 35.5225C42.8838 34.7603 46.7603 30.8838 47.5225 25.9767Z';
const html = `<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<title>MEDICARD · ჯანსაღი ცხოვრების სტრატეგია 2026–2027</title>
<link rel="stylesheet" href="deck.css">
</head>
<body>
<svg width="0" height="0" style="position:absolute"><symbol id="mk" viewBox="24.75 12.75 36 36"><path fill-rule="evenodd" d="${LOGO}"/></symbol></svg>
${body}
<script>
// Page numbers and the brand mark in every footer.
document.querySelectorAll('.slide').forEach((s, i) => {
  const n = s.querySelector('.chrome .num');
  if (n) n.textContent = String(i + 1).padStart(2, '0');
});
</script>
</body>
</html>
`;
writeFileSync(resolve(here, out), html);
console.log(`${files.length} part file(s) → ${out}`);
