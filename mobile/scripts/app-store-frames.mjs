/**
 * App Store frames from the REAL Medicard web app.
 *
 *   STORE_EMAIL=… STORE_PASSWORD=… node scripts/app-store-frames.mjs
 *
 * Writes 1290×2796 frames to store/app-store-screens/
 * Do not commit credentials.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'store/app-store-screens/_raw');
const OUT = join(ROOT, 'store/app-store-screens');
const WEB = process.env.EXPO_WEB_URL ?? 'http://localhost:8081';
const API = process.env.STORE_API_URL ?? 'https://medicard.ge';

const FRAMES = [
  {
    id: '01-signin',
    auth: false,
    path: '/sign-in',
    kicker: 'მედიქარდი',
    title: 'შენი ჯანმრთელობა.\nერთ აპში.',
    sub: 'Medi · ანალიზები · მედიკამენტები · ციკლი',
    layout: 'stage',
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
    sub: 'ქულა, სტრიკი, პაკეტი',
    layout: 'stage',
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
    sub: 'დღე, ფაზა, პროგნოზი — სერვერიდან',
    layout: 'bleed',
    bg: '#0B0610',
    glow: '#FB7185',
    accent: '#E11D48',
  },
  {
    id: '05-symptoms',
    auth: true,
    path: '/symptoms',
    kicker: 'სიმპტომები',
    title: 'აჩვენე,\nსად გტკივა.',
    sub: 'სხეულის რუკა + Medi',
    layout: 'stage',
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
    sub: 'ქართულად. შენს პროფილზე დაყრდნობით.',
    layout: 'stage',
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
    sub: 'ყოველდღიური შესვლა',
    layout: 'bleed',
    bg: '#1C0A00',
    glow: '#F97316',
    accent: '#FDBA74',
  },
];

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

async function loginAccount() {
  const email = process.env.STORE_EMAIL;
  const password = process.env.STORE_PASSWORD;
  if (!email || !password) {
    throw new Error('Set STORE_EMAIL and STORE_PASSWORD for this run. Do not commit them.');
  }
  const { token, user } = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  console.log(`Signed in as ${user?.fullName ?? email}`);
  return token;
}

function posterHtml({ shotFile, kicker, title, sub, bg, glow, accent, layout }) {
  const src = `file:///${shotFile.replace(/\\/g, '/')}`;
  const bleed = layout === 'bleed';
  return `<!DOCTYPE html>
<html lang="ka">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    html, body { margin: 0; width: 1290px; height: 2796px; background: ${bg}; }
    .canvas {
      width: 1290px; height: 2796px; position: relative; overflow: hidden;
      background:
        radial-gradient(ellipse 120% 70% at 50% 108%, ${glow}55 0%, transparent 52%),
        radial-gradient(circle 520px at 12% 8%, ${accent}22 0%, transparent 60%),
        radial-gradient(circle 420px at 92% 18%, ${glow}26 0%, transparent 55%),
        linear-gradient(180deg, ${bg} 0%, #020617 100%);
    }
    .orb {
      position: absolute; border-radius: 999px; filter: blur(40px); pointer-events: none;
    }
    .orb-a { width: 420px; height: 420px; left: -80px; top: 980px; background: ${glow}33; }
    .orb-b { width: 280px; height: 280px; right: -40px; top: 220px; background: ${accent}28; }
    .copy {
      position: absolute; left: 80px; right: 80px; top: ${bleed ? '96px' : '120px'};
      z-index: 3;
    }
    .kicker {
      display: inline-flex; align-items: center; gap: 12px;
      font-family: 'Noto Sans Georgian', sans-serif;
      font-weight: 700; font-size: 26px; letter-spacing: 0.16em;
      color: ${accent}; margin: 0 0 20px;
    }
    .kicker::before {
      content: ''; width: 36px; height: 3px; border-radius: 99px; background: ${glow};
    }
    .title {
      font-family: 'Noto Sans Georgian', sans-serif;
      font-weight: 800; font-size: ${bleed ? '84px' : '78px'}; line-height: 1.08;
      color: #fff; margin: 0; white-space: pre-line;
      text-shadow: 0 18px 50px #0008;
    }
    .sub {
      margin: 22px 0 0;
      font-family: 'Noto Sans Georgian', sans-serif;
      font-weight: 500; font-size: 30px; line-height: 1.4;
      color: #D1D5DB;
      max-width: 920px;
    }
    .phone {
      position: absolute;
      left: 50%;
      top: ${bleed ? '560px' : '680px'};
      transform: translateX(-50%);
      width: ${bleed ? '1080px' : '980px'};
      height: ${bleed ? '2280px' : '2040px'};
      border-radius: 92px;
      padding: 14px;
      background: linear-gradient(180deg, #1f2937, #030712);
      box-shadow:
        0 0 0 1px #374151,
        0 30px 80px ${glow}55,
        0 8px 40px #000a;
      z-index: 2;
    }
    .screen {
      width: 100%; height: 100%; border-radius: 78px; overflow: hidden;
      background: #030712;
    }
    .screen img {
      width: 100%; height: 100%; object-fit: cover; object-position: top center;
      display: block;
    }
    .island {
      position: absolute; left: 50%; top: 26px; transform: translateX(-50%);
      width: 220px; height: 34px; border-radius: 20px; background: #000; z-index: 4;
    }
    .fade {
      position: absolute; left: 0; right: 0; bottom: 0; height: 220px;
      background: linear-gradient(180deg, transparent, ${bg});
      z-index: 5; pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="orb orb-a"></div>
    <div class="orb orb-b"></div>
    <div class="copy">
      <p class="kicker">${kicker}</p>
      <h1 class="title">${title}</h1>
      <p class="sub">${sub}</p>
    </div>
    <div class="phone">
      <div class="island"></div>
      <div class="screen"><img src="${src}" alt="" /></div>
    </div>
    <div class="fade"></div>
  </div>
</body>
</html>`;
}

const HIDE_CSS = `
  [id*="expo"], [class*="error-overlay"] { display: none !important; }
`;

async function capture(page, frame) {
  const url = `${WEB}${frame.path}`;
  console.log(`Capture ${frame.id}  ${url}`);
  await page.addStyleTag({ content: HIDE_CSS });
  await page.goto(url, { waitUntil: 'load', timeout: 180_000 });
  await page.waitForTimeout(2800);
  await page.addStyleTag({ content: HIDE_CSS });

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
  return rawPath;
}

async function main() {
  await mkdir(RAW, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const token = await loginAccount();

  const browser = await chromium.launch();

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
    frame.rawPath = await capture(page, frame);
    await context.close();
  }

  const poster = await browser.newPage({
    viewport: { width: 1290, height: 2796 },
    deviceScaleFactor: 1,
  });

  for (const frame of FRAMES) {
    const html = posterHtml({
      shotFile: frame.rawPath,
      kicker: frame.kicker,
      title: frame.title,
      sub: frame.sub,
      bg: frame.bg,
      glow: frame.glow,
      accent: frame.accent,
      layout: frame.layout,
    });
    const htmlPath = join(RAW, `${frame.id}.html`);
    await writeFile(htmlPath, html, 'utf8');
    await poster.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
    await poster.waitForTimeout(700);
    await poster.screenshot({ path: join(OUT, `${frame.id}.png`) });
    console.log(`Frame  ${frame.id}.png`);
  }

  await browser.close();
  console.log(`\nApp Store frames → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
