"""从面经库中提取手撕题，生成汇总题库 Markdown。

本脚本读取：
- frontend/tmp/hand_tear_problems_matched.json：已通过题目名/语义匹配到 CodeFun2000 的题目
- frontend/tmp/hand_tear_problems_raw.json：原始手撕题引用行

输出：
- knowledge/coding-problems/hand-tear-from-experiences.md
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent


def extract_leetcode_slug(url: str) -> str | None:
    """Extract problem slug from leetcode URL."""
    m = re.search(r"/problems/([^/\s?]+)/", url)
    if m:
        return m.group(1)
    return None


def slug_to_title(slug: str) -> str:
    """Convert leetcode slug to a readable title."""
    return slug.replace("-", " ").title()


def extract_leetcode_number(line: str) -> int | None:
    """Extract LeetCode number from line."""
    m = re.search(r"(?:leetcode|lc|力扣)[\s\.]*([0-9]{1,4})", line, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"(?:第\s*)?([0-9]{1,4})\s*[\.\s]*题", line)
    if m:
        return int(m.group(1))
    return None


def is_hand_tear_related(line: str) -> bool:
    keywords = ["手撕", "leetcode", "力扣", "lc", "算法题", "编程题", "手写代码", "原题"]
    return any(k in line.lower() for k in keywords)


def main() -> None:
    matched = json.loads((ROOT / "frontend" / "tmp" / "hand_tear_problems_matched.json").read_text(encoding="utf-8"))
    raw = json.loads((ROOT / "frontend" / "tmp" / "hand_tear_problems_raw.json").read_text(encoding="utf-8"))
    idx = json.loads((ROOT / "knowledge" / "experiences" / "index.json").read_text(encoding="utf-8"))
    id_to_title = {e["id"]: e["title"] for e in idx["experiences"]}

    # ---- CodeFun2000 matched problems (merge by codefun_url) ----
    codefun_map: dict[str, dict] = {}
    for p in matched:
        if not p.get("codefun_url"):
            continue
        url = p["codefun_url"]
        title = p.get("matched_title") or p.get("key") or "未命名题目"
        leetcode_url = p.get("leetcode_url")
        if not leetcode_url:
            num = extract_leetcode_number(p.get("line", ""))
            if num:
                leetcode_url = f"https://leetcode.cn/problems/{num}/"
        if url not in codefun_map:
            codefun_map[url] = {
                "title": title,
                "codefun_url": url,
                "leetcode_url": leetcode_url,
                "sources": [],
                "match_score": p.get("match_score", 0),
            }
        else:
            # Keep the highest match score and the most specific title
            if p.get("match_score", 0) > codefun_map[url]["match_score"]:
                codefun_map[url]["match_score"] = p["match_score"]
                if len(title) < len(codefun_map[url]["title"]):
                    codefun_map[url]["title"] = title
            if not codefun_map[url]["leetcode_url"] and leetcode_url:
                codefun_map[url]["leetcode_url"] = leetcode_url
        for sid in p.get("sources", []):
            if sid not in codefun_map[url]["sources"]:
                codefun_map[url]["sources"].append(sid)

    codefun_problems = sorted(codefun_map.values(), key=lambda x: x["title"])

    # ---- LeetCode-only problems from raw data ----
    # Collect all LeetCode URLs that are not already represented in codefun_problems
    codefun_leetcode_urls = {p["leetcode_url"] for p in codefun_problems if p["leetcode_url"]}
    leetcode_only: dict[str, dict] = {}

    for item in raw:
        line = item["line"]
        if not is_hand_tear_related(line):
            continue

        urls = set()
        for _, url in item.get("links", []):
            if "leetcode" in url.lower() and "problems" in url.lower():
                urls.add(url)
        for url in item.get("raw_urls", []):
            if "leetcode" in url.lower() and "problems" in url.lower():
                urls.add(url)

        for url in urls:
            if url in codefun_leetcode_urls:
                continue
            slug = extract_leetcode_slug(url)
            title = slug_to_title(slug) if slug else "未命名 LeetCode 题"
            key = url
            if key not in leetcode_only:
                leetcode_only[key] = {
                    "title": title,
                    "leetcode_url": url,
                    "sources": [],
                }
            if item["source_id"] not in leetcode_only[key]["sources"]:
                leetcode_only[key]["sources"].append(item["source_id"])

        # Also handle explicit leetcode numbers without URL
        for num in item.get("leetcode_nums", []):
            url = f"https://leetcode.cn/problems/{num}/"
            if url in codefun_leetcode_urls:
                continue
            key = url
            if key not in leetcode_only:
                leetcode_only[key] = {
                    "title": f"LeetCode {num}",
                    "leetcode_url": url,
                    "sources": [],
                }
            if item["source_id"] not in leetcode_only[key]["sources"]:
                leetcode_only[key]["sources"].append(item["source_id"])

    leetcode_only_list = sorted(leetcode_only.values(), key=lambda x: x["title"])

    # ---- Unknown problems: lines with hand-tear keyword but no URL and no match ----
    matched_keys = set()
    for p in matched:
        matched_keys.add(p.get("line", ""))

    # Noises we want to drop from the unknown list
    UNKNOWN_NOISE_KEYWORDS = [
        "手撕代码", "手撕环节", "手撕题", "算法题", "编程题", "三道算法题", "保持每天",
        "机考", "指南", "建议", "准备", "业务面试", "一定会有", "问了一个", "选择题",
        "自我介绍", "获奖经历", "部门情况", "实习经历", "项目框图", "项目里的部分电路",
        "i2c", "spi", "时序图", "电路", "没有手撕", "无手撕", "手撕都是用纸手写",
        "手撕项目", "手撕框图", "作者：", "宏内核", "微内核", "自旋锁", "多线程同步",
    ]

    def is_unknown_noise(line: str) -> bool:
        lower = line.lower()
        # Very short vague mentions
        if len(line.strip()) < 15:
            return True
        # Pure markdown heading without problem meaning
        if re.match(r"^[#\*\-\s]+(手撕|算法|编程|题目|三道).*$", line.strip()):
            return True
        for kw in UNKNOWN_NOISE_KEYWORDS:
            if kw in lower:
                return True
        return False

    unknown: dict[str, dict] = {}
    for item in raw:
        line = item["line"]
        if not is_hand_tear_related(line):
            continue
        if line in matched_keys:
            continue
        if item.get("raw_urls") or any("leetcode" in u.lower() for _, u in item.get("links", [])):
            continue
        if item.get("leetcode_nums"):
            continue
        if is_unknown_noise(line):
            continue
        label = line.strip()[:60] + "..." if len(line.strip()) > 60 else line.strip()
        key = label
        if key not in unknown:
            unknown[key] = {
                "title": label,
                "sources": [],
            }
        if item["source_id"] not in unknown[key]["sources"]:
            unknown[key]["sources"].append(item["source_id"])

    unknown_list = sorted(unknown.values(), key=lambda x: x["title"])

    # ---- Generate Markdown ----
    lines = [
        "# 面经手撕题汇总",
        "",
        "> 从 `knowledge/experiences` 面经库中提取的手撕题清单。",
        "> 优先展示 CodeFun2000 链接；CodeFun2000 未收录的放 LeetCode 链接；两者都没有的归到「链接缺失」待整理。",
        "",
        f"共整理 {len(codefun_problems) + len(leetcode_only_list) + len(unknown_list)} 道手撕题，",
        f"其中 CodeFun2000 已收录 **{len(codefun_problems)}** 道，",
        f"LeetCode-only **{len(leetcode_only_list)}** 道，",
        f"链接缺失 **{len(unknown_list)}** 道。",
        "",
        "---",
        "",
        "## 一、CodeFun2000 已收录题目",
        "",
    ]

    for p in codefun_problems:
        lines.append(f"### {p['title']}")
        lines.append(f"- **CodeFun2000**: [{p['codefun_url']}]({p['codefun_url']})")
        if p["leetcode_url"]:
            lines.append(f"- **LeetCode**: [{p['leetcode_url']}]({p['leetcode_url']})")
        sources = []
        for sid in p["sources"]:
            t = id_to_title.get(sid, sid)
            sources.append(f"[{sid}（{t}）](../../../experiences/{sid}.md)")
        lines.append(f"- **来源面经**: " + "、".join(sources))
        lines.append("")

    lines += [
        "---",
        "",
        "## 二、LeetCode-only 题目（CodeFun2000 暂未收录）",
        "",
        "这些题只找到 LeetCode 链接，需要后续在 CodeFun2000 建题或补齐映射。",
        "",
    ]

    for p in leetcode_only_list:
        lines.append(f"### {p['title']}")
        lines.append(f"- **LeetCode**: [{p['leetcode_url']}]({p['leetcode_url']})")
        lines.append("- **CodeFun2000**: 暂未收录")
        sources = []
        for sid in p["sources"]:
            t = id_to_title.get(sid, sid)
            sources.append(f"[{sid}（{t}）](../../../experiences/{sid}.md)")
        lines.append(f"- **来源面经**: " + "、".join(sources))
        lines.append("")

    # Third section removed per user request: do not list link-missing problems.

    out_path = ROOT / "knowledge" / "coding-problems" / "hand-tear-from-experiences.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"generated {out_path}")
    print(f"  codefun: {len(codefun_problems)}, leetcode only: {len(leetcode_only_list)}, unknown: {len(unknown_list)}")


if __name__ == "__main__":
    main()
