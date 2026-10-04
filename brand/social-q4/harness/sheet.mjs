#!/usr/bin/env node
// Writes ../out/index.json from shots.mjs (+ extra frames) for every PNG that exists, then the contact sheet.
import { existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS } from './shots.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'out');
const EXTRA = [
  { name: 'run-gift-find', route: '/run/active', persona: 'man', theme: 'light', notes: 'frame before opening (same flow as run-gift)', whatIsVisible: 'Box found — „აღმოჩენა!“, 50 Medi Coins, you would be first, „ყუთის გახსნა“' },
  { name: 'run-gift-burst', route: '/run/active', persona: 'man', theme: 'light', notes: '250 ms after opening: coins still flying, counter mid-count (+26)', whatIsVisible: 'Box bursting open, coins flying, counter counting up' },
];
const skip = new Set(process.argv.slice(2));
const index = [];
for (const s of SHOTS) {
  if (!existsSync(join(OUT, `${s.name}.png`)) || skip.has(s.name)) continue;
  index.push({
    name: s.name,
    route: s.route,
    persona: s.signedOut ? 'signed out' : (s.persona || 'man') === 'man' ? 'გიორგი (man, 38)' : 'ნინო (women, 31)',
    theme: s.theme || 'light',
    at: `${(s.at || '2026-10-05T10:15').replace('T', ' ')} Tbilisi`,
    full: existsSync(join(OUT, `${s.name}-full.png`)) ? `${s.name}-full.png` : null,
    notes: s.notes || '',
    whatIsVisible: s.visible || '',
  });
}
for (const e of EXTRA) if (existsSync(join(OUT, `${e.name}.png`))) index.push({ ...e, at: '2026-10-22 10:15 Tbilisi', full: null });
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
console.log(`index.json: ${index.length} shots`);
execFileSync('python', [join(here, 'sheet.py'), OUT, ...index.map((i) => i.name)], { stdio: 'inherit' });
