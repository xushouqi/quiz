#!/usr/bin/env python3
"""奥数题英文翻译：用 MyMemory 批量翻译。

特点：
- 增量保存：每翻译 10 题保存一次
- 自动跳过纯数字/符号的内容
- 限速：每次翻译间隔 1.6-2.5 秒，避免 MyMemory 屏蔽
- 进度报告：每完成一个文件打印进度

用法:
    python3 scripts/translate-olympiad-mymemory.py
    python3 scripts/translate-olympiad-mymemory.py --limit 100  # 只翻译 100 题后停止
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
    from deep_translator import MyMemoryTranslator
except ImportError:
    print("pip install deep-translator", file=sys.stderr)
    sys.exit(1)

DIR = Path("questions/olympiad")
ZH = re.compile(r"[一-鿿]")
SKIP = re.compile(r"^[\d\s.,/%+−×÷=°′″:()\-~^A-Za-z₀-₉²³⁴⁵⁶⁷⁸⁹¼½¾⅓⅔⅛⅜⅝⅞√∞≤≥<>／]+$")

translator = MyMemoryTranslator(source="chinese simplified", target="english us")


def should_skip(text: str) -> bool:
    if not text or not text.strip():
        return True
    if not ZH.search(text):
        return True
    if SKIP.match(text.strip()):
        return True
    return False


def translate(text: str, max_retries: int = 3) -> str:
    if should_skip(text):
        return text
    for attempt in range(max_retries):
        try:
            result = translator.translate(text)
            return result if result else text
        except Exception as e:
            msg = str(e)
            if "429" in msg or "rate" in msg.lower() or "limit" in msg.lower():
                wait = 60 * (attempt + 1)
                print(f"    限速，等待 {wait}s: {msg}", file=sys.stderr, flush=True)
                time.sleep(wait)
            elif attempt < max_retries - 1:
                wait = (attempt + 1) * 3
                print(f"    重试 ({wait}s): {msg}", file=sys.stderr, flush=True)
                time.sleep(wait)
            else:
                print(f"    失败: {msg}", file=sys.stderr, flush=True)
                return text
    return text


def process_file(filepath: Path, stats: dict) -> None:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    save_counter = 0
    total = len(data)

    for i, q in enumerate(data):
        # 题干
        if q.get("text_en") == q.get("text_zh") or not q.get("text_en"):
            if not should_skip(q.get("text_zh", "")):
                q["text_en"] = translate(q["text_zh"])
                changed = True
                stats["text"] += 1
                save_counter += 1
                time.sleep(random.uniform(1.5, 2.5))

        # 解析
        if q.get("explanation_en") == q.get("explanation_zh") or not q.get("explanation_en"):
            if not should_skip(q.get("explanation_zh", "")):
                q["explanation_en"] = translate(q["explanation_zh"])
                changed = True
                stats["explanation"] += 1
                save_counter += 1
                time.sleep(random.uniform(1.5, 2.5))

        # 选项
        for c in q.get("choices", []):
            if c.get("en") == c.get("zh") or not c.get("en"):
                if not should_skip(c.get("zh", "")):
                    c["en"] = translate(c["zh"])
                    changed = True
                    stats["choice"] += 1
                    save_counter += 1
                    time.sleep(random.uniform(1.5, 2.5))

        # 增量保存
        if save_counter >= 10:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"  💾 已保存 ({i+1}/{total})", file=sys.stderr, flush=True)
            save_counter = 0

        # 进度
        if (i + 1) % 20 == 0:
            print(f"  📊 {i+1}/{total} 题处理完", file=sys.stderr, flush=True)

    if changed:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    files = sorted(DIR.glob("*.json"))
    stats = {"text": 0, "explanation": 0, "choice": 0}

    print(f"🌐 MyMemory 翻译 {len(files)} 个文件", flush=True)

    for filepath in files:
        print(f"\n📄 {filepath.name}", flush=True)
        process_file(filepath, stats)
        total = stats["text"] + stats["explanation"] + stats["choice"]
        print(f"   累计：题干 {stats['text']} / 解析 {stats['explanation']} / 选项 {stats['choice']} = {total}", flush=True)

        if args.limit and total >= args.limit:
            print(f"\n⏸ 达限制 ({args.limit})", flush=True)
            break

    total = stats["text"] + stats["explanation"] + stats["choice"]
    print(f"\n✅ 完成！翻译 {total} 字段", flush=True)


if __name__ == "__main__":
    main()
