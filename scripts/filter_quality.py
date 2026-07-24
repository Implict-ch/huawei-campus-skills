#!/usr/bin/env python3
"""Remove low-quality bulk-imported nowcoder experience posts."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "knowledge" / "experiences"

# Never touch manually curated cards (no -nc- suffix).
BULK_GLOB = "hw-exp-*-nc-*.md"

META_LINE = re.compile(r"^- (作者|来源)：")
SPAM_TITLE = re.compile(
    r"辅导|欢迎联系|欢迎交流|直招|缺人|私聊|内推码|有偿|加[微v]|wx:|接单|代做|题库.*联系",
    re.I,
)
SPAM_BODY = re.compile(
    r"私聊我|欢迎联系|欢迎交流|有偿|加微信|加[微v]信|wx:|接单|代做|面试辅导|包你满意",
    re.I,
)
QUESTION_ONLY = re.compile(
    r"我想问|是不是代表|有没有.*吗|怎么办|怎么弄|是不是.*[？?]$|代表.*过了吗|有没有收到",
    re.I,
)
JSON_BLOB = re.compile(r"^\s*\{'data':")
STRUCTURE = re.compile(
    r"^## |^[0-9]+[、.)]|^[-*] |^\| .+\| |⭐|手撕|算法题|笔试|一面|二面|三面|机考题|题目[：:]|分数[：:]|\d+分",
    re.M,
)


def extract_body(text: str) -> tuple[str, str]:
    if text.startswith("---"):
        parts = text.split("---", 2)
        body = parts[2] if len(parts) >= 3 else text
    else:
        body = text
    m = re.search(r"^# (.+)$", body, re.M)
    title = m.group(1).strip() if m else ""
    lines = []
    for line in body.splitlines():
        s = line.strip()
        if not s or s.startswith("# ") or META_LINE.match(s):
            continue
        lines.append(s)
    content = "\n".join(lines).strip()
    return title, content


def meaningful_chars(content: str) -> int:
    flat = re.sub(r"\s+", "", content)
    flat = re.sub(r"#+\S+", "", flat)
    return len(flat)


def has_structure(content: str) -> bool:
    return bool(STRUCTURE.search(content))


def is_quality(title: str, content: str) -> bool:
    if not content or content in {"（正文需登录后查看，见来源链接）", "（正文见来源链接）"}:
        return False
    if JSON_BLOB.match(content):
        return False
    if SPAM_TITLE.search(title):
        return False
    if SPAM_BODY.search(content):
        return False

    chars = meaningful_chars(content)
    structured = has_structure(content)

    # Short question posts without actionable detail
    if chars < 120 and QUESTION_ONLY.search(content):
        return False

    # One-liner / two-liner with no structure
    if chars < 80 and not structured:
        return False

    # Weak short blurbs
    if chars < 100 and not structured:
        return False

    # Medium length but still just a vague question
    if chars < 180 and QUESTION_ONLY.search(content) and not structured:
        return False

    return True


def main() -> int:
    dry = "--dry-run" in sys.argv
    removed: list[str] = []
    kept = 0

    for path in sorted(ROOT.glob(BULK_GLOB)):
        text = path.read_text(encoding="utf-8", errors="replace")
        title, content = extract_body(text)
        if is_quality(title, content):
            kept += 1
            continue
        removed.append(path.name)
        if not dry:
            path.unlink()

    print(f"kept={kept} removed={len(removed)} dry_run={dry}")
    if removed:
        print("removed sample:")
        for name in removed[:25]:
            print(f"  - {name}")
        if len(removed) > 25:
            print(f"  ... and {len(removed) - 25} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
