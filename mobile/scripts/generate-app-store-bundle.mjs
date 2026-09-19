/**
 * App Store Connect screenshot bundle — iPhone 6.7" + iPad 12.9".
 *
 * Composite (uses existing real app captures in _raw):
 *   node scripts/generate-app-store-bundle.mjs
 *
 * Re-capture from Expo web + production API, then composite:
 *   STORE_EMAIL=… STORE_PASSWORD=… EXPO_WEB_URL=http://localhost:8081 \
 *     node scripts/generate-app-store-bundle.mjs --capture
 */
import { chromium } from 'playwright';
import { access, copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'store/app-store-screens/_raw');
const BUNDLE = join(ROOT, 'store/app-store-connect');
/** App Store Connect iPhone portrait slot (6.5" display class). */
const IPHONE_OUT = join(BUNDLE, 'iphone-6.5');
const IPAD_OUT = join(BUNDLE, 'ipad-12.9');
const ICON = join(ROOT, 'assets/icon.png');
const WEB = process.env.EXPO_WEB_URL ?? 'http://localhost:8081';
const API = process.env.STORE_API_URL ?? 'https://medicard.ge';
const APP_VERSION = '1.0.0.8.57';

const CAPTURE = process.argv.includes('--capture');

const FRAMES = [
  {
    id: '01-signin',
    auth: false,
    path: '/sign-in',
    kicker: 'MEDICARD.GE',
    title: 'შენი ჯანმრთელობა.\nერთ აპში.',
    sub: 'Medi · ანალიზები · მედიკამენტები · ციკლი',
    layout: 'hero',
    bg: '#030712',
    glow: '#14B8A6',
    accent: '#99F6E4',
  },
  {
    id: '02-home',
    auth: true,
    path: '/home',
    kicker: 'მთავარი',
    title: 'დილა იწყება\nსწორად.',
    sub: 'მიღება, წონა, აქტიურობა — ერთ ეკრანზე',
    layout: 'bleed',
    bg: '#030712',
    glow: '#14B8A6',
    accent: '#5EEAD4',
  },
  {
    id: '03-profile',
    auth: true,
    path: '/profile',
    kicker: 'პროფილი',
    title: 'შენი ბარათი.\nშენი მონაცემები.',
    sub: 'ქულა, სტრიკი, პაკეტი და ჩემი ცხოველები',
    layout: 'hero',
    bg: '#030712',
    glow: '#14B8A6',
    accent: '#99F6E4',
  },
  {
    id: '04-cycle',
    auth: true,
    path: '/cycle',
    kicker: 'ციკლი',
    title: 'ციკლი —\nგარკვევით.',
    sub: 'დღე, ფაზა, პროგნოზი — ყოველივე ერთ ადგილას',
    layout: 'bleed',
    bg: '#0B0610',
    glow: '#FB7185',
    accent: '#FDA4AF',
  },
  {
    id: '05-symptoms',
    auth: true,
    path: '/symptoms',
    kicker: 'სიმპტომები',
    title: 'აჩვენე,\nსად გტკივა.',
    sub: 'სხეულის რუკა და ჩივილების ისტორია',
    layout: 'hero',
    bg: '#020617',
    glow: '#14B8A6',
    accent: '#99F6E4',
  },
  {
    id: '06-metrics',
    auth: true,
    path: '/health-metrics',
    kicker: 'მაჩვენებლები',
    title: 'ყველა მეტრიკა\nერთად.',
    sub: 'წონა, ნაბიჯები, წყალი, ძილი',
    layout: 'bleed',
    bg: '#041520',
    glow: '#22D3EE',
    accent: '#67E8F9',
  },
  {
    id: '07-medi',
    auth: true,
    path: '/chat/doctor',
    kicker: 'Medi',
    title: 'ჰკითხე\nMedi-ს.',
    sub: 'ქართულად · შენს პროფილზე დაყრდნობით',
    layout: 'hero',
    bg: '#042F2E',
    glow: '#14B8A6',
    accent: '#99F6E4',
  },
  {
    id: '08-streak',
    auth: true,
    path: '/profile/streak',
    kicker: 'სტრიკი',
    title: 'დღეები\nზედიზედ.',
    sub: 'ყოველდღიური ჩართულობა და მიღწევები',
    layout: 'bleed',
    bg: '#1C0A00',
    glow: '#F97316',
    accent: '#FDBA74',
  },
];

const SPECS = {
  iphone: { width: 1284, height: 2778, label: 'iPhone 6.5" slot (1284×2778)' },
  ipad: { width: 2048, height: 2732, label: '12.9" iPad Pro (2048×2732)' },
};

const PHONE_LAYOUT_BASE = { width: 1290, height: 2796 };

