#!/usr/bin/env python3
"""Remove low-relevance nowcoder bulk imports."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "knowledge" / "experiences"

TITLE_HW = re.compile(r"华为|华子|\bOD\b|鸿蒙", re.I)
BODY_HW = re.compile(r"华为|华子|\bOD\b|鸿蒙", re.I)
EXP_SIGNAL = re.compile(r"机考|面经|笔试|面试|手撕|测评|秋招|校招|实习|offer|一面|二面|三面", re.I)
GENERIC = re.compile(r"从0到1|找实习|求职季|秋招总结|实习总结|内推码汇总|面经汇总", re.I)


def is_relevant(title: str, body: str) -> bool:
    title = title or ""
    body = body or ""
    if TITLE_HW.search(title):
        return True
    if TITLE_HW.search(title) is None and GENERIC.search(title) and not BODY_HW.search(body[:800]):
        return False
    if BODY_HW.search(body[:2500]) and EXP_SIGNAL.search(f"{title}\n{body[:2500]}"):
        return True
    return False


def main() -> None:
    removed = kept = 0
    for path in ROOT.glob("hw-exp-*-nc-*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        m_title = re.search(r"^# (.+)$", text, re.M)
        title = m_title.group(1).strip() if m_title else ""
        body = text.split("---", 2)[-1] if text.startswith("---") else text
        if is_relevant(title, body):
            kept += 1
        else:
            path.unlink()
            removed += 1
    print(f"kept={kept} removed={removed}")


if __name__ == "__main__":
    main()
