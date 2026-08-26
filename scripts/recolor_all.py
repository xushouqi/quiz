#!/usr/bin/env python3
"""重裁 Q10-82:灰度模板在 200 DPI 彩色原卷上定位,裁出彩色题图+选项图。"""
import glob
import os

import cv2

PUBLIC = "/home/xsq/quiz/public"
HI = "/mnt/c/Users/xusho/.qwenworkcn/workspace/mt7004w1jklcievw/hl_edit/quiz/ref-pages/hi"
OUT = "/mnt/c/Users/xusho/.qwenworkcn/workspace/mt7004w1jklcievw/hl_edit/quiz/ref-pages/recolor2"

# PDF 前缀 -> 题号范围
PDFS = [
    ("p2", 10, 20),
    ("p3", 21, 30),
    ("p4", 31, 39),
    ("p5", 40, 49),
    ("p6", 50, 59),
    ("p7", 60, 69),
    ("p8", 70, 79),
    ("p9", 80, 82),
]
OPTION_SEARCH_H = 1000  # 选项搜索:题图下方高度(200dpi)
MIN_SCORE = 0.9


def main():
    os.makedirs(OUT, exist_ok=True)
    low = []
    for prefix, q_start, q_end in PDFS:
        pages = sorted(glob.glob(os.path.join(HI, f"{prefix}-*.png")))
        page_imgs = [(p, cv2.imread(p)) for p in pages]
        for qn in range(q_start, q_end + 1):
            # ---- 题图:在 PDF 所有页上匹配,取最佳页 ----
            tpl = cv2.imread(os.path.join(PUBLIC, f"questions-images/cropped/q{qn:03d}.png"),
                             cv2.IMREAD_GRAYSCALE)
            th, tw = tpl.shape
            best = (-1, None, 0, 0, "")
            for p, img in page_imgs:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                res = cv2.matchTemplate(gray, tpl, cv2.TM_CCOEFF_NORMED)
                _, mx, _, mxl = cv2.minMaxLoc(res)
                if mx > best[0]:
                    best = (mx, img, mxl[0], mxl[1], os.path.basename(p))
            score, img, x, y, page = best
            if score < MIN_SCORE:
                low.append((qn, "题图", round(score, 3), page))
            cv2.imwrite(os.path.join(OUT, f"q{qn:03d}.png"), img[y:y + th, x:x + tw])

            # ---- 选项:全页匹配(部分题选项在题图右侧,如 Q77/78) ----
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            for o in range(1, 9):
                op = os.path.join(PUBLIC, f"questions-images/options/q{qn:03d}_o{o}.png")
                if not os.path.exists(op):
                    break
                tpl_o = cv2.imread(op, cv2.IMREAD_GRAYSCALE)
                oh, ow = tpl_o.shape
                res_o = cv2.matchTemplate(gray, tpl_o, cv2.TM_CCOEFF_NORMED)
                _, mo, _, mol = cv2.minMaxLoc(res_o)
                ox, oy = mol
                if mo < MIN_SCORE:
                    low.append((qn, f"o{o}", round(mo, 3), page))
                cv2.imwrite(os.path.join(OUT, f"q{qn:03d}_o{o}.png"),
                            img[oy:oy + oh, ox:ox + ow])
            print(f"Q{qn} 题图={score:.3f} page={page} 完成")
    if low:
        print("\n低分匹配(需人工复核):")
        for row in low:
            print(" ", row)
    print("done ->", OUT)


if __name__ == "__main__":
    main()
