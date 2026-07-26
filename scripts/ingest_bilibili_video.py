#!/usr/bin/env python3
"""
Ingest Bilibili video subtitles into knowledge/videos/ as timestamped segments.

Requires: Chrome + OpenCLI extension + bilibili login (for subtitle API).

Usage:
  opencli doctor
  opencli bilibili login
  python scripts/ingest_bilibili_video.py --series campus-202607
  python scripts/ingest_bilibili_video.py --bvid BV1aHTX6WEZs
  python scripts/ingest_bilibili_video.py --url "https://www.bilibili.com/video/BV1aHTX6WEZs"
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
VIDEOS_DIR = ROOT / "knowledge" / "videos"
SEGMENTS_DIR = VIDEOS_DIR / "segments"
SERIES_DIR = VIDEOS_DIR / "series"
EPISODES_DIR = VIDEOS_DIR / "episodes"

BV_RE = re.compile(r"(BV[A-Za-z0-9]+)", re.I)
TIME_RE = re.compile(r"^([\d.]+)s$")

# 塔子哥 2026-07 华为校招公开课合集（按发布时间排序）
CAMPUS_SERIES_202607 = {
    "id": "hw-video-series-campus-202607",
    "title": "华为校招技术岗求职公开课",
    "seed_bvid": "BV1aHTX6WEZs",
    "seed_url": "https://www.bilibili.com/video/BV1aHTX6WEZs",
    "up_mid": "1167140350",
    "episodes": [
        {"order": 1, "bvid": "BV1aHTX6WEZs"},
        {"order": 2, "bvid": "BV1KAMJ6HEzz"},
        {"order": 3, "bvid": "BV1zJNG61EW8"},  # 机考① 扫盲
        {"order": 4, "bvid": "BV19JNb6SELo"},  # 机考② AI
        {"order": 5, "bvid": "BV1iMNi63ExP"},  # 机考③ 非AI
        {"order": 6, "bvid": "BV1RDKJ6aEEF"},  # 机考④ 提分技巧
        {"order": 7, "bvid": "BV1CsK46aE3r"},  # 机考⑤
    ],
}

MAX_GAP_SEC = 2.5
MAX_CHUNK_SEC = 120.0
MIN_CHUNK_SEC = 8.0


def resolve_opencli_entry() -> List[str]:
    repo_main = Path(__file__).resolve().parents[2] / "dist" / "src" / "main.js"
    if repo_main.is_file():
        return ["node", str(repo_main)]
    for name in ("opencli", "opencli.cmd"):
        path = shutil.which(name)
        if path:
            return [path]
    raise RuntimeError("opencli not found; run `npm i -g @jackwener/opencli` first")


def sanitize_json_text(text: str) -> str:
    # opencli subtitle JSON may contain raw newlines inside strings
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", text)


def rows_to_dict(payload: Any) -> Dict[str, str]:
    if isinstance(payload, dict):
        return {str(k): str(v) for k, v in payload.items()}
    if not isinstance(payload, list):
        return {}
    out: Dict[str, str] = {}
    for row in payload:
        if isinstance(row, dict) and row.get("field"):
            out[str(row["field"])] = str(row.get("value") or "")
    return out


def run_opencli(args: List[str]) -> Any:
    cmd = [*resolve_opencli_entry(), *args, "-f", "json"]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or f"opencli failed: {args}")
    return json.loads(sanitize_json_text(proc.stdout))


def parse_bvid(value: str) -> str:
    m = BV_RE.search(value.strip())
    if not m:
        raise ValueError(f"cannot parse BV id from: {value}")
    return m.group(1)


def parse_time_field(value: str) -> float:
    m = TIME_RE.match(str(value).strip())
    if not m:
        raise ValueError(f"bad time field: {value}")
    return float(m.group(1))


def fmt_time(seconds: float) -> str:
    sec = max(0, int(seconds))
    mm, ss = divmod(sec, 60)
    hh, mm = divmod(mm, 60)
    if hh:
        return f"{hh:02d}:{mm:02d}:{ss:02d}"
    return f"{mm:02d}:{ss:02d}"


def video_url(bvid: str, start_sec: float) -> str:
    t = max(0, int(start_sec))
    return f"https://www.bilibili.com/video/{bvid}?t={t}"


def infer_stage(title: str, text: str) -> str:
    blob = f"{title}\n{text}"
    if re.search(r"机考|笔试|编程|手撕|ACM|OJ|样例输出|暴力", blob):
        return "exam"
    if re.search(r"测评|性格|心理", blob):
        return "assessment"
    if re.search(r"面试|一面|二面|主管", blob):
        return "interview"
    if re.search(r"投递|简历|内推|部门|薪资|offer|入职", blob, re.I):
        return "application"
    return "general"


def fetch_video_meta(bvid: str) -> Dict[str, str]:
    return rows_to_dict(run_opencli(["bilibili", "video", bvid]))


def fetch_subtitles(bvid: str, lang: Optional[str] = None) -> List[Dict[str, Any]]:
    """优先中文 AI 字幕（ai-zh），避免默认落到英文轨。"""
    langs = [lang] if lang else ["ai-zh", "zh-CN", "zh-Hans", "zh", None]
    last_err: Optional[Exception] = None
    for lg in langs:
        try:
            args = ["bilibili", "subtitle", bvid]
            if lg:
                args.extend(["--lang", lg])
            payload = run_opencli(args)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            continue
        if not isinstance(payload, list) or not payload:
            continue
        cues: List[Dict[str, Any]] = []
        for row in payload:
            if not isinstance(row, dict):
                continue
            cues.append(
                {
                    "from": parse_time_field(row.get("from", "0s")),
                    "to": parse_time_field(row.get("to", "0s")),
                    "content": str(row.get("content") or "").strip(),
                }
            )
        cues = [c for c in cues if c["content"]]
        if not cues:
            continue
        # 若默认轨几乎全是英文而中文轨可用，跳过英文
        sample = "".join(c["content"] for c in cues[:12])
        has_cjk = bool(re.search(r"[\u4e00-\u9fff]", sample))
        if lg is None and not has_cjk and langs != [None]:
            continue
        return cues
    if last_err:
        raise RuntimeError(f"subtitle fetch failed for {bvid}: {last_err}")
    raise RuntimeError(f"no usable subtitles for {bvid}")


def merge_cues_to_chunks(cues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not cues:
        return []
    chunks: List[Dict[str, Any]] = []
    cur: Optional[Dict[str, Any]] = {
        "from": cues[0]["from"],
        "to": cues[0]["to"],
        "parts": [cues[0]["content"]],
    }
    for cue in cues[1:]:
        if cur is None:
            cur = {"from": cue["from"], "to": cue["to"], "parts": [cue["content"]]}
            continue
        gap = cue["from"] - cur["to"]
        dur = cue["to"] - cur["from"]
        split_long = (cur["to"] - cur["from"]) >= MAX_CHUNK_SEC
        if gap > MAX_GAP_SEC or split_long:
            chunks.append(cur)
            cur = {"from": cue["from"], "to": cue["to"], "parts": [cue["content"]]}
            continue
        cur["to"] = cue["to"]
        cur["parts"].append(cue["content"])
        if dur >= MIN_CHUNK_SEC and cue["content"].rstrip().endswith(("。", "！", "？", ".", "!", "?", "嗯")):
            if (cur["to"] - cur["from"]) >= MIN_CHUNK_SEC:
                chunks.append(cur)
                cur = None
    if cur is not None:
        chunks.append(cur)
    # drop very short noise
    out: List[Dict[str, Any]] = []
    for ch in chunks:
        text = "".join(ch["parts"]).strip()
        if len(text) < 4:
            continue
        out.append({"from": ch["from"], "to": ch["to"], "text": text})
    return out


def slug_bvid(bvid: str) -> str:
    return bvid.lower()


def write_segment(
    *,
    series: Dict[str, Any],
    episode_order: int,
    meta: Dict[str, str],
    seg_index: int,
    chunk: Dict[str, Any],
) -> Path:
    bvid = meta.get("bvid") or ""
    title = meta.get("title") or bvid
    start = chunk["from"]
    end = chunk["to"]
    tr = f"{fmt_time(start)}–{fmt_time(end)}"
    sid = f"hw-vid-{slug_bvid(bvid)}-{seg_index:03d}"
    stage = infer_stage(title, chunk["text"])
    url = video_url(bvid, start)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    safe_title = title.replace('"', "'")
    body = f"""---
