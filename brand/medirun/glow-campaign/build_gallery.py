"""Copy the campaign media and the plan page to server/private/press/medirun-glow/ (admin only).

  python build_gallery.py   (after render.py and social.py)

The folder is not public: the server serves it at /press/medirun-glow/… only to a signed-in admin
(src/lib/campaignMedia.js), and admin #/campaigns shows the plan, every post with its caption and the print
files. Scheduled Metricool posts keep their own copies of the images, so they do not depend on these URLs.
The plan's own images and fonts are rewritten to the flat folder and the site's FiraGO.
"""
import pathlib, shutil

HERE = pathlib.Path(__file__).resolve().parent
DEST = HERE.parents[2] / 'server' / 'private' / 'press' / 'medirun-glow'
DEST.mkdir(parents=True, exist_ok=True)
for sub in ('feed', 'story'):
    for f in (HERE / 'out' / sub).glob('*.jpg'):
        shutil.copy2(f, DEST / f.name)
for f in (HERE / 'out' / 'print').glob('*.pdf'):
    shutil.copy2(f, DEST / f.name)
# Light previews for the admin cards (the PNG renders are 1–2 MB).
from PIL import Image
for f in (HERE / 'out' / 'print').glob('*.png'):
    im = Image.open(f).convert('RGB')
    im.thumbnail((600, 840))
    im.save(DEST / (f.stem + '-preview.jpg'), quality=82, optimize=True, progressive=True)
for old in DEST.glob('*-preview.png'):
    old.unlink()

plan = (HERE / 'plan.html').read_text(encoding='utf-8')
plan = plan.replace('src="img/', 'src="').replace('url(fonts/', 'url(/fonts/firago/')
head = '<!DOCTYPE html>\n<html lang="ka">\n<head>\n<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">\n'
plan = plan.replace('<title>', head + '<title>', 1).replace('</style>\n', '</style>\n</head>\n<body>\n', 1) + '</body>\n</html>\n'
(DEST / 'plan.html').write_text(plan, encoding='utf-8')
print('campaign media:', DEST, '·', len(list(DEST.iterdir())), 'files')
