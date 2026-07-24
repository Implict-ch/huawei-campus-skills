#!/usr/bin/env python3
"""从本地「华为面经」目录同步 CodeFun2000 面经到 knowledge/experiences/platform/。

- 用 标题.txt 更新标题（含日期线索）
- 解析标题中的时间写入 published_at
- 按章节 + 标题关键词映射到现有岗位 role
- 用 题面.md 作为正文
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "华为面经"
OUT_EXP = ROOT / "knowledge" / "experiences" / "platform"
OUT_INDEX = ROOT / "knowledge" / "coding-problems" / "index.json"
OUT_CATALOG = ROOT / "knowledge" / "coding-problems" / "catalog.json"

CATEGORY_ROLE = {
    "通用软件开发": "software-development",
    "算法": "ai",
    "嵌入式": "embedded",
    "通信": "network-communication",
}

ROLE_LABEL = {
    "software-development": "通用软件开发",
    "ai": "AI大类",
    "embedded": "嵌入式软件",
    "network-communication": "通信 / 网络",
    "test-qa": "测试",
}

# 标题命中优先于章节默认（从强到弱）
TITLE_ROLE_RULES: List[Tuple[str, List[str]]] = [
    ("test-qa", ["测开", "测试开发", "测试工程师", "软件测试", "自动化测试"]),
    ("embedded", ["嵌入式", "FPGA", "硬件开发", "硬件逻辑", "单片机", "芯片", "数字IC", "模拟IC"]),
    ("ai", [
        "AI软开", "AI软件开发", "AI软件", "AI算法", "AI工程师", "AI应用",
        "AI大模型", "AI岗", "AI方向",
        "算法工程师", "通信算法", "大模型", "计算机视觉", "机器学习",
        "深度学习", "智能驾驶", "自动驾驶", "NLP", "推荐算法",
    ]),
    ("network-communication", [
        "通信工程", "无线通信", "短距离通信", "核心网", "数通", "基带",
        "光产品", "光通信", "5G", "无线部门",
    ]),
    ("software-development", [
        "通用软件开发", "软开", "软件开发", "软件研发", "终端软件", "终端云",
        "云计算", "数据库开发", "后端", "前端", "Java", "C++", "GTS",
        "计算产品线", "微内核",
    ]),
]


def clean_title(title: str) -> str:
    t = html.unescape(title or "").strip()
    t = re.sub(r"\s+", " ", t)
    return t


def parse_date_from_title(title: str) -> Optional[str]:
    """从标题解析近似发布日期，返回 YYYY-MM-DD。"""
    t = clean_title(title)

    # 26-秋招-9.24 / 26秋招-9.24
    m = re.search(
        r"(?P<yy>\d{2})\s*[-_]?\s*(?:秋招|春招|暑期实习|实习)?\s*[-_]?\s*(?P<m>\d{1,2})\.(?P<d>\d{1,2})",
        t,
    )
    if m:
        y = 2000 + int(m.group("yy"))
        return f"{y:04d}-{int(m.group('m')):02d}-{int(m.group('d')):02d}"

    # 27暑期实习-4月底 / 25秋招-10月中 / 25-秋招-10月中
    m = re.search(
        r"(?P<yy>\d{2})\s*[-_]?\s*(?P<season>秋招|春招|暑期实习|实习)?\s*[-_]?\s*(?P<m>\d{1,2})\s*月\s*(?P<part>初|中|下|底)?",
        t,
    )
    if m:
        y = 2000 + int(m.group("yy"))
        month = int(m.group("m"))
        part = m.group("part") or ""
        day = {"初": 5, "中": 15, "下": 20, "底": 25}.get(part, 15)
        return f"{y:04d}-{month:02d}-{day:02d}"

    # 仅有批次：25秋招 / 27暑期实习
    m = re.search(r"(?P<yy>\d{2})\s*[-_]?\s*(?P<season>秋招|春招|暑期实习|实习)", t)
    if m:
        y = 2000 + int(m.group("yy"))
        season = m.group("season")
        if season == "秋招":
            return f"{y:04d}-09-15"
        if season == "春招":
            return f"{y:04d}-03-15"
        return f"{y:04d}-06-15"

    return None


def infer_role(category: str, title: str, body: str) -> str:
    text = f"{title}\n{body[:2000]}"
    # 标题强规则优先
    for role, kws in TITLE_ROLE_RULES:
        for kw in kws:
            if kw.lower() in text.lower() or kw in text:
                return role

    if category in CATEGORY_ROLE:
        return CATEGORY_ROLE[category]

    # 「其他」兜底：再扫一遍更宽泛关键词
    low = text.lower()
    if any(k in low for k in ("算法", "ai", "大模型", "视觉", "nlp")):
        return "ai"
    if any(k in low for k in ("嵌入", "fpga", "硬件")):
        return "embedded"
    if any(k in low for k in ("通信", "无线", "5g", "光产品", "ict")):
        # ICT + 软开已在 TITLE_ROLE_RULES 命中；纯 ICT 归通信
        if "通用软件" in text or "软开" in text:
            return "software-development"
        return "network-communication"
    if any(k in low for k in ("测试", "测开")):
        return "test-qa"
    return "software-development"


def build_tags(category: str, role: str, title: str) -> List[str]:
    """展示标签只放有区分度的词；岗位大类/实习/机考等不再写入。

    最终卡片标签以 scripts/llm_tag_experiences.py 的语义打标为准，
    这里只给新建文件一个可为空的占位，避免再出现「实习/机考/面试」。
    """
    tags: List[str] = []
    if "手撕" in title:
        tags.append("手撕")
    # 去重保序
    seen = set()
    out = []
    for t in tags:
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def collect_source_items() -> List[dict]:
    if not SRC.exists():
        raise FileNotFoundError(f"源目录不存在: {SRC}")
    items = []
    for title_path in sorted(SRC.rglob("标题.txt")):
        pid_dir = title_path.parent
        pid = pid_dir.name
        if not re.fullmatch(r"P\d+", pid):
            continue
        category = pid_dir.parent.name
        title = clean_title(title_path.read_text(encoding="utf-8", errors="replace"))
        url_path = pid_dir / "网址.txt"
        url = ""
        if url_path.exists():
            url = url_path.read_text(encoding="utf-8", errors="replace").strip().splitlines()[0].strip()
        if not url:
            url = f"https://codefun2000.com/ide/{pid}"
        stmt_path = pid_dir / "题面.md"
        body = ""
        if stmt_path.exists():
            body = stmt_path.read_text(encoding="utf-8", errors="replace").strip()
            # 去掉题面里与标题重复的首行 # 标题，后面统一用新标题
            body = re.sub(r"^#\s+.+\n+", "", body, count=1).strip()
        published = parse_date_from_title(title)
        role = infer_role(category, title, body)
        items.append(
            {
                "pid": pid,
                "category": category,
                "title": title,
                "url": url,
                "body": body,
                "published_at": published,
                "role": role,
            }
        )
    return items


def render_md(item: dict) -> str:
    pid = item["pid"]
    title = item["title"].replace('"', "'")
    url = item["url"]
    role = item["role"]
    category = item["category"]
    published = item["published_at"] or ""
    tags = build_tags(category, role, item["title"])
    tags_json = json.dumps(tags, ensure_ascii=False)

    fm_lines = [
        "---",
        f"id: hw-exp-cf-{pid}",
        "kind: experience",
        "source_grade: B",
        "stage: interview",
        f"role: {role}",
        "sources:",
        "  - platform: codefun2000",
        f'    title: "{title}"',
        f'    url: "{url}"',
        f'catalog_pid: "{pid}"',
        f'category: "{category}"',
        f"tags: {tags_json}",
    ]
    if published:
        fm_lines.append(f"published_at: {published}")
    fm_lines.append("---")

    body = item["body"] or "（正文待补充）"
    content = "\n".join(fm_lines) + "\n\n"
    content += f"# {item['title']}\n\n"
    content += f"- 分类：{category}\n\n"
    content += f"- 来源：[{item['title']}]({url})\n\n"
    content += body + "\n"
    return content


def write_experiences(items: List[dict]) -> Dict[str, int]:
    OUT_EXP.mkdir(parents=True, exist_ok=True)
    stats = {"created": 0, "updated": 0, "with_date": 0, "no_date": 0}
    # 清理旧的非标准命名 stub（保留 hw-exp-cf-P*.md）
    for old in OUT_EXP.glob("hw-exp-cf-*.md"):
        if not re.fullmatch(r"hw-exp-cf-P\d+\.md", old.name):
            old.unlink()

    keep = set()
    for item in items:
        path = OUT_EXP / f"hw-exp-cf-{item['pid']}.md"
        keep.add(path.name)
        text = render_md(item)
        existed = path.exists()
        path.write_text(text, encoding="utf-8")
        if existed:
            stats["updated"] += 1
        else:
            stats["created"] += 1
        if item["published_at"]:
            stats["with_date"] += 1
        else:
            stats["no_date"] += 1

    # 删除源里已不存在的旧 PID
    for path in OUT_EXP.glob("hw-exp-cf-P*.md"):
        if path.name not in keep:
            path.unlink()
            stats["updated"] += 1
    return stats


def write_indexes(items: List[dict]) -> None:
    problems = []
    for e in sorted(items, key=lambda x: int(x["pid"][1:])):
        problems.append(
            {
                "id": e["pid"],
                "pid": e["pid"][1:],
                "title": e["title"],
                "category": e["category"],
                "tags": build_tags(e["category"], e["role"], e["title"]),
                "roles": [e["role"]],
                "stages": ["interview"],
                "source_url": e["url"],
                "published_at": e["published_at"] or "",
            }
        )

    index = {
        "version": 2,
        "problemset": {
            "title": "华为校招&实习面经手撕题库",
            "url": "https://codefun2000.com/problemset/hwmj",
        },
        "description": "CodeFun2000 hwmj 题库索引；source_url 供 Agent 输出可点击链接",
        "problems": problems,
    }
    OUT_INDEX.parent.mkdir(parents=True, exist_ok=True)
    OUT_INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    by_cat: Dict[str, list] = {}
    for e in items:
        by_cat.setdefault(e["category"], []).append(
            {
                "pid": e["pid"],
                "title": e["title"],
                "url": e["url"],
                "role": e["role"],
                "published_at": e["published_at"] or "",
            }
        )
    for lst in by_cat.values():
        lst.sort(key=lambda x: int(x["pid"][1:]))

    catalog = {
        "psid": "673c9c7139f40f849bfbda7c",
        "slug": "hwmj",
        "name": "华为面经",
        "introduction": "22至26年期间华为校招&实习面经题库",
        "total_problems": len(items),
        "have_access": True,
        "problemset_url": "https://codefun2000.com/problemset/hwmj",
        "categories": by_cat,
    }
    OUT_CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    items = collect_source_items()
    if not items:
        print("未找到任何题目", file=sys.stderr)
        return 1

    stats = write_experiences(items)
    write_indexes(items)

    from collections import Counter

    role_counts = Counter(i["role"] for i in items)
    cat_counts = Counter(i["category"] for i in items)
    print(f"[hwmj] synced {len(items)} experiences -> {OUT_EXP.relative_to(ROOT)}")
    print(f"  created={stats['created']} updated={stats['updated']} with_date={stats['with_date']} no_date={stats['no_date']}")
    print(f"  by category: {dict(cat_counts)}")
    print(f"  by role: {dict(role_counts)}")

    no_date = [i["pid"] for i in items if not i["published_at"]]
    if no_date:
        print(f"  WARN no date parsed: {no_date}")

    # 抽样打印
    for i in items[:5]:
        print(f"  sample {i['pid']} | {i['published_at'] or '????-??-??'} | {i['role']} | {i['title'][:60]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
