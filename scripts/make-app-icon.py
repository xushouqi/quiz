#!/usr/bin/env python3
"""生成 Android 启动图标全套尺寸(方形/圆形/自适应前景)。
源图: android-icons/icon-clean.png(去水印满铺绿底袋鼠)。
用法: python3 scripts/make-app-icon.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(os.path.dirname(__file__), "..", "android-icons", "icon-clean.png")
SRC = os.path.abspath(SRC)
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

# 密度 → (方形, 圆形, 自适应前景) 边长
DENSITIES = {
    "mdpi": (48, 48, 108),
    "hdpi": (72, 72, 162),
    "xhdpi": (96, 96, 216),
    "xxhdpi": (144, 144, 324),
    "xxxhdpi": (192, 192, 432),
}

FG_SCALE = 0.72  # 自适应前景:图案占画布 72%(安全区内),其余透明露出背景色


def make_launcher_square(size: int) -> Image.Image:
    return Image.open(SRC).convert("RGB").resize((size, size), Image.LANCZOS)


def make_launcher_round(size: int) -> Image.Image:
    img = Image.open(SRC).convert("RGB").resize((size, size), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
    img.putalpha(mask)
    return img


def make_foreground(size: int) -> Image.Image:
    """前景画布(透明),满铺源图缩到 FG_SCALE 居中,余下留空让系统裁。"""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * FG_SCALE)
    if inner % 2 != size % 2:
        inner += 1  # 保持居中对称
    src = Image.open(SRC).convert("RGBA").resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    canvas.paste(src, (off, off), src)
    return canvas


def main() -> None:
    if not os.path.exists(SRC):
        raise SystemExit(f"源图不存在: {SRC}")
    for density, (sq, rd, fg) in DENSITIES.items():
        d = os.path.join(RES, f"mipmap-{density}")
        os.makedirs(d, exist_ok=True)
        make_launcher_square(sq).save(os.path.join(d, "ic_launcher.png"))
        make_launcher_round(rd).save(os.path.join(d, "ic_launcher_round.png"))
        make_foreground(fg).save(os.path.join(d, "ic_launcher_foreground.png"))
        print(f"{density}: square {sq}px, round {rd}px, foreground {fg}px")

    # adaptive icon 背景色 = 源图背景绿
    img = Image.open(SRC).convert("RGB")
    r, g, b = img.getpixel((8, 8))
    hex_color = "#{:02X}{:02X}{:02X}".format(r, g, b)
    colors_path = os.path.join(RES, "values", "ic_launcher_background.xml")
    with open(colors_path, "w", encoding="utf-8") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<resources>\n"
            f'    <color name="ic_launcher_background">{hex_color}</color>\n'
            "</resources>\n"
        )
    print(f"ic_launcher_background -> {hex_color}")
    print("done")


if __name__ == "__main__":
    main()
