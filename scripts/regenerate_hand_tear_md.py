#!/usr/bin/env python3
"""重新生成按算法分类的手撕题 Markdown 汇总。"""
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
MATCHED_PATH = ROOT / "frontend" / "tmp" / "hand_tear_problems_matched.json"
HOT100_PATH = ROOT / "knowledge" / "coding-problems" / "hot100" / "index.json"
EXP_INDEX_PATH = ROOT / "knowledge" / "experiences" / "index.json"
OUT_PATH = ROOT / "knowledge" / "coding-problems" / "hand-tear-from-experiences.md"


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_pid(url: str) -> str:
    if not url:
        return ""
    m = re.search(r"/p/(P\d+)", url)
    return m.group(1) if m else ""


TITLE_RULES = {
    "链表": "链表",
    "树": "二叉树",
    "二叉树": "二叉树",
    "二叉搜索树": "二叉树",
    "BFS": "BFS / DFS",
    "DFS": "BFS / DFS",
    "层序": "BFS / DFS",
    "岛屿": "BFS / DFS",
    "路径": "BFS / DFS",
    "排列": "回溯",
    "组合": "回溯",
    "子集": "回溯",
    "全排列": "回溯",
    "回溯": "回溯",
    "动态规划": "动态规划",
    "DP": "动态规划",
    "贪心": "贪心",
    "二分": "二分查找",
    "栈": "栈 / 队列",
    "队列": "栈 / 队列",
    "括号": "栈 / 队列",
    "堆": "堆",
    "排序": "排序",
    "快速": "排序",
    "归并": "排序",
    "字符串": "字符串",
    "回文": "字符串",
    "滑动窗口": "滑动窗口",
    "双指针": "双指针",
    "哈希": "哈希",
    "并查集": "并查集",
    "图": "图论",
    "拓扑": "图论",
    "最短": "图论",
    "数学": "数学",
    "位运算": "位运算",
    "设计": "设计",
    "数组": "数组",
    "矩阵": "数组",
}


def classify_by_title(title: str) -> str:
    for kw, cat in TITLE_RULES.items():
        if kw in title:
            return cat
    return "其他"


def normalize_category(chapter: str | None, title: str) -> str:
    if not chapter:
        return classify_by_title(title)

    mapping = {
        "数组": "数组",
        "链表": "链表",
        "二叉树": "二叉树",
        "二叉搜索树": "二叉树",
        "二分查找": "二分查找",
        "排序": "排序",
        "字符串": "字符串",
        "栈": "栈 / 队列",
        "队列": "栈 / 队列",
        "堆": "堆",
        "BFS": "BFS / DFS",
        "DFS": "BFS / DFS",
        "BFS / DFS": "BFS / DFS",
        "动态规划": "动态规划",
        "回溯": "回溯",
        "贪心": "贪心",
        "滑动窗口": "滑动窗口",
        "双指针": "双指针",
        "哈希": "哈希",
        "并查集": "并查集",
        "图论": "图论",
        "数学": "数学",
        "位运算": "位运算",
        "设计": "设计",
    }
    for k, v in mapping.items():
        if k in chapter:
            return v
    return chapter


def main():
    matched = load_json(MATCHED_PATH)
    hot100 = load_json(HOT100_PATH)
    exp_index = load_json(EXP_INDEX_PATH)

    # 构建 PID -> chapter 映射
    pid_to_chapter = {}
    for p in hot100.get("problems", []):
        pid = p.get("id", "")
        if pid:
            pid_to_chapter[pid] = p.get("chapter", "")

    # 构建面经 id -> 记录映射
    exp_by_id = {}
    for rec in exp_index.get("records", []):
        exp_by_id[rec["id"]] = rec
    # 兼容：如果 records 不存在，尝试所有值
    if not exp_by_id:
        for v in exp_index.values():
            if isinstance(v, list):
                for rec in v:
                    if isinstance(rec, dict) and "id" in rec:
                        exp_by_id[rec["id"]] = rec

    # 按 codefun_url 聚合题目
    problems = defaultdict(lambda: {
        "title": "",
        "codefun_url": "",
        "sources": set(),
    })

    for item in matched:
        codefun_url = item.get("codefun_url")
        if not codefun_url:
            continue
        pid = extract_pid(codefun_url)
        chapter = pid_to_chapter.get(pid, "")
        title = item.get("matched_title") or item.get("title", "")
        category = normalize_category(chapter, title)

        key = (category, codefun_url)
        rec = problems[key]
        rec["title"] = title
        rec["codefun_url"] = codefun_url
        for sid in item.get("sources", []):
            if sid in exp_by_id:
                rec["sources"].add(sid)

    # 按分类整理
    grouped = defaultdict(list)
    for (category, url), rec in problems.items():
        if not rec["sources"]:
            continue
        grouped[category].append(rec)

    # 排序：每类按标题排序
    for cat in grouped:
        grouped[cat].sort(key=lambda x: x["title"])

    category_order = [
        "数组", "链表", "二叉树", "BFS / DFS", "二分查找", "排序", "字符串",
        "栈 / 队列", "堆", "动态规划", "回溯", "贪心", "滑动窗口", "双指针",
        "哈希", "并查集", "图论", "数学", "位运算", "设计", "其他",
    ]
    sorted_categories = sorted(
        grouped.keys(),
        key=lambda c: (category_order.index(c) if c in category_order else 999, c),
    )

    # 生成 Markdown
    lines = ["# 面经手撕题汇总\n"]

    total = sum(len(v) for v in grouped.values())
    lines.append(f"共收录 {total} 道已在 CodeFun2000 上线、且来源面经仍存在的题目。\n")

    for cat in sorted_categories:
        lines.append(f"\n## {cat}\n")
        for rec in grouped[cat]:
            title = rec["title"]
            url = rec["codefun_url"]
            lines.append(f"\n### {title}")
            lines.append(f"- **CodeFun2000**: [{url}]({url})")
            source_links = []
            for sid in sorted(rec["sources"]):
                meta = exp_by_id[sid]
                source_title = meta.get("title", sid)
                role = meta.get("role", "software-development")
                link = f"/experiences/{role}/{sid}"
                source_links.append(f"[{source_title}]({link})")
            lines.append("- **来源面经**: " + "、".join(source_links))
            lines.append("")

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"[done] wrote {OUT_PATH} with {total} problems in {len(sorted_categories)} categories")


if __name__ == "__main__":
    main()
