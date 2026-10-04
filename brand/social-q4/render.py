"""Render the Q4 posters from plan.json through poster.html -> out/feed, out/story (JPEG) + out/web (review size).

  python render.py                 every image
  python render.py q-1005-a ...    only these post ids (or id prefixes)
  python render.py --spec '{...}' --out x.jpg   one ad-hoc spec (design work)

The repo root is served over HTTP so fonts, screens and art load like on a site.
"""
import functools
import http.server
import json
import pathlib
import sys
import threading

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / 'out'


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def shoot(page, spec, dest):
    w, h = page.evaluate('(s) => window.render(s)', spec)
    png = dest.with_suffix('.png')
    page.locator('#poster').screenshot(path=str(png))
    im = Image.open(png).convert('RGB')
    full = (1440, 1800) if h == 1350 else (1080, 1920)
    im.resize(full, Image.LANCZOS).save(dest, quality=90, optimize=True, progressive=True)
    web = OUT / 'web' / dest.name
    web.parent.mkdir(parents=True, exist_ok=True)
    im.resize((720, round(720 * h / w)), Image.LANCZOS).save(web, quality=82, optimize=True, progressive=True)
    png.unlink()


def main():
    args = sys.argv[1:]
    srv = serve()
    base = f'http://127.0.0.1:{srv.server_address[1]}/brand/social-q4/poster.html'
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1200, 'height': 2000}, device_scale_factor=2)
        page.goto(base)
        page.wait_for_function('document.body.dataset.ready === "1"')
        if args[:1] == ['--spec']:
            spec = json.loads(args[1])
            dest = pathlib.Path(args[3]).resolve()
            dest.parent.mkdir(parents=True, exist_ok=True)
            shoot(page, spec, dest)
            print('rendered', dest)
        else:
            plan = json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))
            n = 0
            for post in plan:
                if args and not any(post['id'].startswith(a) for a in args):
                    continue
                for i, spec in enumerate(post['slides']):
                    name = post['images'][i]
                    sub = 'story' if post['kind'] == 'STORY' else 'feed'
                    dest = OUT / sub / name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    try:
                        shoot(page, spec, dest)
                        n += 1
                    except Exception as e:  # keep going, report at the end
                        print('FAILED', post['id'], name, str(e).splitlines()[0], flush=True)
            print('rendered', n, 'images')
        browser.close()
    srv.shutdown()


if __name__ == '__main__':
    main()
