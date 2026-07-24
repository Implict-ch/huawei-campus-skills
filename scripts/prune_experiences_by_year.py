#!/usr/bin/env python3
"""Remove experience files older than a cutoff year (by published_at or filename date)."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"

PUBLISHED_RE = re.compile(r"published_at:\s*(\d{4})")
NAME_RE = re.compile(r"hw-exp-(\d{4})\d{4}-(nc|xhs)-")


def file_year(path: Path) -> int | None:
    text = path.read_text(encoding="utf-8", errors="replace")[:600]
    m = PUBLISHED_RE.search(text)
    if m:
        return int(m.group(1))
    nm = NAME_RE.search(path.name)
    if nm:
        return int(nm.group(1))
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-year", type=int, default=2020, help="Keep files from this year onward")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    to_remove: list[Path] = []
    kept = skipped = 0

    for path in sorted(EXP_DIR.rglob("hw-exp-*.md")):
        if "-cf-" in path.name or path.parent.name == "platform":
            skipped += 1
            continue
        year = file_year(path)
        if year is None:
            skipped += 1
            continue
        if year < args.min_year:
            to_remove.append(path)
        else:
            kept += 1

    print(f"remove={len(to_remove)} keep={kept} skipped={skipped} (min_year={args.min_year})")
    for path in to_remove[:20]:
        print(f"  - {path.name}")
    if len(to_remove) > 20:
        print(f"  ... and {len(to_remove) - 20} more")

    if not args.apply:
        print("\nDry-run. Re-run with --apply to delete.")
        return 0

    for path in to_remove:
        path.unlink()
    print(f"Deleted {len(to_remove)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
