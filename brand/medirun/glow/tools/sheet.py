# Side-by-side contact sheet: python sheet.py out.png "label A" a.png "label B" b.png [...]
import sys
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
pairs = list(zip(sys.argv[2::2], sys.argv[3::2]))
imgs = [Image.open(p).convert('RGB') for _, p in pairs]
h = min(i.height for i in imgs)
imgs = [i.resize((round(i.width * h / i.height), h), Image.LANCZOS) for i in imgs]
gap, top = 24, 64
W = sum(i.width for i in imgs) + gap * (len(imgs) + 1)
sheet = Image.new('RGB', (W, h + top + gap), (9, 12, 20))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 28)
except Exception:
    font = ImageFont.load_default()
x = gap
for (label, _), im in zip(pairs, imgs):
    draw.text((x + 8, 16), label, fill=(226, 232, 240), font=font)
    sheet.paste(im, (x, top))
    x += im.width + gap
sheet.save(out)
print('saved', out, sheet.size)
