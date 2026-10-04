// Collects MEDICARD's graphic files into brand/brandbook/manifest.js for the brand book page.
//   node brand/brandbook/build.mjs
// Paths in the manifest are relative to brand/brandbook/ (the page links the real files — nothing is copied).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const rel = (p) => path.relative(here, path.join(root, p)).split(path.sep).join('/');
const IMG = /\.(png|jpe?g|webp|svg)$/i;

function list(dir, filter = () => true) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => IMG.test(f) && filter(f))
    .sort()
    .map((f) => ({ src: rel(`${dir}/${f}`), name: f.replace(IMG, '').replace(/[-_]/g, ' ') }));
}

const groups = [
  { id: 'quest', title: 'MEDIQUEST', note: 'მისიები, ჯილდოები და ოთახის დეკორი', items: list('mobile/assets/art/quest') },
  { id: 'run', title: 'MEDIRUN', note: 'რუკის ხატულები, საჩუქრები და თბილისის მისიები', items: [...list('mobile/assets/run'), ...list('mobile/assets/run/icons'), ...list('mobile/assets/run/missions')] },
  { id: 'pets', title: 'MEDIVET', note: 'ცხოველები და მოვლა', items: list('mobile/assets/art/pets') },
  { id: 'rewards', title: 'Medi Coins მაღაზია', note: 'საჩუქრების რენდერები, ლოგოს გარეშე', items: [...list('mobile/assets/art', (f) => f.startsWith('coin')), ...list('server/public/rewards')] },
  { id: 'empty', title: 'ცარიელი ეკრანები და მიზნები', note: 'empty states, ონბორდინგის მიზნები, მოწვევა', items: [...list('mobile/assets/art/empty'), ...list('mobile/assets/art/goal'), ...list('mobile/assets/art/referral')] },
  { id: 'pregnancy', title: 'ორსულობა', note: 'ნაყოფის ზომა და განვითარება კვირების მიხედვით', items: [...list('mobile/assets/pregnancy-size'), ...list('mobile/assets/pregnancy-development')] },
  { id: 'figma', title: 'Figma ილუსტრაციები', note: 'განწყობა, სხეული, ონბორდინგი (Nightingale UI kit)', items: [...list('mobile/assets/figma/illustrations'), ...list('mobile/assets/figma/welcome')] },
  { id: 'reactions', title: 'ქალების სივრცის რეაქციები', note: 'ანიმირებული რეაქციების სტატიკური კადრები', items: list('mobile/assets/community/reactions') },
];

// Cycle logging glyphs (Health Icons, MIT) — the generated TS module holds the SVG strings.
const iconTs = fs.readFileSync(path.join(root, 'mobile/src/constants/cycleIconSvg.ts'), 'utf8');
const cycleIcons = {};
for (const m of iconTs.matchAll(/^\s{2}([a-zA-Z0-9_]+): "((?:[^"\\]|\\.)*)",?$/gm)) cycleIcons[m[1]] = JSON.parse(`"${m[2]}"`);

// Social: every series we published (newest first). `internal` = admin-only campaign material
// (server/private/press) — fine in this repo page, never on a public URL.
const social = [
  { id: 'glow-feed', title: 'გაანათე თბილისი · feed', internal: true, items: list('brand/medirun/glow-campaign/out/feed') },
  { id: 'glow-story', title: 'გაანათე თბილისი · stories', internal: true, items: list('brand/medirun/glow-campaign/out/story') },
  { id: 'glow-print', title: 'გაანათე თბილისი · ბეჭდვა', internal: true, items: list('brand/medirun/glow-campaign/out/print') },
  { id: 'passport', title: 'MEDIRUN · თბილისის პასპორტი', items: list('brand/medirun/posts/out', (f) => !f.includes('00-all')) },
  { id: 'launch-feed', title: '28 დღე · feed', items: list('brand/campaign/out', (f) => /^d\d+-feed/.test(f)) },
  { id: 'launch-story', title: '28 დღე · stories', items: list('brand/campaign/out', (f) => /^d\d+-story/.test(f)) },
  { id: 'launch-li', title: '28 დღე · LinkedIn', items: list('brand/campaign/out', (f) => /^d\d+-linkedin/.test(f)) },
  { id: 'launch', title: 'App Store-ზე გამოსვლა', items: list('brand/launch/out', (f) => /^(feed|story|square|wide)\.jpg$/.test(f)) },
  { id: 'profile', title: 'პროფილი და პირველი შაბლონები', items: list('brand', (f) => /^(facebook-(cover|profile)(-circle)?|social-(post|hook|editorial)-[a-z-]+)\.png$/.test(f) && !/preview|-v\d/.test(f)) },
];

// Ads: a poster frame per video (ffmpeg, once) so the page never preloads hundreds of MB.
const VIDEOS = [
  ['brand/medirun/medirun-ad-45s-3d-upload.mp4', 'MEDIRUN · 45 წმ · 3D', '16:9', 'medirun-45-3d'],
  ['brand/ad/medicard-ad-35s-feed-4x5.mp4', 'MEDICARD · 35 წმ', '4:5', 'medicard-35'],
  ['brand/reel/medicard-reel-30s-instagram-reels-9x16.mp4', 'MEDICARD reel · 30 წმ', '9:16', 'reel-30'],
  ['brand/medirun/medirun-ad-45s-upload.mp4', 'MEDIRUN · 45 წმ', '16:9', 'medirun-45'],
];
const posterDir = path.join(here, 'posters');
fs.mkdirSync(posterDir, { recursive: true });
const videos = [];
for (const [file, title, ratio, slug] of VIDEOS) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) continue;
  const poster = path.join(posterDir, `${slug}.jpg`);
  if (!fs.existsSync(poster)) {
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '6', '-i', abs, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '4', poster]);
    } catch {
      /* no ffmpeg: the video shows its first frame */
    }
  }
  videos.push({ src: rel(file), title, ratio, poster: fs.existsSync(poster) ? `posters/${slug}.jpg` : '', mb: Math.round(fs.statSync(abs).size / 1e6) });
}

const manifest = { generated: new Date().toISOString().slice(0, 10), groups, cycleIcons, social, videos };
fs.writeFileSync(path.join(here, 'manifest.js'), `// Generated by build.mjs — do not edit.\nwindow.BRANDBOOK = ${JSON.stringify(manifest, null, 1)};\n`);
const count = groups.reduce((n, g) => n + g.items.length, 0);
const posts = social.reduce((n, g) => n + g.items.length, 0);
console.log(`${count} illustrations in ${groups.length} groups, ${Object.keys(cycleIcons).length} cycle icons, ${posts} social images in ${social.length} series, ${videos.length} videos`);
