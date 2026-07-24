#!/usr/bin/env python3
"""Add published_at to experience files that lack it."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "knowledge" / "experiences"
PUBLISHED_RE = re.compile(r"published_at:\s*(\d{4}-\d{2}-\d{2})")
NOTE_ID_RE = re.compile(r"note_id:\s*[\"']?([0-9a-f]{24})", re.I)
DISCUSS_RE = re.compile(r"nowcoder\.com/discuss/(\d+)")


def main() -> None:
    patched = 0
    for path in ROOT.rglob("hw-exp-*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        if PUBLISHED_RE.search(text):
            continue
        pub = None
        m = NOTE_ID_RE.search(text)
        if m:
            ts = int(m.group(1)[:8], 16)
            if 1_000_000_000 <= ts <= 4_000_000_000:
                pub = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        if not pub:
            continue
        text = re.sub(r"\n---\n$", f"\npublished_at: {pub}\n---\n", text, count=1)
        path.write_text(text, encoding="utf-8")
        patched += 1
        print(f"patched {path.name} -> {pub}")
    print(f"done: {patched}")


if __name__ == "__main__":
    main()
