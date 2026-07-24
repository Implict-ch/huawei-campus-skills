#!/usr/bin/env python3
"""
Ingest Xiaohongshu notes via opencli (requires Chrome + OpenCLI extension + login).

Usage:
  opencli doctor   # extension must be connected
  opencli xiaohongshu login          # creator 后台登录
  # 还需在 Chrome 打开 https://www.xiaohongshu.com 完成主站登录（搜索页需要）
  python scripts/ingest_xiaohongshu.py
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "knowledge" / "experiences"

SEARCH_QUERIES = [
    "华为 校招 面经 2026",
    "华为 校招 面经 2025",
    "华为 校招 面经 2024",
    "华为 机考 2025 秋招",
    "华为 暑期实习 面经 2025",
    "华子 校招 笔试 2024",
    "华为 面试 手撕 2025",
    "华为 AI 岗 机考 2026",
    "华为 26届 校招",
    "华为 校招 面经",
    "华为 机考 秋招",
    "华为 暑期实习 面经",
    "华子 校招 笔试",
    "华为 面试 手撕 校招",
]

MIN_YEAR = 2023
SEARCH_LIMIT = 50

NOTE_ID_RE = re.compile(
    r"xiaohongshu\.com/(?:search_result|explore|discovery/item|note)/([0-9a-f]{24})",
    re.I,
)
OD_PATTERN = re.compile(
    r"\bOD\b|#OD#|#od#|华为\s*OD|OD\s*机考|OD\s*面|OD\s*笔|OD\s*岗|外包",
    re.I,
)
SOCIAL_PATTERN = re.compile(r"社招|经验社招|工作\d+年|跳槽|在职", re.I)

def extract_note_id(row: dict) -> str:
    for key in ("noteId", "id"):
        val = str(row.get(key) or "").strip()
        if val:
            return val
    url = row.get("url") or row.get("noteUrl") or ""
    m = NOTE_ID_RE.search(url)
    return m.group(1) if m else ""


def rows_to_dict(payload: dict | list) -> dict:
    if isinstance(payload, dict):
        return payload
    if not isinstance(payload, list):
        return {}
    out: dict[str, str] = {}
    for row in payload:
        if isinstance(row, dict) and row.get("field"):
            out[str(row["field"])] = str(row.get("value") or "")
        elif isinstance(row, dict):
            out.update({k: str(v) for k, v in row.items() if v is not None})
    return out


def is_campus_relevant(title: str, content: str = "") -> bool:
    blob = f"{title}\n{content}"
    if OD_PATTERN.search(blob) or SOCIAL_PATTERN.search(blob):
        return False
    return True


def resolve_opencli_entry() -> list[str]:
    main_js = (
        Path.home()
        / ".npm-global"
        / "node_modules"
        / "@jackwener"
        / "opencli"
        / "dist"
        / "src"
        / "main.js"
    )
    if main_js.is_file():
        return ["node", str(main_js)]
    for name in ("opencli", "opencli.cmd"):
        path = shutil.which(name)
        if path:
            return [path]
    raise RuntimeError("opencli not found in PATH; run `npm i -g @jackwener/opencli` first")


def run_opencli(args: list[str]) -> dict | list:
    cmd = [*resolve_opencli_entry(), *args, "-f", "json"]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or f"opencli failed: {args}")
    return json.loads(proc.stdout)


def existing_xhs_ids() -> set[str]:
    ids: set[str] = set()
    for path in OUT_DIR.glob("hw-exp-*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(
            r"xiaohongshu\.com/(?:search_result|explore|discovery/item|note)/([0-9a-f]{24})",
            text,
            re.I,
        ):
            ids.add(m.group(1))
        if "platform: xiaohongshu" in text:
            m = re.search(r"note_id:\s*\"?([a-f0-9]+)", text)
            if m:
                ids.add(m.group(1))
    return ids


def infer_stage(title: str, content: str) -> str:
    blob = f"{title}\n{content}"
    if re.search(r"机考|笔试|编程|手撕", blob):
        return "exam"
    if re.search(r"面试|一面|二面", blob):
        return "interview"
    return "general"


def note_publish_date(note_id: str) -> str | None:
    if not re.fullmatch(r"[0-9a-f]{24}", note_id, re.I):
        return None
    ts = int(note_id[:8], 16)
    if ts < 1_000_000_000 or ts > 4_000_000_000:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def write_note(note: dict, detail: dict) -> Path:
    note_id = note["noteId"]
    title = (detail.get("title") or note.get("title") or f"小红书笔记 {note_id}").strip()
    content = (detail.get("content") or detail.get("desc") or note.get("desc") or "").strip()
    url = note.get("url") or f"https://www.xiaohongshu.com/explore/{note_id}"
    ts = int(note_id[:8], 16) if re.fullmatch(r"[0-9a-f]{24}", note_id, re.I) else None
    if ts and 1_000_000_000 <= ts <= 4_000_000_000:
        date = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
    else:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    eid = f"hw-exp-{date.replace('-', '')}-xhs-{note_id[-8:]}"
    path = OUT_DIR / f"{eid}.md"

    body = f"""---
