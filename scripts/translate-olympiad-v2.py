#!/usr/bin/env python3
"""奥数题英文翻译（v2 - 保守限速版）

特点：
- 15 秒基础延迟（保守避免限速）
- 限速时指数退避（30s → 60s → 120s，最大 10 分钟）
- 每 5 题保存一次
- 跳过已翻译的内容

用法:
    python3 scripts/translate-olympiad-v2.py
"""
from __future__ import annotations

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

# 限速参数
BASE_DELAY = 15.0  # 基础延迟（秒）
BACKOFF_START = 30  # 首次限速等待（秒）
BACKOFF_MAX = 600  # 最大等待（10 分钟）


def should_skip(text: str) -> bool:
    if not text or not text.strip():
        return True
    if not ZH.search(text):
        return True
    if SKIP.match(text.strip()):
        return True
    return False


def translate(text: str) -> str:
    """翻译文本，带指数退避"""
    if should_skip(text):
        return text

    backoff = BACKOFF_START
    while True:
        try:
            result = translator.translate(text)
            if result:
                # 成功，基础延迟
                time.sleep(random.uniform(BASE_DELAY * 0.8, BASE_DELAY * 1.2))
                return result
            return text
        except Exception as e:
            msg = str(e).lower()
            if "429" in msg or "too many" in msg or "rate" in msg or "limit" in msg:
                # 限速 - 指数退避
                wait = min(backoff, BACKOFF_MAX)
                print(f"    ⏳ 限速，等待 {wait}s", file=sys.stderr, flush=True)
                time.sleep(wait)
                backoff *= 2  # 指数增长
            else:
                # 其他错误 - 短等待后重试
                print(f"    ⚠️  错误: {e}", file=sys.stderr, flush=True)
                time.sleep(5)
                backoff = BACKOFF_START  # 重置退避


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

        # 解析
        if q.get("explanation_en") == q.get("explanation_zh") or not q.get("explanation_en"):
            if not should_skip(q.get("explanation_zh", "")):
                q["explanation_en"] = translate(q["explanation_zh"])
                changed = True
                stats["explanation"] += 1
                save_counter += 1

        # 选项
        for c in q.get("choices", []):
            if c.get("en") == c.get("zh") or not c.get("en"):
                if not should_skip(c.get("zh", "")):
                    c["en"] = translate(c["zh"])
                    changed = True
                    stats["choice"] += 1
                    save_counter += 1

        # 每 5 题保存一次
        if save_counter >= 5:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"  💾 已保存 ({i+1}/{total})", file=sys.stderr, flush=True)
            save_counter = 0

        # 进度报告
        if (i + 1) % 10 == 0:
            print(f"  📊 {i+1}/{total} 题", file=sys.stderr, flush=True)

    if changed:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")


def main():
    files = sorted(DIR.glob("*.json"))
    stats = {"text": 0, "explanation": 0, "choice": 0}

    print(f"🌐 MyMemory 翻译 v2（保守限速版）", flush=True)
    print(f"   基础延迟: {BASE_DELAY}s，预计速度: ~4 字段/分钟", flush=True)

    for filepath in files:
        print(f"\n📄 {filepath.name}", flush=True)
        process_file(filepath, stats)
        total = stats["text"] + stats["explanation"] + stats["choice"]
        print(f"   累计：{total} 字段", flush=True)

    total = stats["text"] + stats["explanation"] + stats["choice"]
    print(f"\n✅ 完成！翻译 {total} 字段", flush=True)


if __name__ == "__main__":
    main()
