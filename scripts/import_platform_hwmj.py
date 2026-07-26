#!/usr/bin/env python3
"""Rebuild coding-problems index/catalog from knowledge/experiences/platform/."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_EXP = ROOT / "knowledge" / "experiences" / "platform"
OUT_INDEX = ROOT / "knowledge" / "coding-problems" / "index.json"
OUT_CATALOG = ROOT / "knowledge" / "coding-problems" / "catalog.json"

CATEGORY_ROLE = {
    "通用软件开发": "software-development",
    "算法": "ai",
    "嵌入式": "embedded",
    "通信": "network-communication",
    "其他": "software-development",
}


def parse_platform_md(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None
    fm, body = parts[1], parts[2]

    m = re.search(r"catalog_pid:\s*\"P(\d+)\"", fm)
    if not m:
        m = re.search(r"hw-exp-cf-P(\d+)", path.name)
    if not m:
        return None
    pid = m.group(1)

    def pick(key: str, default: str = "") -> str:
        hit = re.search(rf"^{key}:\s*(.+)$", fm, re.M)
        return hit.group(1).strip().strip('"') if hit else default

    title = pick("title") or re.search(r"^# (.+)$", body, re.M)
    title = title.group(1).strip() if hasattr(title, "group") else (title or f"P{pid}")
    url = pick("url")
    if not url:
        um = re.search(r"url:\s*\"(https?://[^\"]+)\"", fm)
        url = um.group(1) if um else f"https://codefun2000.com/p/{pid}"

    category = pick("category", "其他")
    role = pick("role") or CATEGORY_ROLE.get(category, "general")
    stage = pick("stage", "interview")
    tags_raw = pick("tags", "[]")
    try:
        tags = json.loads(tags_raw.replace("'", '"'))
    except json.JSONDecodeError:
        tags = []  # 展示标签由语义打标脚本写入，这里不写「校招」等无区分度词

    return {
        "pid": pid,
        "category": category,
        "title": title,
        "url": url,
        "role": role,
        "stage": stage,
        "tags": tags,
    }


def collect_entries() -> list[dict]:
    entries = []
    for path in sorted(OUT_EXP.glob("hw-exp-cf-P*.md")):
        row = parse_platform_md(path)
        if row:
            entries.append(row)
    return entries


def write_indexes(entries: list[dict]) -> None:
    problems = []
    for e in sorted(entries, key=lambda x: int(x["pid"])):
        problems.append(
            {
                "id": f"P{e['pid']}",
                "pid": e["pid"],
                "title": e["title"],
                "category": e["category"],
                "tags": e["tags"],
                "roles": [e["role"]],
                "stages": [e["stage"]],
                "source_url": e["url"],
            }
        )

    index = {
        "version": 2,
        "problemset": {
            "title": "华为校招&实习面经手撕题库",
            "url": "https://codefun2000.com/problemset/hw",
        },
        "description": "CodeFun2000 hwmj 题库索引；source_url 供 Agent 输出可点击链接",
        "problems": problems,
    }
    OUT_INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    by_cat: dict[str, list[dict]] = {}
    for e in entries:
        by_cat.setdefault(e["category"], []).append(
            {"pid": f"P{e['pid']}", "title": e["title"], "url": e["url"], "role": e["role"]}
        )
    for items in by_cat.values():
        items.sort(key=lambda x: int(x["pid"][1:]))

    catalog = {
        "psid": "673c9c7139f40f849bfbda7c",
        "slug": "hwmj",
        "name": "华为面经",
        "introduction": "22至26年期间华为校招&实习面经题库",
        "total_problems": len(entries),
        "have_access": True,
        "problemset_url": "https://codefun2000.com/problemset/hw",
        "algorithm_tags": [
            "模拟", "暴力枚举", "递归", "思维", "动态规划", "贪心算法", "构造",
            "链表", "栈", "堆", "队列", "哈希表", "树", "二叉树", "字典树", "并查集",
            "有序集合", "ST表", "线段树", "树状数组", "DFS", "BFS", "最短路算法",
            "最小生成树", "拓扑排序", "欧拉路径", "2-SAT算法", "强连通分量", "网络流",
            "双指针", "二分算法", "排序算法", "前缀和", "差分数组", "位运算", "扫描线算法",
            "字符串", "KMP算法", "马拉车算法", "数学", "机器学习算法",
        ],
        "categories": [
            {"name": cat, "count": len(by_cat[cat]), "problems": by_cat[cat]}
            for cat in sorted(by_cat)
        ],
    }
    OUT_CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    if not OUT_EXP.exists():
        print(f"Platform dir not found: {OUT_EXP}", file=sys.stderr)
        return 1

    entries = collect_entries()
    if not entries:
        print("No platform experiences found", file=sys.stderr)
        return 1

    write_indexes(entries)
    print(f"Synced index for {len(entries)} platform entries")
    print(f"Updated {OUT_INDEX.relative_to(ROOT)} and {OUT_CATALOG.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
