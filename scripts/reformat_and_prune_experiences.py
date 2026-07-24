#!/usr/bin/env python3
"""
Reformat all external (nowcoder/xiaohongshu) experience markdown files to match
original source formatting, and delete files whose original URL is gone (404/410)
or whose content is not Huawei-related.

Usage:
    python scripts/reformat_and_prune_experiences.py
"""
from __future__ import annotations

import re
import sys
import time
import yaml
import requests
import html2text
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

# 复用连接池，提高并发稳定性
_SESSION = requests.Session()
_SESSION.headers.update(HEADERS)
_SESSION.mount(
    "https://",
    requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=10, max_retries=1),
)
_SESSION.mount(
    "http://",
    requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=10, max_retries=1),
)


def split_frontmatter(text: str):
    if not text.startswith("---"):
        return None, text
    # 要求结束标记 --- 单独占一行，避免标题里含 --- 被误切
    m = re.match(r"(?s)^---\n(.*?)\n---\n(.*)", text)
    if not m:
        return None, text
    return m.group(1), m.group(2)


def is_huawei_related(title: str, content: str) -> bool:
    """Return True if the combined title/content clearly relates to Huawei."""
    combined = (title or "") + " " + (content or "")
    return "华为" in combined or "huawei" in combined.lower()


def _extract_nowcoder(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    container = (
        soup.select_one("div.nc-post-content")
        or soup.select_one("div.nc-slate-editor-content")
        or soup.select_one("section.post-content-box")
    )
    if not container:
        return None
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.body_width = 0
    h.mark_code = False
    md = h.handle(str(container))
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    md = re.sub(r"\n?\[?展开\]?\n?", "", md)
    md = re.sub(r"\n?\[?收起\]?\n?", "", md)
    return md


def fetch_nowcoder(url: str):
    for attempt in range(2):
        try:
            r = _SESSION.get(url, timeout=10)
        except Exception as e:
            if attempt == 0:
                time.sleep(1)
                continue
            return None, f"fetch_error:{e}"
        if r.status_code in (404, 410, 403):
            return None, f"deleted_or_blocked:{r.status_code}"
        r.encoding = "utf-8"
        md = _extract_nowcoder(r.text)
        if md is not None:
            return md, "ok"
        if attempt == 0:
            time.sleep(1)
    return None, "no_content"


def fetch_xiaohongshu(url: str):
    for attempt in range(2):
        try:
            r = _SESSION.get(url, timeout=10)
        except Exception as e:
            if attempt == 0:
                time.sleep(1)
                continue
            return None, f"fetch_error:{e}"
        if r.status_code in (404, 410):
            return None, "deleted"
        r.encoding = "utf-8"
        text = r.text
        soup = BeautifulSoup(text, "html.parser")
        # 1) 尝试 meta description
        meta = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", attrs={"property": "og:description"}
        )
        if meta and meta.get("content"):
            content = meta["content"].strip()
            if len(content) > 60:
                return content, "ok"
        # 2) 尝试 SSR 容器
        for sel in ["div#noteContainer", "div.content", "main", "article"]:
            el = soup.select_one(sel)
            if el and len(el.get_text(strip=True)) > 60:
                return el.get_text(separator="\n", strip=True), "ok"
        # 3) 兜底：文本最长的 div
        best = None
        best_len = 0
        for div in soup.find_all("div"):
            t = div.get_text(strip=True)
            if len(t) > best_len and len(t) < 20000:
                best_len = len(t)
                best = div
        if best and best_len > 60:
            return best.get_text(separator="\n", strip=True), "ok"
        if attempt == 0:
            time.sleep(1)
    return None, "no_content"


def fetch_generic(url: str):
    try:
        r = _SESSION.get(url, timeout=10)
    except Exception as e:
        return None, f"fetch_error:{e}"
    if r.status_code in (404, 410):
        return None, "deleted"
    return None, "unsupported"


def rewrite_content(path: Path, front_text: str, new_body: str, title: str, author: str, url: str):
    lines = []
    if title:
        lines.append(f"# {title}")
    if author:
        lines.append(f"- 作者：{author}")
    if url:
        lines.append(f"- 来源：[{title}]({url})")
    header = "\n".join(lines)
    if header:
        new_body = header + "\n\n" + new_body
    new_text = f"---\n{front_text}\n---\n\n{new_body}\n"
    path.write_text(new_text, encoding="utf-8")


def process_file(path: Path):
    text = path.read_text(encoding="utf-8")
    front_text, _ = split_frontmatter(text)
    if front_text is None:
        return "no_frontmatter"
    try:
        fm = yaml.safe_load(front_text)
    except Exception as e:
        return f"frontmatter_error:{e}"

    sources = fm.get("sources") or []
    if not sources:
        return "no_source"
    source = sources[0]
    url = source.get("url", "")
    platform = source.get("platform", "")
    title = source.get("title", "") or fm.get("title", "")
    author = fm.get("author", "")

    if not url:
        return "no_url"

    if platform == "nowcoder":
        new_body, status = fetch_nowcoder(url)
    elif platform == "xiaohongshu":
        new_body, status = fetch_xiaohongshu(url)
    else:
        new_body, status = fetch_generic(url)

    if status == "deleted" or status.startswith("deleted_or_blocked"):
        path.unlink()
        return f"deleted:{status}"

    if new_body is None:
        return status

    # 非华为内容：删除
    if not is_huawei_related(title, new_body):
        path.unlink()
        return "deleted:not_huawei"

    rewrite_content(path, front_text, new_body, title, author, url)
    return "updated"


def main() -> int:
    files = sorted(EXP_DIR.rglob("hw-exp-*.md"))
    files = [p for p in files if "_index" not in p.parts and p.parent.name != "platform"]
    stats: dict[str, int] = {}
    deleted_log: list[str] = []
    updated_log: list[str] = []
    error_log: list[str] = []

    with ThreadPoolExecutor(max_workers=1) as executor:
        future_to_path = {executor.submit(process_file, p): p for p in files}
        for i, future in enumerate(as_completed(future_to_path)):
            path = future_to_path[future]
            try:
                status = future.result()
                stats[status] = stats.get(status, 0) + 1
                if status.startswith("deleted"):
                    deleted_log.append(f"{status}: {path}")
                elif status == "updated":
                    updated_log.append(str(path))
                else:
                    error_log.append(f"{status}: {path}")
            except Exception as e:
                stats["error"] = stats.get("error", 0) + 1
                error_log.append(f"error:{path}: {e}")
            if (i + 1) % 10 == 0:
                print(f"processed {i + 1}/{len(files)}", file=sys.stderr, flush=True)

    print("\n=== STATS ===")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")

    print("\n=== DELETED (first 50) ===")
    for line in deleted_log[:50]:
        print(line)
    if len(deleted_log) > 50:
        print(f"... and {len(deleted_log) - 50} more")

    print("\n=== UPDATED (first 30) ===")
    for line in updated_log[:30]:
        print(line)
    if len(updated_log) > 30:
        print(f"... and {len(updated_log) - 30} more")

    print("\n=== ERRORS / SKIPS (first 30) ===")
    for line in error_log[:30]:
        print(line)
    if len(error_log) > 30:
        print(f"... and {len(error_log) - 30} more")

    return 0


if __name__ == "__main__":
    sys.exit(main())
