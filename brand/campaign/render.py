"""Render every campaign image from plan.json via poster.html -> out/<image> (JPEG, web size).

Served over a local HTTP server (fetch() needs http). python render.py [slot ...]
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
SIZES = {1080: (1440, 1800), 1920: (1080, 1920), 627: (2400, 1254)}  # by poster height


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    plan = json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))
    want = set(sys.argv[1:])
    out = HERE / 'out'
    out.mkdir(exist_ok=True)
    srv = serve()
    base = f'http://127.0.0.1:{srv.server_address[1]}/brand/campaign/poster.html'
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1300, 'height': 2000}, device_scale_factor=2)
        for item in plan:
            if item.get('template') in (None, 'existing') or (want and item['slot'] not in want):
                continue
            page.goto(f"{base}?slot={item['slot']}")
            page.wait_for_function('document.body.dataset.ready === "1" || document.body.dataset.skip === "1"', timeout=60000)
            box = page.locator('#poster').bounding_box()
            png = out / (item['image'].rsplit('.', 1)[0] + '.png')
            page.locator('#poster').screenshot(path=str(png))
            h = round(box['height'])
            size = SIZES[1080] if h == 1350 else SIZES[1920] if h == 1920 else SIZES[627]
            Image.open(png).convert('RGB').resize(size, Image.LANCZOS).save(out / item['image'], quality=90, optimize=True, progressive=True)
            png.unlink()
            print('rendered', item['image'], flush=True)
        browser.close()
    srv.shutdown()


if __name__ == '__main__':
    main()
