// MEDIHOROSCOPE Oracle art: Medi (flat mascot) as a mystical fortune-teller, via the OpenRouter image model the
// mascot itself was made with (brand/medi-character/flat/concept.py).
//   node brand/horoscope/oracle-studio.mjs [name …]   → brand/horoscope/oracle/<name>.png
// Key: OPENROUTER_API_KEY from the main checkout's server/.env (never printed).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'oracle');
const MAIN = 'C:/Users/User/Desktop/www.medicard';
const REF = join(MAIN, 'brand/medi-character/flat/concepts/style_chunky.png');
const MODEL = 'google/gemini-3-pro-image';

const BASE = 'This is Medi, the flat Duolingo-style mascot of the MEDICARD app. Keep EXACTLY the same character, proportions, '
  + 'colours (mint #8AE6D4 head, white face mask, deep teal eyes, near-black brows, white belly with a teal heart), the same flat '
  + 'vector style with at most one soft shade per colour and no outlines. Front view, centred, plain pure white background, no text, no frame. ';

const JOBS = {
  hat_witch: 'Medi now wears a classic witch hat for a mystical horoscope module: a tall cone with a softly bent tip leaning to one side, '
    + 'wide round brim sitting on top of the head just above the brows, deep midnight indigo (#1B2A66) with a slightly lighter indigo shade, '
    + 'a brass-gold band (#C99A45) with a tiny crescent-moon buckle, and three or four tiny gold stars on the cone. The curled crest is hidden under the hat. '
    + 'Medi looks wise and a little mysterious: calm half-closed knowing eyes and a small smile.',
  hat_wizard: 'Medi now wears a soft wizard hat for a mystical horoscope module: a tall floppy cone that droops gently backwards, a narrow brim, '
    + 'deep midnight indigo (#1B2A66) scattered with small gold stars and one gold crescent moon, a thin brass-gold trim. The curled crest is hidden under the hat. '
    + 'Medi holds a small glowing crystal ball (pale lavender-white glow) in both mitten hands in front of the belly, mysterious gentle smile.',
  hat_oracle: 'Medi is a gentle fortune-teller for a mystical horoscope module: a short elegant witch hat with a crooked tip, deep plum-indigo (#2A1F5C), '
    + 'brass-gold band (#C99A45) with a small star, a few gold stars on the cone, plus a soft translucent indigo shawl over the shoulders with tiny gold stars at the hem. '
    + 'The curled crest is hidden under the hat. One mitten hand raised as if revealing a secret, knowing smile, eyes slightly narrowed.',
  hat_only_witch: 'Show ONLY the hat from the first variant, without the character: a classic witch hat (tall cone with a softly bent tip leaning to one side, '
    + 'wide round brim, deep midnight indigo #1B2A66 with one lighter indigo shade, brass-gold #C99A45 band with a tiny crescent-moon buckle, three or four tiny gold stars). '
    + 'Seen from the front at the exact angle it would sit on Medi\'s head, centred, flat vector, plain pure white background.',
};

function key() {
  const line = readFileSync(join(MAIN, 'server/.env'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENROUTER_API_KEY='));
  if (!line) throw new Error('OPENROUTER_API_KEY missing');
  return line.slice('OPENROUTER_API_KEY='.length).trim().replace(/^"|"$/g, '');
}

async function run(name, prompt) {
  const ref = `data:image/png;base64,${readFileSync(REF).toString('base64')}`;
  const body = {
    model: MODEL,
    modalities: ['image', 'text'],
    messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: ref } }, { type: 'text', text: BASE + prompt }] }],
    image_config: { aspect_ratio: '1:1', image_size: '2K' },
  };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key()}`, 'X-Title': 'MEDIHOROSCOPE oracle studio' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  const img = res.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!img) { console.log(name, 'no image', JSON.stringify(res).slice(0, 300)); return; }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(img.split(',', 2)[1], 'base64'));
  console.log('wrote', name, `($${res.usage?.cost ?? '?'})`);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
await Promise.all(names.map((n) => run(n, JOBS[n]).catch((e) => console.log(n, 'failed', e.message))));
