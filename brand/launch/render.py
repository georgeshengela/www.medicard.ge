"""Render launch posters from poster.html -> out/<id>.png (2x) and out/<id>.jpg.

python render.py [id ...]
"""
import pathlib
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
IDS = ['feed', 'square', 'story', 'wide']


def main():
    ids = sys.argv[1:] or IDS
    out = HERE / 'out'
    out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1400, 'height': 2000}, device_scale_factor=2)
        page.goto((HERE / 'poster.html').as_uri())
        page.wait_for_load_state('networkidle')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(600)
        for pid in ids:
            dest = out / f'{pid}.png'
            page.locator(f'#{pid}').screenshot(path=str(dest))
            Image.open(dest).convert('RGB').save(out / f'{pid}.jpg', quality=92, optimize=True)
            print('rendered', dest)
        browser.close()


if __name__ == '__main__':
    main()
