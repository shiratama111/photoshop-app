#!/usr/bin/env python3
"""
Enrich font-catalog-v2.json → font-catalog-enriched.json

Reads the raw crawled font catalog, then for each of the 776 downloaded fonts:
1. Infers FontCategory from fontfree.me categories + font name heuristics
2. Extracts mood/style tags from Japanese descriptions
3. Computes a popularity score based on how many sources listed the font
4. Resolves the local file path relative to assets/fonts/japanese/

Output format matches the FontMetadata interface used at runtime.

Usage:
    python scripts/enrich-font-catalog.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CATALOG_V2 = PROJECT_ROOT / "assets" / "fonts" / "japanese" / "font-catalog-v2.json"
OUTPUT_PATH = PROJECT_ROOT / "assets" / "fonts" / "japanese" / "font-catalog-enriched.json"

# ---------------------------------------------------------------------------
# Category inference rules
# ---------------------------------------------------------------------------

# fontfree.me category → FontCategory mapping
FONTFREE_CATEGORY_MAP: dict[str, str] = {
    "kakugo": "sans",
    "gothic": "sans",
    "sans": "sans",
    "mincho": "serif",
    "serif": "serif",
    "marugo": "sans",
    "round": "sans",
    "tegaki": "handwriting",
    "handwriting": "handwriting",
    "script": "handwriting",
    "fude": "handwriting",
    "brush": "handwriting",
    "kawaii": "display",
    "pop": "display",
    "design": "display",
    "display": "display",
    "pixel": "display",
    "dot": "display",
    "horror": "display",
    "monospace": "monospace",
}

# Name-based heuristics (Japanese + English patterns)
NAME_CATEGORY_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"ゴシック|gothic|ゴチック|角", re.IGNORECASE), "sans"),
    (re.compile(r"明朝|mincho|serif", re.IGNORECASE), "serif"),
    (re.compile(r"丸|round|maru|ラウンド", re.IGNORECASE), "sans"),
    (re.compile(r"手書|tegaki|handwrit|script|手書き", re.IGNORECASE), "handwriting"),
    (re.compile(r"筆|fude|brush|毛筆|楷書|行書|草書", re.IGNORECASE), "handwriting"),
    (re.compile(r"ポップ|pop|kawaii|かわいい", re.IGNORECASE), "display"),
    (re.compile(r"ドット|dot|pixel|ピクセル|レトロ", re.IGNORECASE), "display"),
    (re.compile(r"デザイン|display|装飾|ファンシー|fancy", re.IGNORECASE), "display"),
    (re.compile(r"等幅|mono|コード|code", re.IGNORECASE), "monospace"),
]

# ---------------------------------------------------------------------------
# Tag extraction rules
# ---------------------------------------------------------------------------

# (regex_pattern, list of tags to assign)
TAG_RULES: list[tuple[re.Pattern[str], list[str]]] = [
    (re.compile(r"手書き|カジュアル|手書", re.IGNORECASE), ["手書き風", "カジュアル"]),
    (re.compile(r"ポップ|楽しい|fun|pop|ポップ体", re.IGNORECASE), ["ポップ"]),
    (re.compile(r"レトロ|昭和|vintage|retro|懐かし", re.IGNORECASE), ["レトロ"]),
    (re.compile(r"かわいい|可愛い|cute|kawaii|丸み|丸い|ラウンド", re.IGNORECASE), ["かわいい"]),
    (re.compile(r"力強い|太い|極太|bold|heavy|ウェイト|力強|インパクト", re.IGNORECASE), ["力強い", "インパクト"]),
    (re.compile(r"エレガント|上品|elegant|優雅|美し", re.IGNORECASE), ["エレガント", "高級"]),
    (re.compile(r"ホラー|恐怖|horror|怖い|おどろおどろ", re.IGNORECASE), ["クール", "デザイン"]),
    (re.compile(r"モダン|modern|スタイリッシュ|stylish|洗練", re.IGNORECASE), ["モダン"]),
    (re.compile(r"フォーマル|formal|ビジネス|business|公式", re.IGNORECASE), ["フォーマル", "ビジネス"]),
    (re.compile(r"ナチュラル|natural|自然|organic|やさし|優し", re.IGNORECASE), ["ナチュラル"]),
    (re.compile(r"クール|cool|シャープ|sharp|鋭い", re.IGNORECASE), ["クール"]),
    (re.compile(r"テクノ|tech|digital|デジタル|未来|futur", re.IGNORECASE), ["テクノ"]),
    (re.compile(r"読みやすい|legible|readable|視認|ユニバーサル|UD", re.IGNORECASE), ["読みやすい"]),
    (re.compile(r"細[字い]|thin|light|細め|ライト", re.IGNORECASE), ["細字"]),
    (re.compile(r"太字|bold|heavy|太め|ヘビー|ブラック|black", re.IGNORECASE), ["太字"]),
    (re.compile(r"ニュース|news|速報|テロップ|telop", re.IGNORECASE), ["ニュース"]),
    (re.compile(r"デザイン|design|装飾|decorat|アート|art", re.IGNORECASE), ["デザイン"]),
]

# Additional tags from fontfree categories
CATEGORY_EXTRA_TAGS: dict[str, list[str]] = {
    "kawaii": ["かわいい", "ポップ"],
    "pop": ["ポップ", "カジュアル"],
    "marugo": ["かわいい"],
    "round": ["かわいい"],
    "fude": ["力強い"],
    "brush": ["力強い"],
    "tegaki": ["手書き風", "カジュアル"],
    "handwriting": ["手書き風"],
    "horror": ["クール", "デザイン"],
    "pixel": ["レトロ", "テクノ"],
    "dot": ["レトロ", "テクノ"],
}

# ---------------------------------------------------------------------------
# Logic
# ---------------------------------------------------------------------------


def infer_category(font: dict[str, Any]) -> str:
    """Infer FontCategory from fontfree categories and font name."""
    # 1. Try fontfree.me categories first
    for cat in (font.get("categories") or []):
        cat_lower = cat.lower().strip()
        if cat_lower in FONTFREE_CATEGORY_MAP:
            return FONTFREE_CATEGORY_MAP[cat_lower]

    # 2. Try name-based heuristics
    name = font.get("name", "")
    desc = font.get("description", "")
    combined = f"{name} {desc}"
    for pattern, category in NAME_CATEGORY_RULES:
        if pattern.search(combined):
            return category

    # 3. Default to display for unknown Japanese fonts
    return "display"


def extract_tags(font: dict[str, Any]) -> list[str]:
    """Extract mood/style tags from description and categories."""
    tags: set[str] = set()
    desc = font.get("description", "") or ""
    name = font.get("name", "") or ""
    combined = f"{name} {desc}"

    # From TAG_RULES
    for pattern, tag_list in TAG_RULES:
        if pattern.search(combined):
            tags.update(tag_list)

    # From fontfree categories
    for cat in (font.get("categories") or []):
        cat_lower = cat.lower().strip()
        if cat_lower in CATEGORY_EXTRA_TAGS:
            tags.update(CATEGORY_EXTRA_TAGS[cat_lower])

    # Ensure at least one tag — derive from category
    if not tags:
        category = infer_category(font)
        fallback_tags: dict[str, list[str]] = {
            "sans": ["読みやすい", "モダン"],
            "serif": ["エレガント", "フォーマル"],
            "display": ["デザイン", "インパクト"],
            "handwriting": ["手書き風", "カジュアル"],
            "monospace": ["テクノ", "モダン"],
        }
        tags.update(fallback_tags.get(category, ["デザイン"]))

    return sorted(tags)


def compute_popularity(font: dict[str, Any]) -> int:
    """Compute popularity score (1-10) based on source_count."""
    sc = font.get("source_count", 1)
    if sc >= 3:
        return 7
    elif sc >= 2:
        return 5
    else:
        return 3


def enrich_font(font: dict[str, Any]) -> dict[str, Any] | None:
    """Enrich a single font entry. Returns None if not downloaded."""
    if not font.get("downloaded", False):
        return None

    local_file = font.get("local_file")
    if not local_file:
        return None

    name = font.get("name", "").strip()
    if not name:
        return None

    category = infer_category(font)
    tags = extract_tags(font)
    popularity = compute_popularity(font)

    return {
        "name": name,
        "fontFamily": name,
        "localFile": local_file,
        "category": category,
        "tags": tags,
        "weight": [400, 400],
        "popularity": popularity,
        "description": font.get("description", "") or "",
        "sourceCount": font.get("source_count", 1),
    }


def main() -> None:
    if not CATALOG_V2.exists():
        print(f"ERROR: {CATALOG_V2} not found", file=sys.stderr)
        sys.exit(1)

    with open(CATALOG_V2, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    fonts_raw = catalog.get("fonts", [])
    enriched: list[dict[str, Any]] = []
    skipped = 0

    for font in fonts_raw:
        result = enrich_font(font)
        if result is not None:
            enriched.append(result)
        else:
            skipped += 1

    # Sort by popularity desc, then name
    enriched.sort(key=lambda f: (-f["popularity"], f["name"]))

    # Stats
    cat_counts: dict[str, int] = {}
    tag_counts: dict[str, int] = {}
    for e in enriched:
        cat = e["category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        for t in e["tags"]:
            tag_counts[t] = tag_counts.get(t, 0) + 1

    output = {
        "$schema": "font-catalog-enriched",
        "version": "1.0.0",
        "generated": "2026-02-26",
        "stats": {
            "total": len(enriched),
            "skipped": skipped,
            "categories": cat_counts,
            "topTags": dict(sorted(tag_counts.items(), key=lambda x: -x[1])[:15]),
        },
        "fonts": enriched,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Enriched {len(enriched)} fonts -> {OUTPUT_PATH}")
    print(f"  Skipped: {skipped}")
    print(f"  Categories: {cat_counts}")
    print(f"  Top tags: {dict(sorted(tag_counts.items(), key=lambda x: -x[1])[:10])}")


if __name__ == "__main__":
    main()
