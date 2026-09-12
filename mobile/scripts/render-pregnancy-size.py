"""Editorial still-life object illustrations for pregnancy size comparisons.

Same lighting, canvas, and background treatment. Transparent WebP, about 512px.

    python mobile/scripts/render-pregnancy-size.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 512
OUT = Path(__file__).resolve().parents[1] / "assets" / "pregnancy-size"


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c0, c1, t):
    return tuple(int(lerp(c0[i], c1[i], t)) for i in range(len(c0)))


def new_canvas():
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def paste_soft(base, layer):
    base.alpha_composite(layer)


def blush(img):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([96, 96, 416, 416], fill=(255, 241, 242, 36))
    return layer.filter(ImageFilter.GaussianBlur(12))


def shadow(img, cx, cy, rx, ry, alpha=55):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(31, 20, 28, alpha))
    return layer.filter(ImageFilter.GaussianBlur(16))


def radial_ellipse(draw, box, inner, outer, steps=18):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w, h = (x1 - x0), (y1 - y0)
    for i in range(steps, 0, -1):
        t = i / steps
        color = mix(inner, outer, 1 - t)
        if len(color) == 3:
            color = (*color, 255)
        draw.ellipse(
            [cx - w * t / 2, cy - h * t / 2, cx + w * t / 2, cy + h * t / 2],
            fill=color,
        )


def spec(draw, x, y, r):
    draw.ellipse([x - r, y - r * 0.55, x + r * 0.55, y + r * 0.22], fill=(255, 255, 255, 48))


def save(img, name):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.webp"
    img.save(path, "WEBP", quality=84, method=6)
    print(path.name, path.stat().st_size)


def round_fruit(cx, cy, rx, ry, inner, outer, shade_shift=(0, 18)):
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, cx + 8, cy + ry * 0.78, rx * 0.72, ry * 0.22))
    d = ImageDraw.Draw(img)
    radial_ellipse(d, [cx - rx, cy - ry, cx + rx, cy + ry], inner, outer)
    spec(d, cx - rx * 0.28 + shade_shift[0], cy - ry * 0.34 + shade_shift[1], rx * 0.22)
    return img, d


def poppy_seed():
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, 256, 328, 36, 14, 40))
    d = ImageDraw.Draw(img)
    radial_ellipse(d, [238, 238, 274, 278], (62, 40, 52), (22, 16, 24))
    spec(d, 246, 248, 6)
    return img


def sesame():
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, 256, 332, 64, 18, 40))
    d = ImageDraw.Draw(img)
    for x, y, a in ((236, 248, 16), (270, 244, 15), (252, 272, 15), (280, 270, 14), (224, 268, 14)):
        radial_ellipse(d, [x - a, y - a * 0.62, x + a, y + a * 0.7], (240, 214, 168), (186, 150, 104))
        spec(d, x - 4, y - 3, 4)
    return img


def blueberry():
    img, d = round_fruit(256, 252, 96, 90, (118, 146, 206), (46, 62, 128))
    d.ellipse([247, 214, 265, 230], fill=(40, 46, 92, 210))
    d.ellipse([250, 216, 262, 226], fill=(70, 78, 140, 180))
    return img


def raspberry():
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, 256, 348, 86, 22))
    d = ImageDraw.Draw(img)
    cells = []
    for row, n, y in ((0, 3, 208), (1, 4, 238), (2, 4, 270), (3, 3, 300)):
        span = (n - 1) * 30
        x0 = 256 - span / 2
        for i in range(n):
            cells.append((x0 + i * 30, y))
    for x, y in cells:
        radial_ellipse(d, [x - 24, y - 22, x + 24, y + 24], (248, 110, 132), (168, 32, 64))
        spec(d, x - 6, y - 8, 7)
    return img


def strawberry():
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, 256, 360, 92, 22))
    d = ImageDraw.Draw(img)
    d.polygon([(256, 168), (150, 250), (168, 348), (256, 392), (344, 348), (362, 250)], fill=(214, 48, 64, 255))
    radial_ellipse(d, [176, 196, 336, 372], (244, 92, 102), (176, 32, 52))
    d.polygon([(256, 128), (214, 188), (256, 176), (298, 188)], fill=(56, 148, 82, 255))
    d.polygon([(256, 132), (236, 176), (256, 168), (276, 176)], fill=(86, 176, 102, 255))
    for x, y in ((210, 250), (286, 246), (232, 300), (278, 312), (256, 268), (224, 278)):
        d.ellipse([x - 3, y - 5, x + 3, y + 5], fill=(255, 220, 150, 210))
    spec(d, 214, 220, 18)
    return img


def lime():
    img, d = round_fruit(256, 254, 120, 102, (198, 224, 96), (90, 140, 40))
    d.ellipse([248, 158, 264, 172], fill=(120, 168, 52, 255))
    return img


def lemon():
    img, d = round_fruit(256, 254, 132, 96, (255, 230, 110), (214, 176, 36))
    d.ellipse([248, 160, 264, 174], fill=(232, 196, 64, 255))
    return img


def kiwi():
    img, d = round_fruit(256, 254, 116, 100, (176, 140, 86), (96, 70, 42))
    return img


def avocado():
    img, d = round_fruit(256, 250, 108, 138, (132, 176, 78), (58, 102, 42))
    d.ellipse([248, 146, 264, 164], fill=(78, 96, 42, 255))
    return img


def pear():
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, 256, 368, 78, 20))
    d = ImageDraw.Draw(img)
    radial_ellipse(d, [198, 214, 314, 368], (188, 204, 92), (112, 144, 48))
    radial_ellipse(d, [216, 148, 296, 252], (206, 220, 110), (136, 164, 56))
    d.rectangle([252, 118, 260, 154], fill=(96, 72, 40, 255))
    d.ellipse([258, 114, 286, 136], fill=(72, 148, 74, 255))
    spec(d, 226, 210, 22)
    return img


def mango():
    img, d = round_fruit(256, 252, 120, 132, (248, 164, 72), (196, 88, 32))
    d.ellipse([248, 128, 266, 148], fill=(88, 140, 52, 255))
    return img


def banana():
    img = new_canvas()
    paste_soft(img, blush(img))
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    radial_ellipse(d, [70, 226, 450, 312], (255, 220, 84), (224, 176, 36))
    d.ellipse([70, 236, 108, 300], fill=(92, 62, 32, 255))
    d.ellipse([430, 238, 462, 292], fill=(236, 196, 64, 255))
    spec(d, 160, 244, 28)
    rotated = layer.rotate(-28, resample=Image.BICUBIC, center=(256, 256))
    paste_soft(img, shadow(img, 270, 350, 120, 20, 45))
    paste_soft(img, rotated)
    return img


def eggplant():
    img, d = round_fruit(256, 268, 96, 146, (148, 84, 178), (78, 36, 118))
    d.polygon([(256, 104), (214, 154), (298, 154)], fill=(48, 148, 78, 255))
    d.rectangle([250, 116, 262, 154], fill=(64, 48, 28, 255))
    return img


def coconut():
    img, d = round_fruit(256, 254, 122, 112, (186, 132, 86), (96, 60, 34))
    for x, y in ((214, 228), (278, 236), (248, 268)):
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(72, 44, 24, 140))
    return img


def pineapple():
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, 256, 372, 86, 20))
    d = ImageDraw.Draw(img)
    radial_ellipse(d, [198, 186, 316, 372], (248, 196, 72), (196, 124, 28))
    for y in range(214, 340, 24):
        offset = 12 if (y // 24) % 2 else 0
        for x in range(220 + offset, 300, 24):
            d.polygon([(x, y), (x + 9, y + 12), (x, y + 22), (x - 9, y + 12)], outline=(176, 96, 28, 150))
    for i, dx in enumerate((-22, 0, 22, -10, 10)):
        top = 188 - 64 - abs(dx)
        d.polygon([(256 + dx * 0.2, 188), (256 + dx - 12, top), (256 + dx + 12, top + 16)], fill=(48, 148, 78, 255))
    spec(d, 226, 230, 18)
    return img


def watermelon():
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, 256, 360, 130, 22))
    d = ImageDraw.Draw(img)
    radial_ellipse(d, [108, 176, 404, 372], (86, 176, 82), (28, 102, 48))
    for dx, w in ((-70, 18), (-20, 16), (30, 18), (80, 16)):
        d.ellipse([256 + dx - w, 196, 256 + dx + w, 352], fill=(24, 88, 42, 70))
    spec(d, 196, 214, 24)
    return img


def placeholder():
    img = new_canvas()
    paste_soft(img, blush(img))
    paste_soft(img, shadow(img, 256, 330, 80, 18, 35))
    d = ImageDraw.Draw(img)
    radial_ellipse(d, [186, 196, 336, 336], (255, 244, 246), (244, 210, 216))
    return img


RENDERERS = {
    "poppy_seed": poppy_seed,
    "sesame": sesame,
    "blueberry": blueberry,
    "raspberry": raspberry,
    "strawberry": strawberry,
    "lime": lime,
    "lemon": lemon,
    "kiwi": kiwi,
    "avocado": avocado,
    "pear": pear,
    "mango": mango,
    "banana": banana,
    "eggplant": eggplant,
    "coconut": coconut,
    "pineapple": pineapple,
    "watermelon": watermelon,
    "placeholder": placeholder,
}


def main():
    for name, fn in RENDERERS.items():
        save(fn(), name)


if __name__ == "__main__":
    main()
