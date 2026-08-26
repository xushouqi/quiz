#!/usr/bin/env python3
"""渲染 200 DPI 原卷页到 hi/ 目录(与裁切源图同分辨率,用于模板匹配重裁)。"""
import os
import re
import subprocess

REF = "/mnt/f/BaiduNetdiskDownload/上实100机考题"
HI = "/mnt/c/Users/xusho/.qwenworkcn/workspace/mt7004w1jklcievw/hl_edit/quiz/ref-pages/hi"

# PDF 文件名 -> 渲染前缀
TARGETS = [
    ("上实机考题10-20题汇总..pdf", "p2"),
    ("上实机考题21-30题汇总.pdf", "p3"),
    ("上实机考题31-39题汇总.pdf", "p4"),
    ("上实机考题40-49题汇总.pdf", "p5"),
    ("上实机考题50-59题汇总..pdf", "p6"),
    ("上实机考题60-69题汇总.pdf", "p7"),
    ("上实机考题70-79题汇总.pdf", "p8"),
    ("上实机考题80-89题汇总..pdf", "p9"),
]

os.makedirs(HI, exist_ok=True)
for fname, prefix in TARGETS:
    src = os.path.join(REF, fname)
    out_pref = os.path.join(HI, prefix)
    subprocess.run(["pdftoppm", "-png", "-r", "200", src, out_pref], check=True)
    print("rendered", fname, "->", prefix + "-*.png")
print("done")