id: {eid}
kind: experience
source_grade: C
stage: {infer_stage(title, content)}
sources:
  - platform: xiaohongshu
    title: "{title.replace('"', "'")}"
    url: "{url}"
published_at: {date}
note_id: "{note_id}"
tags: ["小红书", "华为"]
---

# {title}

- 来源：[{title}]({url})

{content or "（正文见来源链接）"}
"""
    path.write_text(body, encoding="utf-8")
    return path


def refetch_placeholder_content() -> int:
    updated = 0
    for path in OUT_DIR.glob("hw-exp-*-xhs-*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        if "（正文见来源链接）" not in text:
            continue
        m = re.search(r'url: "(https://[^"]+)"', text)
        if not m:
            continue
        url = m.group(1)
        try:
            detail = rows_to_dict(run_opencli(["xiaohongshu", "note", url]))
        except RuntimeError as exc:
            print(f"[warn] refetch {path.name}: {exc}", file=sys.stderr)
            continue
        content = (detail.get("content") or detail.get("desc") or "").strip()
        if not content:
            continue
        title_m = re.search(r"^# (.+)$", text, re.M)
        title = (detail.get("title") or (title_m.group(1) if title_m else "")).strip()
        marker = "- 来源："
        idx = text.find(marker)
        head_end = text.find("\n\n", idx) if idx >= 0 else -1
        if head_end < 0:
            continue
        new_text = text[: head_end + 2] + content
        if title_m and detail.get("title"):
            new_text = re.sub(r"^# .+$", f"# {title}", new_text, count=1, flags=re.M)
        path.write_text(new_text, encoding="utf-8")
        updated += 1
        print(f"[refetch] {path.name}")
    print(f"Refetched content for {updated} xiaohongshu files")
    return updated


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--refetch-only":
        refetch_placeholder_content()
        return 0
    seen = existing_xhs_ids()
    collected: dict[str, dict] = {}

    for query in SEARCH_QUERIES:
        try:
            rows = run_opencli(["xiaohongshu", "search", query, "--limit", str(SEARCH_LIMIT)])
        except RuntimeError as exc:
            print(f"[warn] search {query!r}: {exc}", file=sys.stderr)
            continue
        if not isinstance(rows, list):
            rows = rows.get("results") or rows.get("data") or []
        for row in rows:
            title = row.get("title") or row.get("desc") or ""
            note_id = extract_note_id(row)
            if not note_id or note_id in seen:
                continue
            if not is_campus_relevant(title):
                continue
            collected[note_id] = row
        print(f"[search] {query!r} -> cumulative {len(collected)}")

    if not collected:
        print(
            "No xiaohongshu notes collected. Ensure:\n"
            "  1. opencli doctor shows extension connected\n"
            "  2. opencli xiaohongshu login completed (creator)\n"
            "  3. Log in at https://www.xiaohongshu.com in the same Chrome profile\n"
            "Then re-run this script.",
            file=sys.stderr,
        )
        return 1

    written = 0
    skipped = 0
    skipped_old = 0
    for note_id, note in collected.items():
        pub = note_publish_date(note_id)
        if pub and int(pub[:4]) < MIN_YEAR:
            skipped_old += 1
            continue
        url = note.get("url") or note.get("noteUrl") or f"https://www.xiaohongshu.com/explore/{note_id}"
        try:
            detail = rows_to_dict(run_opencli(["xiaohongshu", "note", url]))
        except RuntimeError as exc:
            print(f"[warn] note {note_id}: {exc}", file=sys.stderr)
            detail = rows_to_dict(note)
        title = detail.get("title") or note.get("title") or ""
        content = detail.get("content") or detail.get("desc") or note.get("desc") or ""
        if not is_campus_relevant(title, content):
            skipped += 1
            continue
        write_note({**note, "noteId": note_id, "url": url}, detail)
        written += 1

    print(f"Wrote {written} xiaohongshu experience files (skipped {skipped} non-campus/OD, {skipped_old} pre-{MIN_YEAR})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
