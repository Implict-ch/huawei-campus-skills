#!/usr/bin/env python3
"""Bulk ingest Huawei-related interview posts from Nowcoder search API."""
from __future__ import annotations

import html as htmlmod
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "knowledge" / "experiences"

SEARCH_QUERIES = [
    "华为 校招 面经 2026",
    "华为 校招 面经 2025",
    "华为 校招 面经 2024",
    "华为 秋招 笔试 2025",
    "华为 春招 机考 2026",
    "华为 暑期实习 面经 2025",
    "华为 校招 机考 2024",
    "华为 面试 手撕 2025",
    "华为 测评 26届",
    "华子 校招 2025",
    "华为 ICT 校招 面经",
    "华为 软件开发 校招 2024",
    "华为 AI 岗 机考",
    "华为 留学生 校招",
    "华为 校招 面经",
    "华为 秋招 笔试",
    "华为 春招 机考",
    "华为 暑期实习 机考",
    "华为 校招 机考",
    "华为 面试 手撕",
    "华为 测评 校招",
    "华子 校招",
    "华为 ICT 校招",
    "华为 软件开发 校招",
]

HW_PATTERN = re.compile(r"华为|华子|Huawei|HUAWEI|鸿蒙", re.I)
OD_PATTERN = re.compile(r"\bOD\b|#OD#|华为\s*OD|外包|od机考|od面", re.I)
CAMPUS_PATTERN = re.compile(
    r"校招|秋招|春招|暑期实习|寒假实习|留学生|(2[4-7])届|202[34567]届",
    re.I,
)
EXP_PATTERN = re.compile(r"机考|面经|笔试|面试|手撕|测评|秋招|校招|实习|offer|一面|二面", re.I)
GENERIC_TITLE = re.compile(r"从0到1|找实习|求职季|内推码汇总|面经汇总", re.I)
MIN_YEAR = 2023
MAX_PAGES = 20
PAGE_SIZE = 20
SLEEP_SEC = 0.35


def api_post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"https://gw-c.nowcoder.com{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://gw-c.nowcoder.com{path}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def strip_html(text) -> str:
    if text is None:
        text = ""
    if not isinstance(text, str):
        text = str(text)
    text = re.sub(r"<br\s*/?>", "\n", text or "", flags=re.I)
    text = re.sub(r"</p>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = htmlmod.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def ts_to_date(ms: int | None) -> str | None:
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
    except (OSError, OverflowError, ValueError):
        return None


def pick_timestamp(data: dict) -> str | None:
    for key in ("createTime", "showTime", "createdAt", "editTime"):
        d = ts_to_date(data.get(key))
        if d:
            return d
    return None


def discuss_url(content_id: str | int) -> str:
    return f"https://www.nowcoder.com/discuss/{content_id}"


def infer_stage(title: str, content: str) -> str:
    blob = f"{title}\n{content}"
    if re.search(r"机考|笔试|编程|OD|算法题|手撕", blob):
        return "exam"
    if re.search(r"测评|性格|心理", blob):
        return "assessment"
    if re.search(r"面试|一面|二面|三面|主管", blob):
        return "interview"
    if re.search(r"投递|简历|内推|offer|录用", blob):
        return "application"
    return "general"


def infer_tags(title: str, content: str) -> list[str]:
    blob = f"{title}\n{content}"
    tags: list[str] = []
    mapping = [
        ("OD", r"\bOD\b|外包"),
        ("校招", r"校招|秋招|春招|26届|25届"),
        ("实习", r"实习|暑期"),
        ("机考", r"机考|笔试|编程"),
        ("面试", r"面试|手撕|八股"),
        ("测评", r"测评"),
        ("流程", r"流程|投递|内推|offer"),
    ]
    for tag, pat in mapping:
        if re.search(pat, blob, re.I):
            tags.append(tag)
    return tags or ["华为"]


def slugify(title: str, max_len: int = 40) -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", title.strip())
    s = re.sub(r"-+", "-", s).strip("-")
    return (s[:max_len] or "post").lower()


def existing_discuss_ids() -> set[str]:
    ids: set[str] = set()
    for path in OUT_DIR.glob("hw-exp-*.md"):
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"nowcoder\.com/discuss/(\d+)", text):
            ids.add(m.group(1))
    return ids


def is_relevant(title: str, content: str) -> bool:
    title = title or ""
    content = content or ""
    blob = f"{title}\n{content[:2500]}"
    if OD_PATTERN.search(blob):
        return False
    if not CAMPUS_PATTERN.search(blob):
        return False
    if HW_PATTERN.search(title):
        return True
    if HW_PATTERN.search(title) is None and GENERIC_TITLE.search(title):
        return bool(HW_PATTERN.search(content[:1200]) and EXP_PATTERN.search(f"{title}\n{content[:1200]}"))
    return bool(HW_PATTERN.search(blob) and EXP_PATTERN.search(blob))


