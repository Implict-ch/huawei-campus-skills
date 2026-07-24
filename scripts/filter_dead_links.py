#!/usr/bin/env python3
"""Remove experience files whose Nowcoder source URLs are dead/empty."""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "knowledge" / "experiences"
DISCUSS_RE = re.compile(r"nowcoder\.com/discuss/(\d+)")
SLEEP_SEC = 0.25


def api_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://gw-c.nowcoder.com{path}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def is_alive(discuss_id: str) -> bool:
    paths = []
    if len(discuss_id) >= 15:
        paths.append(f"/api/sparta/detail/content-data/detail/{discuss_id}")
    paths.append(f"/api/sparta/detail/moment-data/detail/{discuss_id}")

    for path in paths:
        try:
            payload = api_get(path)
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, TimeoutError):
            continue
        if not payload.get("success"):
            continue
        data = payload.get("data") or {}
        title = (data.get("title") or data.get("newTitle") or "").strip()
        content = (data.get("content") or data.get("newContent") or "").strip()
        if title or len(content) >= 20:
            return True
    return False


def extract_discuss_id(text: str) -> str | None:
    m = DISCUSS_RE.search(text)
    return m.group(1) if m else None


def main() -> int:
    dry = "--dry-run" in sys.argv
    removed: list[str] = []
    kept = 0
    skipped = 0

    files = sorted(ROOT.glob("hw-exp-*.md"))
    for i, path in enumerate(files, 1):
        text = path.read_text(encoding="utf-8", errors="replace")
        discuss_id = extract_discuss_id(text)
        if not discuss_id:
            skipped += 1
            kept += 1
            continue

        alive = is_alive(discuss_id)
        if alive:
            kept += 1
        else:
            removed.append(path.name)
            if not dry:
                path.unlink()

        if i % 20 == 0:
            print(f"[check] {i}/{len(files)} kept={kept} removed={len(removed)}", flush=True)
        time.sleep(SLEEP_SEC)

    print(f"done kept={kept} removed={len(removed)} skipped_no_url={skipped} dry_run={dry}")
    if removed[:15]:
        print("removed sample:")
        for name in removed[:15]:
            print(f"  - {name}")
        if len(removed) > 15:
            print(f"  ... and {len(removed) - 15} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
