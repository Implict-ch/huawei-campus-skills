#!/usr/bin/env python3
"""Filter out non-Huawei experience posts from knowledge/experiences/.

Strategy:
- Keep all CodeFun2000 (hwmj) posts regardless of title/body keywords.
- For nowcoder/xiaohongshu posts, keep only those whose full text (frontmatter + body)
  contains at least one Huawei-related keyword.
- Non-matching posts are moved to knowledge/experiences/_other/non-huawei/ for review.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"
OTHER_DIR = EXP_DIR / "_other" / "non-huawei"

HUAWEI_KEYWORDS = ["华为", "华子", "huawei", "HUAWEI", "Huawei"]

TITLE_RE = re.compile(r"^#\s+(.+)", re.MULTILINE)
TAGS_RE = re.compile(r"tags:\s*\[(.*?)\]", re.DOTALL)


def is_huawei_related(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")

    # CodeFun2000 hwmj section is Huawei-specific
    if "platform: codefun2000" in text:
        return True

    # Strict filter: only posts whose title or tags explicitly mention Huawei.
    # General "秋招记录" posts that only mention Huawei once in passing are excluded.
    title = ""
    tags_text = ""
    if text.startswith("---"):
        end = text.find("---", 3)
        if end >= 0:
            body = text[end + 3 :]
            m = TITLE_RE.search(body)
            if m:
                title = m.group(1).strip()
            tags_m = TAGS_RE.search(text[:end])
            if tags_m:
                tags_text = tags_m.group(1)

    return any(k in title or k in tags_text for k in HUAWEI_KEYWORDS)


def main() -> int:
    OTHER_DIR.mkdir(parents=True, exist_ok=True)
    moved = 0
    kept = 0
    for path in list(EXP_DIR.rglob("hw-exp-*.md")):
        if OTHER_DIR in path.parents:
            continue
        if is_huawei_related(path):
            kept += 1
        else:
            dest = OTHER_DIR / path.name
            if dest.exists():
                dest.unlink()
            shutil.move(str(path), str(dest))
            moved += 1

    print(f"kept: {kept}")
    print(f"moved to {OTHER_DIR.relative_to(ROOT)}: {moved}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