def parse_search_record(raw: dict) -> dict | None:
    item = raw.get("data") or {}
    if isinstance(item, list):
        return None
    moment = item.get("momentData") or {}
    if isinstance(moment, list):
        moment = {}
    content_data = item.get("contentData") or {}
    if isinstance(content_data, list):
        content_data = {}
    content_id = str(item.get("contentId") or moment.get("id") or "")
    if not content_id:
        return None

    title = (
        moment.get("title")
        or moment.get("newTitle")
        or content_data.get("title")
        or ""
    ).strip()
    content = strip_html(
        moment.get("newContent")
        or moment.get("content")
        or content_data.get("content")
        or ""
    )
    created_ms = (
        moment.get("createTime")
        or moment.get("createdAt")
        or content_data.get("createTime")
        or content_data.get("createdAt")
    )
    published = ts_to_date(created_ms)
    author = (item.get("userBrief") or {}).get("nickname") or ""

    if not is_relevant(title, content):
        return None
    if published and published[:4].isdigit() and int(published[:4]) < MIN_YEAR:
        return None

    return {
        "content_id": content_id,
        "uuid": moment.get("uuid") or "",
        "title": title or f"牛客讨论 {content_id}",
        "content": content,
        "published_at": published,
        "author": author,
        "url": discuss_url(content_id),
    }


def fetch_full_content(post: dict) -> str:
    if len(post.get("content") or "") >= 400:
        return post["content"]

    cid = post["content_id"]
    try:
        if len(cid) >= 15:
            data = api_get(f"/api/sparta/detail/content-data/detail/{cid}").get("data") or {}
        elif post.get("uuid"):
            data = api_get(f"/api/sparta/detail/moment-data/detail/{post['uuid']}").get("data") or {}
        else:
            data = api_get(f"/api/sparta/detail/moment-data/detail/{cid}").get("data") or {}
        full = strip_html(data.get("content") or data.get("newContent") or "")
        if full:
            post["title"] = (data.get("title") or post["title"]).strip()
            if not post.get("published_at"):
                post["published_at"] = pick_timestamp(data)
            return full
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, KeyError):
        pass
    return post.get("content") or ""


def search_all() -> dict[str, dict]:
    found: dict[str, dict] = {}
    for query in SEARCH_QUERIES:
        for page in range(1, MAX_PAGES + 1):
            try:
                payload = api_post(
                    "/api/sparta/pc/search",
                    {"query": query, "type": "all", "page": page, "pageSize": PAGE_SIZE},
                )
            except Exception as exc:
                print(f"[warn] search failed q={query!r} page={page}: {exc}", file=sys.stderr)
                break
            records = (payload.get("data") or {}).get("records") or []
            if not records:
                break
            for raw in records:
                post = parse_search_record(raw)
                if post:
                    found[post["content_id"]] = post
            time.sleep(SLEEP_SEC)
        print(f"[search] {query!r} -> cumulative {len(found)}")
    return found


def write_markdown(post: dict) -> Path:
    date = post.get("published_at") or "unknown"
    date_slug = date.replace("-", "") if date != "unknown" else f"nc{post['content_id'][-8:]}"
    eid = f"hw-exp-{date_slug}-nc-{post['content_id'][-8:]}"
    path = OUT_DIR / f"{eid}.md"

    title = post["title"].replace('"', "'")
    stage = infer_stage(post["title"], post["content"])
    tags = infer_tags(post["title"], post["content"])

    body_lines = [
        "---",
        f"id: {eid}",
        "kind: experience",
        "source_grade: C",
        f"stage: {stage}",
        "sources:",
        "  - platform: nowcoder",
        f'    title: "{title}"',
        f'    url: "{post["url"]}"',
    ]
    if post.get("published_at"):
        body_lines.append(f"published_at: {post['published_at']}")
    if post.get("author"):
        body_lines.append(f"author: {post['author']}")
    body_lines.append(f"tags: {json.dumps(tags, ensure_ascii=False)}")
    body_lines.append("---")
    body_lines.append("")
    body_lines.append(f"# {post['title']}")
    body_lines.append("")
    if post.get("author"):
        body_lines.append(f"- 作者：{post['author']}")
    body_lines.append(f"- 来源：[{post['title']}]({post['url']})")
    body_lines.append("")
    body_lines.append(post["content"] or "（正文需登录后查看，见来源链接）")

    path.write_text("\n".join(body_lines) + "\n", encoding="utf-8")
    return path


def main() -> int:
    seen = existing_discuss_ids()
    print(f"Existing nowcoder discuss ids: {len(seen)}")

    posts = search_all()
    new_posts = [p for cid, p in posts.items() if cid not in seen]
    print(f"Candidates: {len(posts)}, new: {len(new_posts)}")

    written = 0
    skipped_old = 0
    for post in sorted(new_posts, key=lambda p: p.get("published_at") or "", reverse=True):
        post["content"] = fetch_full_content(post)
        pub = post.get("published_at") or ""
        if not pub[:4].isdigit() or int(pub[:4]) < MIN_YEAR:
            skipped_old += 1
            continue
        if len(post["content"]) < 30 and len(post["title"]) < 8:
            continue
        write_markdown(post)
        written += 1
        time.sleep(SLEEP_SEC)

    print(f"Wrote {written} new experience files (skipped {skipped_old} pre-{MIN_YEAR}) to {OUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