id: {sid}
kind: video_segment
series_id: {series["id"]}
series_title: "{series["title"].replace('"', "'")}"
episode: {episode_order}
episode_title: "{safe_title}"
bvid: {bvid}
segment_index: {seg_index}
time_start_sec: {start:.2f}
time_end_sec: {end:.2f}
time_range: "{tr}"
stage: {stage}
source_grade: C
sources:
  - platform: bilibili
    title: "{safe_title}"
    url: "{url}"
    time_range: "{tr}"
updated_at: {today}
---

# [{safe_title}]({url}) · **{tr}**

{chunk["text"]}
"""
    path = SEGMENTS_DIR / f"{sid}.md"
    path.write_text(body, encoding="utf-8")
    return path


def write_episode_index(
    *,
    series: Dict[str, Any],
    episode_order: int,
    meta: Dict[str, str],
    segment_paths: List[Path],
) -> Path:
    bvid = meta.get("bvid") or ""
    title = meta.get("title") or bvid
    duration = meta.get("duration") or ""
    publish = meta.get("publish_time") or ""
    eid = f"hw-vid-{slug_bvid(bvid)}"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = [
        f"- [{sp.stem}](segments/{sp.name})"
        for sp in segment_paths
    ]
    body = f"""---
id: {eid}
kind: video_episode
series_id: {series["id"]}
series_title: "{series["title"].replace('"', "'")}"
episode: {episode_order}
bvid: {bvid}
duration: "{duration}"
publish_time: "{publish}"
source_grade: C
sources:
  - platform: bilibili
    title: "{title.replace('"', "'")}"
    url: "https://www.bilibili.com/video/{bvid}"
