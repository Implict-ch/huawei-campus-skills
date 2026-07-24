#!/usr/bin/env python3
"""Keep campus-recruitment experiences only; drop OD and non-campus posts."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "knowledge" / "experiences"

OD_PATTERN = re.compile(
    r"\bOD\b|#OD#|#od#|华为\s*OD|OD\s*机考|OD\s*面|OD\s*笔|OD\s*岗|OD\s*转|外包|od面经|od机考",
    re.I,
)
CAMPUS_PATTERN = re.compile(
    r"校招|秋招|春招|暑期实习|寒假实习|留学生|"
    r"(?:2[0-9]|27|26|25|24)届|202[4567]届|"
    r"华为.*(?:校招|秋招|春招|实习)|(?:校招|秋招|春招|实习).*华为|"
    r"华子.*(?:校招|秋招|春招|实习)|"
    r"校园招聘|应届生|graduate\s*recruit",
    re.I,
)
# 社招 / 经验社招 — not campus
SOCIAL_PATTERN = re.compile(r"社招|经验社招|工作\d+年|跳槽|在职", re.I)


def parse_file(text: str) -> tuple[str, str, str]:
    title = ""
    tags_blob = ""
    body = text
    if text.startswith("---"):
        parts = text.split("---", 2)
        fm = parts[1] if len(parts) > 1 else ""
        body = parts[2] if len(parts) > 2 else text
        m = re.search(r'^title:\s*"(.+)"', fm, re.M)
        if m:
            title = m.group(1)
        tags_blob = fm
    m = re.search(r"^# (.+)$", body, re.M)
    if m:
        title = title or m.group(1).strip()
    return title, tags_blob, body


def is_od(path: Path, title: str, tags_blob: str, body: str) -> bool:
    if "-od-" in path.stem.lower():
        return True
    blob = f"{path.name}\n{title}\n{tags_blob}\n{body[:1200]}"
    return bool(OD_PATTERN.search(blob))


def is_campus(title: str, tags_blob: str, body: str) -> bool:
    blob = f"{title}\n{tags_blob}\n{body[:1500]}"
    if CAMPUS_PATTERN.search(blob):
        return True
    # 暑期/日常实习 + 华为，且非 OD
    if re.search(r"实习", blob) and re.search(r"华为|华子", blob):
        return True
    return False


def should_keep(path: Path, title: str, tags_blob: str, body: str) -> bool:
    if is_od(path, title, tags_blob, body):
        return False
    if SOCIAL_PATTERN.search(f"{title}\n{body[:800]}"):
        return False
    return is_campus(title, tags_blob, body)


def main() -> int:
    dry = "--dry-run" in sys.argv
    removed: list[str] = []
    kept = 0

    for path in sorted(ROOT.glob("hw-exp-*.md")):
        if path.name == "README.md":
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        title, tags_blob, body = parse_file(text)
        if should_keep(path, title, tags_blob, body):
            kept += 1
            continue
        removed.append(path.name)
        if not dry:
            path.unlink()

    print(f"kept={kept} removed={len(removed)} dry_run={dry}")
    od_removed = sum(1 for n in removed if "-od-" in n.lower() or "od" in n.lower())
    print(f"removed_with_od_in_name≈{od_removed}")
    if removed[:20]:
        print("removed sample:")
        for name in removed[:20]:
            print(f"  - {name}")
        if len(removed) > 20:
            print(f"  ... and {len(removed) - 20} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
