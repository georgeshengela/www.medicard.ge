"""Render poster.html -> welcome.jpg (1080x1350, < 1 MB for the community upload limit) and welcome.png."""
import functools
import http.server
import pathlib
import threading

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == '__main__':
    srv = serve()
    url = f'http://127.0.0.1:{srv.server_address[1]}/brand/community-welcome/poster.html'
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1200, 'height': 1500}, device_scale_factor=2)
        page.goto(url)
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(400)
        png = HERE / 'welcome.png'
        page.locator('#poster').screenshot(path=str(png))
        browser.close()
    im = Image.open(png).convert('RGB').resize((1080, 1350), Image.LANCZOS)
    jpg = HERE / 'welcome.jpg'
    im.save(jpg, quality=88, optimize=True, progressive=True)
    print(jpg, jpg.stat().st_size, 'bytes')
    srv.shutdown()
