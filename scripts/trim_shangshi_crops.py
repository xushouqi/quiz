#!/usr/bin/env python3
"""修剪上实机考题图四周空白(尤其右侧误带入的空白页)。

背景:此前裁切时把原卷右侧空白页也包含进来,导致图片 1654 宽但实际
图案只占左侧约 40%,显示时图案很小。本脚本对每张图做内容包围盒检测,
裁掉四周空白,只保留有效图案(四周留少量边距)。

用法:
  python3 scripts/trim_shangshi_crops.py            # 裁切 cropped/ 题图
  python3 scripts/trim_shangshi_crops.py --options  # 同时裁切 options/ 选项图
  python3 scripts/trim_shangshi_crops.py --dry-run  # 只统计不写盘
"""
import argparse
import glob
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CROPPED_DIR = os.path.join(ROOT, "public", "questions-images", "cropped")
OPTIONS_DIR = os.path.join(ROOT, "public", "questions-images", "options")

LUMA_THRESH = 250  # 灰度低于此值视为有效内容(背景接近白 255)
PAD = 14           # 包围盒四周保留边距
MIN_CONTENT = 30   # 内容包围盒宽/高小于此值视为异常,跳过


def content_bbox(im: Image.Image):
    g = im.convert("L")
    w, h = g.size
    px = g.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y] < LUMA_THRESH:
                if x < minx:
                    minx = x
                if x > maxx:
                    maxx = x
                if y < miny:
                    miny = y
                if y > maxy:
                    maxy = y
    if maxx < 0:
        return None
    return (minx, miny, maxx, maxy)


def trim_image(path: str, dry_run: bool):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    bbox = content_bbox(im)
    if bbox is None:
        return (os.path.basename(path), w, h, None, "blank")
    minx, miny, maxx, maxy = bbox
    cw, ch = maxx - minx + 1, maxy - miny + 1
    if cw < MIN_CONTENT and ch < MIN_CONTENT:
        return (os.path.basename(path), w, h, None, "too-small")
    left = max(0, minx - PAD)
    top = max(0, miny - PAD)
    right = min(w, maxx + 1 + PAD)
    bottom = min(h, maxy + 1 + PAD)
    if not dry_run:
        im.crop((left, top, right, bottom)).save(path)
    return (os.path.basename(path), w, h, (right - left, bottom - top), "ok")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--options", action="store_true", help="同时裁切 options/ 选项图")
    ap.add_argument("--dry-run", action="store_true", help="只统计不写盘")
    args = ap.parse_args()

    targets = sorted(glob.glob(os.path.join(CROPPED_DIR, "q[0-9][0-9][0-9].png")))
    if args.options:
        targets += sorted(glob.glob(os.path.join(OPTIONS_DIR, "*.png")))

    ok = skipped = 0
    for path in targets:
        name, ow, oh, newsize, status = trim_image(path, args.dry_run)
        if status == "ok":
            ok += 1
            print(f"{name}: {ow}x{oh} -> {newsize[0]}x{newsize[1]}")
        else:
            skipped += 1
            print(f"{name}: SKIP ({status}) {ow}x{oh}")

    print(f"\n完成: 裁切 {ok} 张, 跳过 {skipped} 张, 共 {len(targets)} 张"
          + (" [dry-run 未写盘]" if args.dry_run else ""))


if __name__ == "__main__":
    main()
