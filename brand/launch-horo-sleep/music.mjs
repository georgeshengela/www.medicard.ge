#!/usr/bin/env node
// Lyria 3 clip (30 s) through OpenRouter for the MEDIHOROSCOPE film -> out/music_<n>.<ext>.
//   node music.mjs <n> <variant>      (key: OPENROUTER_API_KEY from server/.env; ~$0.04 a clip)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(here, '../../server/.env'), 'utf8');
const KEY = (env.match(/^OPENROUTER_API_KEY=["']?([^"'\r\n]+)/m) || [])[1];
if (!KEY) throw new Error('OPENROUTER_API_KEY missing in server/.env');

const PROMPTS = {
  a: 'Instrumental, no vocals. Magical, elegant cinematic electronica for a premium astrology app film, exactly 96 BPM, '
    + 'minor key turning warm, starts on the very first beat with no silence. Twinkling celesta and harp arpeggios, glassy '
    + 'music-box bells, deep warm sub bass, soft round kick and brushed percussion, airy choir-like pads, a mysterious and '
    + 'enchanting melody, shimmering star-like chimes. Grown-up and luxurious, like a Dior perfume night sky film. '
    + 'Steady groove the whole time, a glowing lift at 9 seconds, a fuller section at 13 seconds, clean resolved final chord at 20 seconds.',
  b: 'Instrumental, no vocals. Mysterious, dreamy downtempo with a gentle pulse for a night-sky astrology app commercial, '
    + 'exactly 100 BPM, starts immediately on beat one. Plucked kalimba and harp motifs, sparkling glockenspiel, warm analog '
    + 'pads, soft deep kick, finger snaps, a hint of oriental strings, magical and confident, modern and premium like an '
    + 'Apple or Spotify feature ad. Small breath at 9 seconds, bigger shimmering return at 10 seconds, clean final hit at 20 seconds.',
};

const [n = '1', variant = 'a'] = process.argv.slice(2);
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'google/lyria-3-clip-preview', modalities: ['text', 'audio'], stream: true, messages: [{ role: 'user', content: PROMPTS[variant] }] }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const chunks = [];
let fmt = null, buf = '';
const dec = new TextDecoder();
for await (const part of res.body) {
  buf += dec.decode(part, { stream: true });
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line.startsWith('data:') || line === 'data: [DONE]') continue;
    let ev;
    try { ev = JSON.parse(line.slice(5)); } catch { continue; }
    for (const ch of ev.choices || []) {
      const a = ch.delta?.audio || {};
      if (a.data) chunks.push(Buffer.from(a.data, 'base64'));
      fmt = a.format || fmt;
    }
    if (ev.usage) console.log('cost', ev.usage.cost);
  }
}
const data = Buffer.concat(chunks);
const ext = fmt || (data.subarray(0, 3).toString() === 'ID3' || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) ? 'mp3' : data.subarray(0, 4).toString() === 'RIFF' ? 'wav' : 'bin');
mkdirSync(join(here, 'out'), { recursive: true });
const out = join(here, 'out', `music_${n}.${ext}`);
writeFileSync(out, data);
console.log('wrote', out, data.length);
