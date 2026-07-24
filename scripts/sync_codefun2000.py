#!/usr/bin/env python3
"""
同步 CodeFun2000 hwmj 题库目录到 knowledge/（需已购/登录 Cookie）。

用法:
  set CODEFUN2000_COOKIE="sid=...; ..."
  python scripts/sync_codefun2000.py

或从浏览器复制 Cookie 到 hw-campus-skills/.env.local（勿提交 git）:
  CODEFUN2000_COOKIE=...
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://codefun2000.com/problemset/hwmj"
OUT_CATALOG = ROOT / "knowledge" / "coding-problems" / "catalog.json"
OUT_EXP = ROOT / "knowledge" / "experiences" / "platform"


def fetch_html(cookie: str = "") -> str:
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "text/html"}
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(URL, headers=headers)
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")


def parse_ui_context(html: str) -> dict:
    m = re.search(r"window\.UiContextNew\s*=\s*'(\{.*?\})';", html, re.DOTALL)
    if not m:
        raise RuntimeError("UiContextNew not found — page layout may have changed")
    raw = m.group(1).encode("utf-8").decode("unicode_escape")
    return json.loads(raw)


def slug(s: str) -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", s.strip()).strip("-")
    return (s[:60] or "item")


def problem_url(pid: str) -> str:
    return f"https://codefun2000.com/p/{pid}"


def write_catalog(ctx: dict) -> None:
    ps = ctx.get("ps") or {}
    catalog = {
        "psid": ctx.get("psid"),
        "slug": "hwmj",
        "name": ps.get("name"),
        "introduction": ps.get("introduction"),
        "total_problems": ctx.get("totalProblems"),
        "have_access": ctx.get("have"),
        "problemset_url": URL,
        "algorithm_tags": ctx.get("allAlgTags") or [],
        "nodes": ctx.get("nodes") or [],
    }
    OUT_CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote catalog -> {OUT_CATALOG.relative_to(ROOT)} ({catalog['total_problems']} total, nodes={len(catalog['nodes'])})")


def flatten_problems(nodes: list) -> list[dict]:
    items = []

    def walk(node, chapter=""):
        title = node.get("title") or node.get("name") or chapter
        for p in node.get("problems") or node.get("pdocs") or []:
            if isinstance(p, dict):
                pid = p.get("docId") or p.get("pid") or p.get("_id") or p.get("id")
                ptitle = p.get("title") or p.get("name") or ""
                if pid:
                    items.append({"pid": str(pid), "title": ptitle, "chapter": title, "tags": p.get("tag") or []})
        for child in node.get("children") or node.get("nodes") or []:
            walk(child, title)
        # flat node list variant
        if node.get("pid") and node.get("title"):
            items.append(
                {
                    "pid": str(node["pid"]),
                    "title": node["title"],
                    "chapter": chapter,
                    "tags": node.get("tags") or [],
                }
            )

    for n in nodes:
        walk(n)
    # dedupe
    seen = set()
    out = []
    for it in items:
        if it["pid"] in seen:
            continue
        seen.add(it["pid"])
        out.append(it)
    return out


def write_experience_stubs(problems: list[dict]) -> int:
    OUT_EXP.mkdir(parents=True, exist_ok=True)
    count = 0
    for p in problems:
        pid = p["pid"]
        title = p["title"] or f"problem-{pid}"
        eid = f"hw-exp-cf-{slug(title)}-{pid[-6:]}"
        path = OUT_EXP / f"{eid}.md"
        if path.exists():
            continue
        url = problem_url(pid)
        body = f"""---
id: {eid}
kind: experience
source_grade: C
stage: exam
sources:
  - platform: codefun2000
    title: "{title.replace(chr(34), "'")}"
    url: "{url}"
tags: {json.dumps(p.get("tags") or [], ensure_ascii=False)}
chapter: "{p.get("chapter", "").replace(chr(34), "'")}"
catalog_pid: "{pid}"
---

# {title}

> 目录条目已同步；正文请在站内阅读或后续用 Cookie + 详情 API 补充。

- 章节：{p.get("chapter") or "-"}
- 链接：[{title}]({url})
"""
        path.write_text(body, encoding="utf-8")
        count += 1
    return count


def main() -> int:
    cookie = os.environ.get("CODEFUN2000_COOKIE", "").strip()
    html = fetch_html(cookie)
    ctx = parse_ui_context(html)
    write_catalog(ctx)

    if not ctx.get("have") and not (ctx.get("nodes") or []):
        print(
            "\n未获取到题目目录（nodes 为空）。"
            "未登录或未购买时站点不返回 97 道题列表。\n"
            "请用已购账号在浏览器登录 codefun2000.com，复制 Cookie 后重试：\n"
            "  set CODEFUN2000_COOKIE=...\n"
            "  python scripts/sync_codefun2000.py",
            file=sys.stderr,
        )
        return 1

    problems = flatten_problems(ctx.get("nodes") or [])
    n = write_experience_stubs(problems)
    print(f"Created {n} new experience stubs in experiences/platform/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
