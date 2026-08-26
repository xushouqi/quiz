#!/usr/bin/env python3
"""把每个原卷 PDF 的渲染页横向拼接成总览图,便于与裁切汇总对照。"""
import glob
import os

from PIL import Image

REF = "/mnt/c/Users/xusho/.qwenworkcn/workspace/mt7004w1jklcievw/hl_edit/quiz/ref-pages"
PAGE_W = 620  # 每页缩放宽度
GAP = 20


def main():
    for pdf_idx in range(1, 11):
        pages = sorted(glob.glob(os.path.join(REF, f"pdf{pdf_idx:02d}-*.png")))
        if not pages:
            continue
        ims = []
        for p in pages:
            im = Image.open(p).convert("RGB")
            w, h = im.size
            scale = PAGE_W / w
            ims.append(im.resize((PAGE_W, int(h * scale)), Image.LANCZOS))
        total_w = sum(im.size[0] for im in ims) + GAP * (len(ims) - 1)
        max_h = max(im.size[1] for im in ims)
        canvas = Image.new("RGB", (total_w, max_h), "white")
        x = 0
        for im in ims:
            canvas.paste(im, (x, 0))
            x += im.size[0] + GAP
        out = os.path.join(REF, f"overview_{pdf_idx:02d}.png")
        canvas.save(out)
        print("saved", out, canvas.size)


if __name__ == "__main__":
    main()
