"""Render every campaign visual from posters.html.

  python render.py                -> out/feed/*.jpg (1080x1350), out/story/*.jpg (1080x1920), out/print/*.pdf + *.png previews
  python render.py f05-golden     -> only the ids given
  python render.py --android      -> footer says App Store · Google Play (use once the Play listing is live)

Variants: every Saturday (riddles, tomorrow, announcement) and the iPhone countdowns are rendered from CONFIG in posters.html.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'out'
args = [a for a in sys.argv[1:] if not a.startswith('--')]
extra = '&android=1' if '--android' in sys.argv else ''

with sync_playwright() as p:
    b = p.chromium.launch(args=['--allow-file-access-from-files'])
    page = b.new_page(viewport={'width': 1200, 'height': 2000})
    page.goto(HERE.joinpath('posters.html').as_uri() + '?p=none')
    ids = args or page.evaluate('window.POSTERS')
    sats = page.evaluate('window.SATURDAYS')
    from urllib.parse import quote
    jobs = []
    for i in ids:
        if i == 'f05-iphone':
            jobs += [(i, '', i)] + [(i, 'c=' + quote(c), f'{i}-{k}') for k, c in (('52', 'დარჩა 52 დღე'), ('22', 'დარჩა 22 დღე'), ('8', 'დარჩა 8 დღე'), ('1', 'ხვალ, 12:00-ზე'))]
        elif i in ('f14-saturday', 's07-tomorrow'):
            jobs += [(i, f's={k}', f'{i}-{k + 1:02d}') for k in range(sats)]
        elif i == 's06-hint':
            jobs += [(i, f's={k}&h={h}', f'{i}-{k + 1:02d}-{h}') for k in range(sats) for h in (1, 2)]
        elif i == 's09-iphone':
            jobs += [(i, '', i)] + [(i, f't={t}', f'{i}-{t}') for t in ('tomorrow', 'today', 'soon')]
        else:
            jobs.append((i, '', i))
    for pid, qs, name in jobs:
        page.goto(HERE.joinpath('posters.html').as_uri() + f'?p={pid}&{qs}{extra}')
        page.wait_for_function('window.ready !== undefined'); page.evaluate('window.ready')
        kind, size = page.evaluate('window.KIND'), page.evaluate('window.SIZE')
        clip = {'x': 0, 'y': 0, 'width': size['w'], 'height': size['h']}
        if kind == 'print':
            (OUT / 'print').mkdir(parents=True, exist_ok=True)
            page.set_viewport_size({'width': size['w'], 'height': size['h']})
            page.pdf(path=str(OUT / 'print' / f'{name}.pdf'), width=f"{size['wmm']}mm", height=f"{size['hmm']}mm", print_background=True, margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'}, page_ranges='1')
            page.screenshot(path=str(OUT / 'print' / f'{name}.png'), clip=clip, omit_background=True)
            page.set_viewport_size({'width': 1200, 'height': 2000})
        else:
            (OUT / kind).mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(OUT / kind / f'{name}.jpg'), type='jpeg', quality=92, clip=clip)
        print('wrote', kind, name, flush=True)
    b.close()
