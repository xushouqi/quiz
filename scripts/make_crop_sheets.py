#!/usr/bin/env python3
"""把每题的题图+选项裁切图拼成汇总图,便于与原卷逐题比对。
每批 10 题,输出 batchNN_crops.png(网格:每题一行,左题图右选项)。"""
import glob
import json
import os

from PIL import Image, ImageDraw

QUIZ = "/home/xsq/quiz"
OUT = "/mnt/c/Users/xusho/.qwenworkcn/workspace/mt7004w1jklcievw/hl_edit/quiz/ref-pages"

os.makedirs(OUT, exist_ok=True)

LETTERS = "ABCDEFGH"


def asset(rel):
    p = os.path.join(QUIZ, "public", rel.lstrip("/").split("?")[0])
    return p if os.path.exists(p) else None


def load_questions():
    qs = []
    for f in sorted(glob.glob(os.path.join(QUIZ, "questions/shangshi/*.json"))):
        for q in json.load(open(f)):
            qs.append(q)
    return qs


def fit(im, max_w, max_h):
    w, h = im.size
    scale = min(max_w / w, max_h / h, 1.0)
    if scale >= 1.0:
        return im
    return im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)


def make_batch(qs, start, end, out_path):
    ROW_H = 190
    QIMG_W = 300
    TOTAL_W = 1400
    n = end - start + 1
    canvas = Image.new("RGB", (TOTAL_W, n * ROW_H), "white")
    dr = ImageDraw.Draw(canvas)
    for i, qn in enumerate(range(start, end + 1)):
        q = qs[qn - 1]
        y0 = i * ROW_H
        dr.rectangle([0, y0, TOTAL_W, y0 + ROW_H], outline="#999999")
        # label
        ans = LETTERS[q.get("correct_index", 0)]
        dr.text((8, y0 + 6), f"Q{qn}  ans={ans}", fill="#d00000")
        x = 10
        # 题图
        ill = q.get("illustration")
        if ill and ill.startswith("img:"):
            p = asset(ill[4:])
            if p:
                im = fit(Image.open(p).convert("RGB"), QIMG_W, ROW_H - 30)
                canvas.paste(im, (x, y0 + 26))
                x += im.size[0] + 12
            else:
                dr.text((x, y0 + 60), "[no q-img]", fill="#888888")
                x += 120
        else:
            dr.text((x, y0 + 60), "[no img]", fill="#888888")
            x += 90
        # 选项图
        for j, c in enumerate(q.get("choices", [])):
            cp = asset(c.get("img", "")) if c.get("img") else None
            if cp:
                im = fit(Image.open(cp).convert("RGB"), 150, ROW_H - 50)
                dr.text((x, y0 + 8), LETTERS[j], fill="#0055aa")
                canvas.paste(im, (x, y0 + 26))
                x += im.size[0] + 14
            else:
                dr.text((x, y0 + 60), f"{LETTERS[j]}:(text)", fill="#0055aa")
                x += 90
    canvas.save(out_path)
    print("saved", out_path, canvas.size)


def main():
    qs = load_questions()
    print("total questions:", len(qs))
    # 与参考 PDF 题号范围对齐
    ranges = [(1, 9), (10, 20), (21, 30), (31, 39), (40, 49),
              (50, 59), (60, 69), (70, 79), (80, 89), (90, 100)]
    for bi, (start, end) in enumerate(ranges, 1):
        out_path = os.path.join(OUT, f"range{bi:02d}_crops.png")
        make_batch(qs, start, end, out_path)


if __name__ == "__main__":
    main()