updated_at: {today}
---

# {title}

- 合集：[{series["title"]}]({series.get("seed_url", series.get("seed_bvid", ""))})
- 本集：[{title}](https://www.bilibili.com/video/{bvid})
- 分段时间轴（{len(segment_paths)} 段）：

{chr(10).join(lines)}
"""
    path = EPISODES_DIR / f"{eid}.md"
    path.write_text(body, encoding="utf-8")
    return path


def ingest_episode(series: Dict[str, Any], episode_order: int, bvid: str) -> Tuple[int, str]:
    meta = fetch_video_meta(bvid)
    meta["bvid"] = meta.get("bvid") or bvid
    cues = fetch_subtitles(bvid)
    chunks = merge_cues_to_chunks(cues)
    if not chunks:
        raise RuntimeError(f"no subtitle chunks for {bvid}")
    segment_paths: List[Path] = []
    for idx, chunk in enumerate(chunks, start=1):
        segment_paths.append(
            write_segment(
                series=series,
                episode_order=episode_order,
                meta=meta,
                seg_index=idx,
                chunk=chunk,
            )
        )
    write_episode_index(
        series=series,
        episode_order=episode_order,
        meta=meta,
        segment_paths=segment_paths,
    )
    return len(segment_paths), meta.get("title") or bvid


def write_series_manifest(series: Dict[str, Any], episode_meta: List[Dict[str, Any]]) -> Path:
    SERIES_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "id": series["id"],
        "title": series["title"],
        "seed_url": series.get("seed_url"),
        "up_mid": series.get("up_mid"),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "episodes": episode_meta,
    }
    path = SERIES_DIR / f"{series['id']}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def ensure_dirs() -> None:
    for d in (SEGMENTS_DIR, EPISODES_DIR, SERIES_DIR):
        d.mkdir(parents=True, exist_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest Bilibili subtitles into knowledge/videos/")
    parser.add_argument("--series", choices=["campus-202607"], help="Predefined series slug")
    parser.add_argument("--bvid", action="append", default=[], help="Single BV id (repeatable)")
    parser.add_argument("--url", action="append", default=[], help="Video URL containing BV id")
    args = parser.parse_args()

    ensure_dirs()

    if args.series == "campus-202607":
        series = CAMPUS_SERIES_202607
        episode_meta: List[Dict[str, Any]] = []
        for ep in series["episodes"]:
            bvid = ep["bvid"]
            order = ep["order"]
            print(f"[ingest] episode {order}: {bvid}")
            try:
                n, title = ingest_episode(series, order, bvid)
            except RuntimeError as exc:
                print(f"[error] {bvid}: {exc}", file=sys.stderr)
                return 1
            print(f"  -> {n} segments · {title}")
            episode_meta.append(
                {
                    "order": order,
                    "bvid": bvid,
                    "title": title,
                    "segments": n,
                    "url": f"https://www.bilibili.com/video/{bvid}",
                }
            )
        manifest = write_series_manifest(series, episode_meta)
        print(f"[done] series manifest: {manifest.relative_to(ROOT)}")
        return 0

    bvids = [parse_bvid(x) for x in args.bvid]
    bvids.extend(parse_bvid(x) for x in args.url)
    if not bvids:
        parser.print_help()
        return 2

    series = {
        "id": f"hw-video-series-{bvids[0].lower()}",
        "title": f"Bilibili {bvids[0]}",
        "seed_bvid": bvids[0],
        "seed_url": f"https://www.bilibili.com/video/{bvids[0]}",
    }
    episode_meta = []
    for order, bvid in enumerate(bvids, start=1):
        print(f"[ingest] {order}: {bvid}")
        n, title = ingest_episode(series, order, bvid)
        print(f"  -> {n} segments · {title}")
        episode_meta.append(
            {
                "order": order,
                "bvid": bvid,
                "title": title,
                "segments": n,
                "url": f"https://www.bilibili.com/video/{bvid}",
            }
        )
    write_series_manifest(series, episode_meta)
    return 0


if __name__ == "__main__":
    sys.exit(main())
