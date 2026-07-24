#!/usr/bin/env python3
"""Best-effort Xiaohongshu search scrape without opencli (often login-gated)."""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "knowledge" / "experiences"

QUERIES = [
    "华为 校招 面经 2026",
    "华为 校招 面经 2025",
    "华为 机考 2025",
    "华为 秋招 笔试 2024",
    "华子 校招 2025",
    "华为 暑期实习 面经",
    "华为 AI 岗 机考",
]
HW = re.compile(r"华为|华子|Huawei", re.I)
OD = re.compile(r"\bOD\b|外包", re.I)
CAMPUS = re.compile(r"校招|秋招|春招|实习|(2[4-7])届|202[34567]", re.I)
MIN_YEAR = 2023


def note_publish_date(note_id: str) -> str | None:
    if not re.fullmatch(r"[0-9a-f]{24}", note_id, re.I):
        return None
    ts = int(note_id[:8], 16)
    if ts < 1_000_000_000 or ts > 4_000_000_000:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def existing_xhs_ids() -> set[str]:
    ids: set[str] = set()
    for path in OUT_DIR.glob("hw-exp-*-xhs-*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        m = re.search(r'note_id:\s*["\']?([0-9a-f]{24})', text, re.I)
        if m:
            ids.add(m.group(1))
    return ids


def fetch_search(keyword: str) -> list[dict]:
    q = urllib.parse.quote(keyword)
    url = f"https://www.xiaohongshu.com/search_result?keyword={q}&source=web_search_result_notes"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    if "/login" in html[:5000] or "website-login" in html:
        return []
    m = re.search(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*</script>", html, re.DOTALL)
    if not m:
        return []
    state = json.loads(m.group(1))
    notes = (
        state.get("search", {}).get("notes")
        or state.get("search", {}).get("noteList")
        or []
    )
    out = []
    for n in notes:
        card = n.get("noteCard") or n
        note_id = card.get("noteId") or card.get("id") or ""
        title = card.get("displayTitle") or card.get("title") or ""
        if not note_id or not title or not HW.search(title):
            continue
        if OD.search(title) or not CAMPUS.search(title):
            continue
        pub = note_publish_date(note_id)
        if pub and int(pub[:4]) < MIN_YEAR:
            continue
        out.append({"note_id": note_id, "title": title, "xsec_token": card.get("xsecToken") or "", "published_at": pub})
    return out


def write_stub(note: dict) -> bool:
    note_id = note["note_id"]
    pub = note.get("published_at") or note_publish_date(note_id)
    if not pub:
        return False
    slug = pub.replace("-", "")
    eid = f"hw-exp-{slug}-xhs-{note_id[-8:]}"
    path = OUT_DIR / f"{eid}.md"
    if path.exists():
        return False
    token = note.get("xsec_token") or ""
    qs = f"?xsec_token={urllib.parse.quote(token)}&xsec_source=pc_search" if token else ""
    url = f"https://www.xiaohongshu.com/explore/{note_id}{qs}"
    title = note["title"].replace('"', "'")
    path.write_text(
        f"""---
id: {eid}
kind: experience
source_grade: C
stage: exam
sources:
  - platform: xiaohongshu
    title: "{title}"
    url: "{url}"
published_at: {pub}
note_id: "{note_id}"
tags: ["小红书", "华为"]
---

# {note['title']}

- 来源：[{note['title']}]({url})

（正文需登录后查看，见来源链接）
""",
        encoding="utf-8",
    )
    return True


def main() -> int:
    seen = existing_xhs_ids()
    written = skipped = 0
    for q in QUERIES:
        try:
            rows = fetch_search(q)
        except Exception as exc:
            print(f"[warn] {q}: {exc}", file=sys.stderr)
            continue
        print(f"[search] {q!r} -> {len(rows)} notes")
        for note in rows:
            if note["note_id"] in seen:
                skipped += 1
                continue
            seen.add(note["note_id"])
            if write_stub(note):
                written += 1
        time.sleep(1)
    print(f"Wrote {written} xiaohongshu stubs (skipped {skipped} dupes; 0 new means login wall)")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
