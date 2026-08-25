"""Process Medicard brand logos into app-ready assets with #14B8A6 brand fill."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(r"C:\Users\User\Desktop\Medicard DESIGN\assets")
OUT = ROOT / "mobile" / "assets"
BRAND = (20, 184, 166, 255)  # #14B8A6
LIGHT_BG = (245, 247, 247, 255)  # app canvas


def remove_near_black(img: Image.Image, threshold: int = 40) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def trim_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def pad_square(img: Image.Image, margin_ratio: float = 0.06) -> Image.Image:
    """Tiny even margin so the mark can scale up inside UI badges."""
    w, h = img.size
    side = max(w, h)
    margin = max(2, int(side * margin_ratio))
    canvas = side + margin * 2
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(img, ((canvas - w) // 2, (canvas - h) // 2), img)
    return out


def prepare_logo(path: Path) -> Image.Image:
    return pad_square(trim_alpha(remove_near_black(Image.open(path))))


def fit_center(icon: Image.Image, canvas: int, padding_ratio: float = 0.14) -> Image.Image:
    side = int(canvas * (1 - padding_ratio * 2))
    icon = icon.copy()
    icon.thumbnail((side, side), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(icon, ((canvas - icon.width) // 2, (canvas - icon.height) // 2), icon)
    return out


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)
    print(f"wrote {path.relative_to(ROOT)}")


def main() -> None:
    color_src = SRC / "logo-color.png"
    white_src = SRC / "logo.png"

    logo_light = prepare_logo(color_src)
    logo_dark = prepare_logo(white_src)
    save_png(logo_light, OUT / "logo-light.png")
    save_png(logo_dark, OUT / "logo-dark.png")

    icon = Image.new("RGBA", (1024, 1024), BRAND)
    icon_alpha = fit_center(logo_light, 1024, 0.14)
    icon = Image.alpha_composite(icon, icon_alpha)
    save_png(icon, OUT / "icon.png")

    splash = Image.new("RGBA", (512, 512), LIGHT_BG)
    splash_alpha = fit_center(logo_light, 512, 0.12)
    splash = Image.alpha_composite(splash, splash_alpha)
    save_png(splash, OUT / "splash-icon.png")

    fav = fit_center(logo_light, 192, 0.14)
    save_png(fav, OUT / "favicon.png")

    fg = fit_center(logo_light, 432, 0.16)
    save_png(fg, OUT / "android-icon-foreground.png")

    bg = Image.new("RGBA", (432, 432), BRAND)
    save_png(bg, OUT / "android-icon-background.png")

    mono = logo_light.copy()
    px = mono.load()
    w, h = mono.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (255, 255, 255, a)
    save_png(fit_center(mono, 432, 0.16), OUT / "android-icon-monochrome.png")


if __name__ == "__main__":
    main()
