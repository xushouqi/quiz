#!/usr/bin/env python3
"""把参考原题 PDF 渲染成 PNG,便于逐题比对裁切图。"""
import os
import re
import subprocess

REF = "/mnt/f/BaiduNetdiskDownload/上实100机考题"
OUT = "/mnt/c/Users/xusho/.qwenworkcn/workspace/mt7004w1jklcievw/hl_edit/quiz/ref-pages"

os.makedirs(OUT, exist_ok=True)

pdfs = [f for f in os.listdir(REF) if f.endswith(".pdf") and "答案" not in f]


def sort_key(f):
    m = re.search(r"(\d+)", f)
    return int(m.group(1)) if m else 999


pdfs.sort(key=sort_key)

manifest = []
for idx, f in enumerate(pdfs, 1):
    src = os.path.join(REF, f)
    info = subprocess.run(["pdfinfo", src], capture_output=True, text=True).stdout
    pages = int(info.split("Pages:")[1].split("\n")[0].strip())
    print(f"[{idx:02d}] {f}: {pages} pages")
    out_pref = os.path.join(OUT, f"pdf{idx:02d}")
    subprocess.run(["pdftoppm", "-png", "-r", "150", src, out_pref], check=True)
    manifest.append({"idx": idx, "file": f, "pages": pages})

with open(os.path.join(OUT, "_manifest.txt"), "w", encoding="utf-8") as fh:
    for m in manifest:
        fh.write(f"{m['idx']:02d}\t{m['file']}\t{m['pages']}\n")

print("rendered", sum(m["pages"] for m in manifest), "pages from", len(manifest), "pdfs")
