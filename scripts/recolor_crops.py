#!/usr/bin/env python3
"""用灰度裁切图作模板,在彩色原卷上定位并重新裁出彩色版本(第1-9题试点)。"""
import os

import cv2

PUBLIC = "/home/xsq/quiz/public"
HI = "/mnt/c/Users/xusho/.qwenworkcn/workspace/mt7004w1jklcievw/hl_edit/quiz/ref-pages/hi"
OUT = "/mnt/c/Users/xusho/.qwenworkcn/workspace/mt7004w1jklcievw/hl_edit/quiz/ref-pages/recolor"

# 题号 -> 页文件(pdf01 渲染的第几页)
PAGES = {1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3}
OPTION_SEARCH_H = 700  # 选项搜索区域:题图下方高度(px, 200dpi)


def main():
    os.makedirs(OUT, exist_ok=True)
    for qn in range(1, 10):
        page = cv2.imread(os.path.join(HI, f"p1-{PAGES[qn]}.png"))
        page_gray = cv2.cvtColor(page, cv2.COLOR_BGR2GRAY)

        # ---- 题图 ----
        tpl = cv2.imread(os.path.join(PUBLIC, f"questions-images/cropped/q{qn:03d}.png"),
                         cv2.IMREAD_GRAYSCALE)
        th, tw = tpl.shape
        res = cv2.matchTemplate(page_gray, tpl, cv2.TM_CCOEFF_NORMED)
        _, mx, _, mxl = cv2.minMaxLoc(res)
        x, y = mxl
        cv2.imwrite(os.path.join(OUT, f"q{qn:03d}.png"), page[y:y + th, x:x + tw])
        print(f"Q{qn} 题图 match={mx:.3f} at ({x},{y}) {tw}x{th}")

        # ---- 选项 ----
        for o in range(1, 9):
            op = os.path.join(PUBLIC, f"questions-images/options/q{qn:03d}_o{o}.png")
            if not os.path.exists(op):
                break
            tpl_o = cv2.imread(op, cv2.IMREAD_GRAYSCALE)
            oh, ow = tpl_o.shape
            # 搜索区域:题图下方固定高度内,避免跨到下一题
            top = y + th
            search = page_gray[top:top + OPTION_SEARCH_H, :]
            res_o = cv2.matchTemplate(search, tpl_o, cv2.TM_CCOEFF_NORMED)
            _, mo, _, mol = cv2.minMaxLoc(res_o)
            ox, oy = mol
            oy += top
            cv2.imwrite(os.path.join(OUT, f"q{qn:03d}_o{o}.png"),
                        page[oy:oy + oh, ox:ox + ow])
            print(f"  o{o} match={mo:.3f} at ({ox},{oy}) {ow}x{oh}")
    print("done ->", OUT)


if __name__ == "__main__":
    main()
