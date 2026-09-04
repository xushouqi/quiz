#!/usr/bin/env python3
"""奥数题英文翻译：用 deep_translator (Google Translate) 批量翻译。

用法:
    python3 scripts/translate-olympiad-fast.py              # 翻译所有未翻译的
    python3 scripts/translate-olympiad-fast.py --limit 100  # 只翻译 100 题后停止
    python3 scripts/translate-olympiad-fast.py --force      # 忽略"已翻译"判断

特点：
- 增量保存：每翻译 10 题保存一次，崩溃不丢进度
- 自动跳过纯数字/符号的内容
- 限速：每次翻译间隔 0.3-0.8 秒，避免 Google 屏蔽
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import random
from pathlib import Path

try:
    from deep_translator import GoogleTranslator
except ImportError:
    print("请安装 deep_translator: pip3 install deep_translator", file=sys.stderr)
    sys.exit(1)

DIR = Path("questions/olympiad")
ZH = re.compile(r"[一-鵿]")
# 纯数字/符号/常见数学符号：不翻译
SKIP = re.compile(r"^[\d\s.,/%+−×÷=°′″:()\-~^A-Za-z₀-₉²³⁴⁵⁶⁷⁸⁹¼½¾⅓⅔⅛⅜⅝⅞√∞≤≥<>]+$")

translator = GoogleTranslator(source="zh-CN", target="en")


def should_skip(text: str) -> bool:
    if not text or not text.strip():
        return True
    if not ZH.search(text):
        return True  # 没有中文，不需要翻译
    if SKIP.match(text.strip()):
        return True
    return False


def translate(text: str, max_retries: int = 3) -> str | None:
    if should_skip(text):
        return text
    for attempt in range(max_retries):
        try:
            result = translator.translate(text)
            if result:
                return result
            return text  # 翻译失败，保留原文
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 2
                print(f"    重试 ({wait}s): {e}", file=sys.stderr)
                time.sleep(wait)
            else:
                print(f"    翻译失败: {e}", file=sys.stderr)
                return text  # 失败，保留原文


def process_file(filepath: Path, force: bool, stats: dict) -> None:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    save_counter = 0

    for i, q in enumerate(data):
        # 翻译题干
        if force or q.get("text_en") == q.get("text_zh") or not q.get("text_en"):
            if not should_skip(q.get("text_zh", "")):
                en = translate(q["text_zh"])
                if en and en != q.get("text_en"):
                    q["text_en"] = en
                    changed = True
                    stats["text"] += 1
                    save_counter += 1

        # 翻译解析
        if force or q.get("explanation_en") == q.get("explanation_zh") or not q.get("explanation_en"):
            if not should_skip(q.get("explanation_zh", "")):
                en = translate(q["explanation_zh"])
                if en and en != q.get("explanation_en"):
                    q["explanation_en"] = en
                    changed = True
                    stats["explanation"] += 1
                    save_counter += 1

        # 翻译选项
        for c in q.get("choices", []):
            if force or c.get("en") == c.get("zh") or not c.get("en"):
                if not should_skip(c.get("zh", "")):
                    en = translate(c["zh"])
                    if en and en != c.get("en"):
                        c["en"] = en
                        changed = True
                        stats["choice"] += 1
                        save_counter += 1

        # 限速
        time.sleep(random.uniform(0.2, 0.5))

        # 增量保存
        if save_counter >= 10:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"  💾 已保存 ({filepath.name} #{i})", file=sys.stderr)
            save_counter = 0

    # 最终保存
    if changed:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")


def main():
    parser = argparse.ArgumentParser(description="奥数题英文翻译（deep_translator 加速版）")
    parser.add_argument("--limit", type=int, default=0, help="最多翻译 N 个字段后停止（0=不限）")
    parser.add_argument("--force", action="store_true", help="忽略'已翻译'判断，全部重翻")
    args = parser.parse_args()

    files = sorted(DIR.glob("*.json"))
    stats = {"text": 0, "explanation": 0, "choice": 0}

    print(f"🌐 开始翻译 {len(files)} 个文件...")
    if args.limit:
        print(f"   限制：最多翻译 {args.limit} 个字段")

    for filepath in files:
        print(f"\n📄 {filepath.name}")
        process_file(filepath, args.force, stats)

        total = stats["text"] + stats["explanation"] + stats["choice"]
        print(f"   累计：题干 {stats['text']} / 解析 {stats['explanation']} / 选项 {stats['choice']} = {total}")

        if args.limit and total >= args.limit:
            print(f"\n⏸  已达限制 ({args.limit})，停止")
            break

    total = stats["text"] + stats["explanation"] + stats["choice"]
    print(f"\n✅ 完成！共翻译 {total} 个字段")


if __name__ == "__main__":
    main()