/** Scale layout designed at 1290×2796 to the App Store–accepted 1284×2778 canvas. */
function phoneScale(value, spec, axis = 'y') {
  if (spec.width === SPECS.ipad.width) return value;
  const base = axis === 'x' ? PHONE_LAYOUT_BASE.width : PHONE_LAYOUT_BASE.height;
  const target = axis === 'x' ? spec.width : spec.height;
  return Math.round(value * (target / base));
}

function posterHtml({ shotFile, iconFile, kicker, title, sub, bg, glow, accent, layout, spec }) {
  const src = `file:///${shotFile.replace(/\\/g, '/')}`;
  const iconSrc = iconFile ? `file:///${iconFile.replace(/\\/g, '/')}` : '';
  const bleed = layout === 'bleed';
  const isIpad = spec.width === SPECS.ipad.width;
  const padX = isIpad ? 120 : phoneScale(80, spec, 'x');
  const copyTop = isIpad ? (bleed ? 88 : 108) : phoneScale(bleed ? 96 : 120, spec);
  const titleSize = isIpad ? (bleed ? 92 : 86) : phoneScale(bleed ? 84 : 78, spec);
  const subSize = isIpad ? 34 : phoneScale(30, spec);
  const phoneW = isIpad ? (bleed ? 1180 : 1080) : phoneScale(bleed ? 1080 : 980, spec, 'x');
  const phoneH = isIpad ? (bleed ? 2490 : 2280) : phoneScale(bleed ? 2280 : 2040, spec);
  const phoneTop = isIpad ? (bleed ? 520 : 640) : phoneScale(bleed ? 560 : 680, spec);
  const islandW = isIpad ? 260 : phoneScale(220, spec, 'x');

  return `<!DOCTYPE html>
<html lang="ka">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@500;600;700;800&family=Inter:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    html, body { margin: 0; width: ${spec.width}px; height: ${spec.height}px; background: ${bg}; }
    .canvas {
      width: ${spec.width}px; height: ${spec.height}px; position: relative; overflow: hidden;
      background:
        radial-gradient(ellipse 130% 75% at 50% 112%, ${glow}4D 0%, transparent 54%),
        radial-gradient(circle 640px at 8% 6%, ${accent}24 0%, transparent 58%),
        radial-gradient(circle 520px at 94% 14%, ${glow}30 0%, transparent 56%),
        linear-gradient(165deg, ${bg} 0%, #020617 48%, #030712 100%);
    }
    .grid {
      position: absolute; inset: 0; opacity: 0.35; pointer-events: none;
      background-image:
        linear-gradient(${glow}14 1px, transparent 1px),
        linear-gradient(90deg, ${glow}14 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, #000 20%, transparent 75%);
    }
    .orb { position: absolute; border-radius: 999px; filter: blur(48px); pointer-events: none; }
    .orb-a { width: ${isIpad ? 520 : phoneScale(420, spec, 'x')}px; height: ${isIpad ? 520 : phoneScale(420, spec)}px; left: -100px; top: ${isIpad ? 900 : phoneScale(980, spec)}px; background: ${glow}40; }
    .orb-b { width: ${isIpad ? 360 : phoneScale(280, spec, 'x')}px; height: ${isIpad ? 360 : phoneScale(280, spec)}px; right: -60px; top: 180px; background: ${accent}30; }
    .brand {
      position: absolute; left: ${padX}px; top: ${isIpad ? 44 : 48}px; z-index: 6;
      display: flex; align-items: center; gap: 16px;
    }
    .brand img {
      width: ${isIpad ? 56 : 48}px; height: ${isIpad ? 56 : 48}px; border-radius: 14px;
      box-shadow: 0 8px 28px ${glow}55, 0 0 0 1px #ffffff18;
    }
    .brand-text {
      font-family: Inter, system-ui, sans-serif;
      font-weight: 700; font-size: ${isIpad ? 22 : 20}px; letter-spacing: 0.22em;
      color: #fff;
    }
    .brand-ver {
      margin-left: 8px; font-weight: 600; font-size: ${isIpad ? 16 : 14}px;
      letter-spacing: 0.04em; color: #6B7280;
    }
    .copy {
      position: absolute; left: ${padX}px; right: ${padX}px; top: ${copyTop}px;
      z-index: 3; text-align: ${isIpad ? 'center' : 'left'};
    }
    .kicker-wrap {
      display: inline-flex; align-items: center; gap: 14px;
      padding: 10px 22px 10px 18px; border-radius: 999px;
      background: linear-gradient(135deg, ${glow}22, ${accent}12);
      border: 1px solid ${glow}44;
      backdrop-filter: blur(12px);
      margin-bottom: 24px;
    }
    .kicker {
      font-family: 'Noto Sans Georgian', Inter, sans-serif;
      font-weight: 700; font-size: ${isIpad ? 28 : 26}px; letter-spacing: 0.14em;
      color: ${accent}; margin: 0;
    }
    .kicker-dot {
      width: 10px; height: 10px; border-radius: 99px; background: ${glow};
      box-shadow: 0 0 18px ${glow};
    }
    .title {
      font-family: 'Noto Sans Georgian', sans-serif;
      font-weight: 800; font-size: ${titleSize}px; line-height: 1.06;
      color: #fff; margin: 0; white-space: pre-line;
      text-shadow: 0 20px 60px #0009;
      ${isIpad ? 'max-width: 1680px; margin-inline: auto;' : ''}
    }
    .sub {
      margin: ${isIpad ? '26px' : '22px'} auto 0;
      font-family: 'Noto Sans Georgian', sans-serif;
      font-weight: 500; font-size: ${subSize}px; line-height: 1.45;
      color: #D1D5DB;
      max-width: ${isIpad ? 1100 : phoneScale(920, spec, 'x')}px;
    }
    .phone {
      position: absolute;
      left: 50%;
      top: ${phoneTop}px;
      transform: translateX(-50%);
      width: ${phoneW}px;
      height: ${phoneH}px;
      border-radius: ${isIpad ? 100 : 92}px;
      padding: ${isIpad ? 16 : 14}px;
      background: linear-gradient(145deg, #374151 0%, #111827 40%, #030712 100%);
      box-shadow:
        0 0 0 1px #4B5563,
        0 40px 100px ${glow}50,
        0 12px 48px #000c,
        inset 0 1px 0 #ffffff12;
      z-index: 2;
    }
    .phone::after {
      content: '';
      position: absolute; left: 12%; right: 12%; bottom: -36px; height: 48px;
      background: radial-gradient(ellipse at center, ${glow}33 0%, transparent 70%);
      filter: blur(20px); z-index: -1;
    }
    .screen {
      width: 100%; height: 100%; border-radius: ${isIpad ? 86 : 78}px; overflow: hidden;
      background: #030712;
    }
    .screen img {
      width: 100%; height: 100%; object-fit: cover; object-position: top center;
      display: block;
    }
    .island {
      position: absolute; left: 50%; top: ${isIpad ? 30 : 26}px; transform: translateX(-50%);
      width: ${islandW}px; height: ${isIpad ? 38 : 34}px; border-radius: 20px;
      background: #000; z-index: 4;
      box-shadow: inset 0 0 0 1px #1f2937;
    }
    .fade {
      position: absolute; left: 0; right: 0; bottom: 0; height: ${isIpad ? 280 : 220}px;
      background: linear-gradient(180deg, transparent, ${bg});
      z-index: 5; pointer-events: none;
    }
    .footer {
      position: absolute; left: 0; right: 0; bottom: ${isIpad ? 52 : 44}px;
      text-align: center; z-index: 6;
      font-family: Inter, sans-serif; font-size: ${isIpad ? 20 : 18}px; font-weight: 600;
      letter-spacing: 0.12em; color: #6B7280;
    }
    .footer span { color: ${accent}; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="grid"></div>
    <div class="orb orb-a"></div>
    <div class="orb orb-b"></div>
    ${iconSrc ? `<div class="brand"><img src="${iconSrc}" alt="" /><span class="brand-text">MEDICARD</span><span class="brand-ver">v${APP_VERSION}</span></div>` : ''}
    <div class="copy">
      <div class="kicker-wrap"><span class="kicker-dot"></span><p class="kicker">${kicker}</p></div>
      <h1 class="title">${title}</h1>
      <p class="sub">${sub}</p>
    </div>
    <div class="phone">
      <div class="island"></div>
      <div class="screen"><img src="${src}" alt="" /></div>
    </div>
    <div class="fade"></div>
    <p class="footer">medicard<span>.ge</span> · ჯიბის სამედიცინო ასისტენტი</p>
  </div>
</body>
</html>`;
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 280)}`);
  return data;
}

const HIDE_CSS = `[id*="expo"], [class*="error-overlay"] { display: none !important; }`;

async function captureAll(browser, token) {
  for (const frame of FRAMES) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    await context.addInitScript(
      ({ token: t, authed: on }) => {
        localStorage.setItem('medicard.theme.preference', 'dark');
        localStorage.setItem('medicard.home.landing', 'hub');
        localStorage.setItem('medicard.home.cyclePromptSeen', '1');
        if (on) localStorage.setItem('medicard.auth.token', t);
        else localStorage.removeItem('medicard.auth.token');
      },
      { token, authed: frame.auth },
    );
    const page = await context.newPage();
    const url = `${WEB}${frame.path}`;
    console.log(`Capture ${frame.id}  ${url}`);
    await page.addStyleTag({ content: HIDE_CSS });
    await page.goto(url, { waitUntil: 'load', timeout: 180_000 });
    await page.waitForTimeout(2800);
    const dismiss = page.getByText('არა, ზოგადი მთავარი გვერდი', { exact: false });
    if (await dismiss.count()) {
      await dismiss.first().click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
    if (frame.path === '/profile') {
      await page.evaluate(() => {
        const walk = (node) => {
          if (node.nodeType === 3) {
            const t = node.textContent ?? '';
            if (/@|\+995|\d{9,}/.test(t)) node.textContent = '';
          }
          node.childNodes.forEach(walk);
        };
        walk(document.body);
      });
    }
    const rawPath = join(RAW, `${frame.id}.png`);
    await page.screenshot({ path: rawPath, animations: 'disabled' });
    frame.rawPath = rawPath;
    await context.close();
  }
}

async function rawPathFor(frame) {
  const p = join(RAW, `${frame.id}.png`);
  try {
    await access(p);
    return p;
  } catch {
    throw new Error(`Missing ${p}. Run with --capture and STORE_EMAIL / STORE_PASSWORD, or copy captures into _raw.`);
  }
}

async function renderBundle(browser, iconFile) {
  for (const [key, spec] of Object.entries(SPECS)) {
    const outDir = key === 'iphone' ? IPHONE_OUT : IPAD_OUT;
    await mkdir(outDir, { recursive: true });
    const page = await browser.newPage({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: 1,
    });

    for (const frame of FRAMES) {
      const shotFile = frame.rawPath ?? (await rawPathFor(frame));
      const html = posterHtml({
        shotFile,
        iconFile,
        kicker: frame.kicker,
        title: frame.title,
        sub: frame.sub,
        bg: frame.bg,
        glow: frame.glow,
        accent: frame.accent,
        layout: frame.layout,
        spec,
      });
      const htmlPath = join(RAW, `${frame.id}-${key}.html`);
      await writeFile(htmlPath, html, 'utf8');
      await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const outName = `${frame.id}-${key === 'iphone' ? 'iphone-65' : 'ipad-129'}.png`;
      await page.screenshot({ path: join(outDir, outName), animations: 'disabled' });
      console.log(`  ${spec.label}  ${outName}`);
    }
    await page.close();
  }
}

async function main() {
  await mkdir(RAW, { recursive: true });
  await mkdir(IPHONE_OUT, { recursive: true });
  await mkdir(IPAD_OUT, { recursive: true });

  let iconFile;
  try {
    await access(ICON);
    iconFile = ICON;
  } catch {
    iconFile = null;
  }

  const browser = await chromium.launch();

  if (CAPTURE) {
    const email = process.env.STORE_EMAIL;
    const password = process.env.STORE_PASSWORD;
    if (!email || !password) {
      throw new Error('--capture requires STORE_EMAIL and STORE_PASSWORD');
    }
    const { token, user } = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    console.log(`Signed in as ${user?.fullName ?? email}`);
    await captureAll(browser, token);
  }

  await renderBundle(browser, iconFile);

  const allDir = join(BUNDLE, 'all');
  await mkdir(allDir, { recursive: true });
  for (const sub of [IPHONE_OUT, IPAD_OUT]) {
    for (const name of await readdir(sub)) {
      if (name.endsWith('.png')) {
        await copyFile(join(sub, name), join(allDir, name));
      }
    }
  }

  const readme = `# App Store Connect screenshots

Generated: ${new Date().toISOString().slice(0, 10)}
App version: ${APP_VERSION}

## Folders

| Folder | Size | Use in App Store Connect |
|--------|------|---------------------------|
| \`iphone-6.5/\` | **1284×2778** | iPhone screenshot slot (App Store Connect accepted) |
| \`ipad-12.9/\` | 2048×2732 | iPad Pro 12.9" (3rd gen+) |
| \`all/\` | both sizes | All 16 PNGs in one folder (upload convenience) |

Each file uses **real Medicard UI** captures from Expo web (dark theme) inside device frames with Georgian marketing copy.

## Re-generate

Composite only (existing captures in \`store/app-store-screens/_raw/\`):

\`\`\`bash
cd mobile && node scripts/generate-app-store-bundle.mjs
\`\`\`

Fresh captures (Expo web running + credentials):

\`\`\`bash
cd mobile && STORE_EMAIL=… STORE_PASSWORD=… EXPO_WEB_URL=http://localhost:8081 \\
  node scripts/generate-app-store-bundle.mjs --capture
\`\`\`
`;
  await writeFile(join(BUNDLE, 'README.md'), readme, 'utf8');

  await browser.close();
  console.log(`\nBundle → ${BUNDLE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
