#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给 questions/olympiad/*.json 补上英文(text_en / explanation_en / choices[].en)。

数据由 scripts/import-olympiad.py 生成时, 英文字段先填了中文占位(满足工程非空校验)。
本脚本用免费 MyMemory 接口把英文补全, 用法:

    python scripts/translate-olympiad.py            # 续传: 只翻译仍是中文占位的条目
    python scripts/translate-olympiad.py --max 50   # 本轮最多翻译 50 道题(省配额)
    python scripts/translate-olympiad.py --force    # 忽略"已是英文"判断, 全部重翻

要点:
- 可断点续传: 一轮配额耗尽会自动停止并保存已翻译的部分, 下次接着跑即可。
- 选项若是纯数字/符号(如 "12"、"3/4")则不翻译, 直接用原文。
- MyMemory 免费匿名额度约 5000 字符/天, 全量 2593 题需多日分批, 属正常。
- 若你有更好的翻译后端(DeepL / 大模型 API), 把 _translate() 换掉即可。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

API = "https://api.mymemory.translated.net/get"
NUMERIC = re.compile(r"^[\d\s.,/%+−×÷=°′″:()\-~^A-Za-z₀-₉²³⁴⁵⁶⁷⁸⁹]+$")
ZH = re.compile(r"[一-鿿]")


def _translate(text: str) -> str | None:
    if not text or not ZH.search(text):
        return text  # 没有中文就不用翻
    q = urllib.parse.urlencode({"q": text, "langpair": "zh-CN|en"})
    req = urllib.request.Request(f"{API}?{q}", headers={"User-Agent": "Mozilla/5.0"})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=20))
    except Exception as exc:  # 网络抖动
        print(f"  ! 翻译请求失败: {exc}", file=sys.stderr)
        return None
    status = d.get("responseStatus")
    if status != 200:
        detail = d.get("responseDetails", "")
        print(f"  ! MyMemory 拒绝 (status={status}): {detail}", file=sys.stderr)
        return None  # 调用方据此停止续传
    return d.get("responseData", {}).get("translatedText", "")


def translate_question(q: dict, force: bool) -> bool:
    """就地补全英文。返回 True 表示本轮产生了一次成功翻译(消耗配额)。"""
    did = False

    if force or q.get("text_en") == q.get("text_zh"):
        en = _translate(q["text_zh"])
        if en is None:
            return False
        q["text_en"] = en
        did = True

    if force or q.get("explanation_en") == q.get("explanation_zh"):
        en = _translate(q["explanation_zh"])
        if en is None:
            return False
        q["explanation_en"] = en
        did = True

    for c in q.get("choices", []):
        if c.get("en") and not force and c["en"] != c.get("zh"):
            continue
        if NUMERIC.fullmatch(c.get("zh", "")):
            c["en"] = c["zh"]
            continue
        en = _translate(c["zh"])
        if en is None:
            return did
        c["en"] = en
        did = True

    return did


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=str(Path(__file__).resolve().parent.parent / "questions" / "olympiad"))
    ap.add_argument("--max", type=int, default=0, help="本轮最多翻译多少道题(0=不限制)")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    base = Path(args.dir)
    files = sorted(base.glob("*.json"))
    if not files:
        print(f"未找到题库文件: {base}")
        return 1

    budget = args.max
    done_total = 0
    stop = False
    for f in files:
        qs = json.loads(f.read_text(encoding="utf-8"))
        changed = False
        for q in qs:
            if budget and done_total >= budget:
                stop = True
                break
            if not (args.force or q.get("text_en") == q.get("text_zh") or any(
                c.get("en") == c.get("zh") and not NUMERIC.fullmatch(c.get("zh", "")) for c in q.get("choices", [])
            ) or q.get("explanation_en") == q.get("explanation_zh")):
                continue
            before = (q.get("text_en"), q.get("explanation_en"))
            ok = translate_question(q, args.force)
            if not ok:
                stop = True
                break
            if (q.get("text_en"), q.get("explanation_en")) != before:
                changed = True
                done_total += 1
            time.sleep(0.4)  # 礼貌限速, 避免触发频控
        if changed:
            f.write_text(json.dumps(qs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"  ✔ 已保存 {f.name}（累计翻译 {done_total} 题）")
        if stop:
            break

    print(f"\n本轮完成, 共翻译 {done_total} 题。剩余未翻的题下次直接重跑本脚本即可续传。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
