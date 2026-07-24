#!/usr/bin/env python3
"""
Rename experience files so id date segment matches post publish date (not ingest date).

Resolves dates from:
  - Nowcoder detail API: createTime / showTime / createdAt
  - Xiaohongshu note_id (ObjectId timestamp)
  - frontmatter published_at
  - body date hints (fallback)

Usage:
  python scripts/rename_experience_ids.py           # dry-run
  python scripts/rename_experience_ids.py --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"

DISCUSS_RE = re.compile(r"nowcoder\.com/discuss/(\d+)")
NOTE_ID_RE = re.compile(r'note_id:\s*["\']?([0-9a-f]{24})', re.I)
PUBLISHED_RE = re.compile(r"published_at:\s*(\d{4}-\d{2}-\d{2})")
ID_RE = re.compile(r"^id:\s*(\S+)", re.M)
SUFFIX_RE = re.compile(r"hw-exp-\d{8}-(nc|xhs|cf)-(.+)\.md$")

SLEEP_SEC = 0.2
_nc_cache: dict[str, str | None] = {}


def api_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://gw-c.nowcoder.com{path}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def ts_to_date(ms: int | None) -> str | None:
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
    except (OSError, OverflowError, ValueError):
        return None


def note_id_to_date(note_id: str) -> str | None:
    if not re.fullmatch(r"[0-9a-f]{24}", note_id, re.I):
        return None
    ts = int(note_id[:8], 16)
    if ts < 1_000_000_000 or ts > 4_000_000_000:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def fetch_nowcoder_publish_date(discuss_id: str) -> str | None:
    if discuss_id in _nc_cache:
        return _nc_cache[discuss_id]

    paths: list[str] = []
    if len(discuss_id) >= 15:
        paths.append(f"/api/sparta/detail/content-data/detail/{discuss_id}")
    paths.append(f"/api/sparta/detail/moment-data/detail/{discuss_id}")

    for path in paths:
        try:
            data = (api_get(path).get("data") or {})
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, TimeoutError):
            continue
        for key in ("createTime", "showTime", "createdAt", "editTime"):
            d = ts_to_date(data.get(key))
            if d:
                _nc_cache[discuss_id] = d
                time.sleep(SLEEP_SEC)
                return d

    _nc_cache[discuss_id] = None
    time.sleep(SLEEP_SEC)
    return None


def parse_frontmatter(text: str) -> tuple[str, str]:
    m = re.match(r"(?s)(---\n.*?\n---\n)(.*)", text)
    if not m:
        return "", text
    return m.group(1), m.group(2)


def body_date_hints(body: str) -> list[str]:
    dates: list[str] = []
    for y, mo, d in re.findall(r"(20[12]\d)[\.年/-](\d{1,2})[\.月/-](\d{1,2})", body[:2000]):
        dates.append(f"{y}-{int(mo):02d}-{int(d):02d}")
    for y, mo, d in re.findall(r"(20[12]\d)-(\d{2})-(\d{2})", body[:2000]):
        dates.append(f"{y}-{mo}-{d}")
    return dates


def discuss_id_to_date(discuss_id: str) -> str:
    """Rough ordering date from snowflake-like id (last resort)."""
    base = datetime(2016, 1, 1, tzinfo=timezone.utc)
    dt = base + __import__("datetime").timedelta(seconds=min(int(discuss_id) // 1000, 400_000_000))
    return dt.strftime("%Y-%m-%d")


def resolve_suffix(path: Path, front: str) -> tuple[str, str] | None:
    m = SUFFIX_RE.match(path.name)
    if m:
        return m.group(1), m.group(2)
    old_id = ID_RE.search(front)
    if not old_id:
        return None
    parts = old_id.group(1).split("-")
    if len(parts) >= 4 and parts[2] in ("nc", "xhs", "cf"):
        return parts[2], "-".join(parts[3:])
    return None


def resolve_publish_date(path: Path, front: str, body: str) -> str | None:
    m = PUBLISHED_RE.search(front)
    if m:
        return m.group(1)

    suffix = resolve_suffix(path, front)
    if not suffix:
        return None
    platform, _ = suffix

    if platform == "nc":
        dm = DISCUSS_RE.search(front + body)
        if dm:
            d = fetch_nowcoder_publish_date(dm.group(1))
            if d:
                return d
            return discuss_id_to_date(dm.group(1))

    if platform == "xhs":
        nm = NOTE_ID_RE.search(front)
        if nm:
            d = note_id_to_date(nm.group(1))
            if d:
                return d
        for url_m in re.finditer(
            r"xiaohongshu\.com/(?:search_result|explore|discovery/item|note)/([0-9a-f]{24})",
            front + body,
            re.I,
        ):
            d = note_id_to_date(url_m.group(1))
            if d:
                return d

    hints = body_date_hints(body)
    if hints:
        return max(hints)

    return None


def build_new_id(platform: str, tail: str, publish_date: str) -> str:
    slug = publish_date.replace("-", "")
    return f"hw-exp-{slug}-{platform}-{tail}"


def update_frontmatter(front: str, new_id: str, publish_date: str) -> str:
    if ID_RE.search(front):
        front = ID_RE.sub(f"id: {new_id}", front, count=1)
    else:
        front = front.replace("---\n", f"---\nid: {new_id}\n", 1)

    if PUBLISHED_RE.search(front):
        front = PUBLISHED_RE.sub(f"published_at: {publish_date}", front, count=1)
    else:
        front = re.sub(r"\n---\n$", f"\npublished_at: {publish_date}\n---\n", front, count=1)
    return front


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    plans: list[tuple[Path, Path, str, str]] = []
    skipped = unchanged = no_date = 0

    for path in sorted(EXP_DIR.rglob("hw-exp-*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        front, body = parse_frontmatter(text)
        suffix = resolve_suffix(path, front)
        if not suffix:
            skipped += 1
            continue
        platform, tail = suffix

        # CodeFun2000 platform cards use pid-based ids without calendar date.
        if platform == "cf":
            skipped += 1
            continue

        publish_date = resolve_publish_date(path, front, body)
        if not publish_date:
            no_date += 1
            print(f"[no-date] {path.name}", file=sys.stderr)
            continue

        new_id = build_new_id(platform, tail, publish_date)
        new_path = path.with_name(f"{new_id}.md")

        if path.name == new_path.name:
            unchanged += 1
            continue

        plans.append((path, new_path, new_id, publish_date))

    targets: dict[Path, Path] = {}
    for old, new, _, _ in plans:
        if new in targets and targets[new] != old:
            print(f"[collision] {new.name} <= {old.name} and {targets[new].name}", file=sys.stderr)
            return 1
        targets[new] = old

    print(f"rename={len(plans)} unchanged={unchanged} skipped={skipped} no_date={no_date}")
    for old, new, new_id, pub in plans[:15]:
        print(f"  {old.name} -> {new.name}  ({pub})")
    if len(plans) > 15:
        print(f"  ... and {len(plans) - 15} more")

    if not args.apply:
        print("\nDry-run only. Re-run with --apply to rename files.")
        return 0

    done = 0
    for old, new, new_id, pub in plans:
        text = old.read_text(encoding="utf-8", errors="replace")
        front, body = parse_frontmatter(text)
        new_front = update_frontmatter(front, new_id, pub)
        new.write_text(new_front + body, encoding="utf-8")
        if new != old:
            old.unlink()
        done += 1
        if done % 50 == 0:
            print(f"  ... {done}/{len(plans)}")

    print(f"Applied {done} renames.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
