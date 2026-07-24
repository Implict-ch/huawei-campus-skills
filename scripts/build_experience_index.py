#!/usr/bin/env python3
"""Build a browsable index for all experience posts in knowledge/experiences/."""
from __future__ import annotations

import json
import re
import argparse
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"
OUT_DIR = EXP_DIR / "_index"  # generated index pages
INDEX_PATH = EXP_DIR / "index.json"

TITLE_RE = re.compile(r"^#\s+(.+)", re.M)
DATE_RE = re.compile(r"hw-exp-(\d{4})(\d{2})(\d{2})-(nc|xhs)-")


def extract_summary(body: str, max_len: int = 240) -> str:
    """Return first non-empty line of body stripped of markdown links."""
    for line in body.splitlines():
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("---"):
            line = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", line)
            line = re.sub(r"[-*]\s+", "", line)
            if line:
                return line[:max_len] if len(line) > max_len else line
    return ""


def title_implies_ai(title: str) -> bool:
    """标题含 AI（如 AI软开）优先归入 AI 大类。"""
    t = (title or "").lower()
    if any(
        k in t
        for k in (
            "人工智能",
            "大模型",
            "机器学习",
            "深度学习",
            "计算机视觉",
            "nlp",
            "智能驾驶",
            "自动驾驶",
        )
    ):
        return True
    if re.search(r"(?:^|[^a-z0-9])ai(?:[^a-z0-9]|$)", t):
        return True
    if any(k in t for k in ("ai软开", "ai软件", "ai岗", "ai算法", "ai工程师", "ai应用", "ai方向")):
        return True
    return False


def infer_role(fm: dict, title: str, body: str) -> str:
    """Infer role from frontmatter / tags / title / body."""
    if title_implies_ai(title):
        return "ai"

    role = fm.get("role")
    if role:
        return role

    tags = [t.lower() for t in (fm.get("tags") or [])]
    text = (title + "\n" + body).lower()

    # Direct tag/category mapping
    if any(k in tags for k in ("通用软件开发", "软开", "开发", "java", "c++", "后端", "前端")):
        return "software-development"
    if any(k in tags for k in ("ai", "算法", "机器学习", "深度学习", "人工智能", "计算机视觉")):
        return "ai"
    if any(k in tags for k in ("嵌入式", "硬件", "qemu")):
        return "embedded"
    if any(k in tags for k in ("测试", "测开")):
        return "test-qa"
    if any(k in tags for k in ("通信", "网络", "5g")):
        return "network-communication"

    cat = (fm.get("category") or "").lower()
    if "通用软件开发" in cat or "软开" in cat:
        return "software-development"
    if "算法" in cat or "ai" in cat:
        return "ai"
    if "嵌入式" in cat or "硬件" in cat:
        return "embedded"
    if "测试" in cat:
        return "test-qa"
    if "通信" in cat or "网络" in cat:
        return "network-communication"

    # Title-only heuristics (stronger signal for short titles)
    title_lower = title.lower()
    if any(k in title_lower for k in ("通用软件", "通软", "软件开发", "软件工程师", "java", "c++", "前端", "后端", "spring boot", "资料开发", "计算产品线", "消费者bg", "安全岗", "云计算", "云直播", "终端软件", "软件部")):
        return "software-development"
    if any(k in title_lower for k in ("ai", "算法", "机器学习", "深度学习", "人工智能", "计算机视觉", "nlp", "大模型", "智能驾驶", "自动驾驶")):
        return "ai"
    if any(k in title_lower for k in ("嵌入式", "嵌软", "硬件", "芯片", "fpga", "基带", "射频", "车bu", "车 bu", "单板", "海思", "qemu")):
        return "embedded"
    if any(k in title_lower for k in ("测试", "测开", "验证")):
        return "test-qa"
    if any(k in title_lower for k in ("通信", "网络", "5g", "无线", "核心网", "光产品", "数通", "基带", "ict", "gts")):
        return "network-communication"

    # Body heuristics (broader)
    if any(k in text for k in ("软开", "软件开发", "通用软件", "c++", "java", "后端", "前端", "spring boot")):
        return "software-development"
    if any(k in text for k in ("ai", "算法", "机器学习", "深度学习", "计算机视觉", "nlp")):
        return "ai"
    if any(k in text for k in ("嵌入式", "硬件", "fpga", "芯片", "基带", "射频", "车bu")):
        return "embedded"
    if any(k in text for k in ("测试", "测开", "验证")):
        return "test-qa"
    if any(k in text for k in ("通信", "网络", "5g", "无线", "核心网", "数通")):
        return "network-communication"

    return "general"


def parse_file(path: Path) -> dict[str, Any] | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None
    end = text.find("---", 3)
    if end < 0:
        return None
    try:
        fm = yaml.safe_load(text[3:end]) or {}
    except Exception:
        return None

    body = text[end + 3 :].strip()
    title = ""
    m = TITLE_RE.search(body)
    if m:
        title = m.group(1).strip()
    if not title:
        title = fm.get("id") or path.stem

    # Date fallback
    published = fm.get("published_at") or ""
    if isinstance(published, datetime):
        published = published.strftime("%Y-%m-%d")
    elif hasattr(published, "year") and hasattr(published, "month") and hasattr(published, "day"):
        # date object
        published = f"{published.year:04d}-{published.month:02d}-{published.day:02d}"
    else:
        published = str(published) if published else ""

    if not published:
        m = DATE_RE.search(path.name)
        if m:
            published = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
        else:
            published = ""

    year = quarter = month = ""
    if published:
        try:
            dt = datetime.strptime(published[:10], "%Y-%m-%d")
            year = str(dt.year)
            month = f"{dt.month:02d}"
            quarter = f"Q{(dt.month - 1) // 3 + 1}"
        except ValueError:
            pass

    sources = fm.get("sources") or []
    platform = ""
    url = ""
    if sources:
        platform = sources[0].get("platform", "")
        url = sources[0].get("url", "")

    stage = fm.get("stage") or "general"
    role = infer_role(fm, title, body)
    tags = fm.get("tags") or []
    category = fm.get("category") or ""

    return {
        "id": fm.get("id") or path.stem,
        "title": title,
        "platform": platform,
        "stage": stage,
        "role": role,
        "category": category,
        "published_at": published,
        "year": year,
        "quarter": quarter,
        "month": month if year else "",
        "tags": tags,
        "url": url,
        "summary": extract_summary(body),
        "path": path.relative_to(ROOT).as_posix(),
        "source_grade": fm.get("source_grade") or "C",
    }


def build_index() -> dict[str, Any]:
    records: list[dict] = []
    for path in sorted(EXP_DIR.rglob("hw-exp-*.md")):
        # Skip archived/filtered/backup posts and generated index pages
        rel_parents = list(path.relative_to(EXP_DIR).parents)
        if any(p.name.startswith("_") or p.name.startswith(".") for p in rel_parents):
            continue
        rec = parse_file(path)
        if rec:
            records.append(rec)

    # Aggregations
    by_year = defaultdict(list)
    by_role = defaultdict(list)
    by_stage = defaultdict(list)
    by_platform = defaultdict(list)
    by_tag = defaultdict(list)
    by_year_month = defaultdict(list)

    for rec in records:
        if rec["year"]:
            by_year[rec["year"]].append(rec["id"])
            if rec["month"]:
                by_year_month[f"{rec['year']}-{rec['month']}"].append(rec["id"])
        by_role[rec["role"]].append(rec["id"])
        by_stage[rec["stage"]].append(rec["id"])
        by_platform[rec["platform"] or "unknown"].append(rec["id"])
        for t in rec["tags"]:
            by_tag[t].append(rec["id"])

    return {
        "generated_at": datetime.now().isoformat(),
        "total": len(records),
        "counts": {
            "by_year": {k: len(v) for k, v in sorted(by_year.items(), reverse=True)},
            "by_role": {k: len(v) for k, v in sorted(by_role.items())},
            "by_stage": {k: len(v) for k, v in sorted(by_stage.items())},
            "by_platform": {k: len(v) for k, v in sorted(by_platform.items())},
            "by_tag": {k: len(v) for k, v in sorted(by_tag.items(), key=lambda x: -len(x[1]))[:30]},
        },
        "indexes": {
            "by_year": {k: v for k, v in sorted(by_year.items(), reverse=True)},
            "by_year_month": {k: v for k, v in sorted(by_year_month.items(), reverse=True)},
            "by_role": {k: v for k, v in sorted(by_role.items())},
            "by_stage": {k: v for k, v in sorted(by_stage.items())},
            "by_platform": {k: v for k, v in sorted(by_platform.items())},
            "by_tag": {k: v for k, v in sorted(by_tag.items(), key=lambda x: -len(x[1]))},
        },
        "experiences": records,
    }


def write_nav_readme(index: dict[str, Any]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = index["total"]
    counts = index["counts"]

    lines = [
        "# 面经索引",
        "",
        f"共收录 **{total}** 篇华为校招面经，按以下维度分类。",
        "",
        "## 按时间",
        "",
    ]
    for y, c in counts["by_year"].items():
        lines.append(f"- [{y} 年](by-year/{y}.md) — {c} 篇")
    lines += [
        "",
        "## 按岗位",
        "",
    ]
    role_names = {
        "software-development": "软件开发",
        "ai": "AI / 算法",
        "embedded": "嵌入式 / 硬件",
        "general": "通用 / 未明确",
    }
    for r, c in counts["by_role"].items():
        lines.append(f"- [{role_names.get(r, r)}](by-role/{r}.md) — {c} 篇")
    lines += [
        "",
        "## 按阶段",
        "",
    ]
    stage_names = {
        "exam": "机考 / 笔试",
        "interview": "面试",
        "assessment": "测评",
        "application": "投递 / 简历",
        "offer": "Offer / 开奖",
        "general": "通用 / 综合",
    }
    for s, c in counts["by_stage"].items():
        lines.append(f"- [{stage_names.get(s, s)}](by-stage/{s}.md) — {c} 篇")
    lines += [
        "",
        "## 按平台",
        "",
    ]
    platform_names = {
        "nowcoder": "牛客",
        "xiaohongshu": "小红书",
        "codefun2000": "CodeFun2000 站内",
    }
    for p, c in counts["by_platform"].items():
        lines.append(f"- [{platform_names.get(p, p)}](by-platform/{p}.md) — {c} 篇")
    lines += [
        "",
        "## 数据文件",
        "",
        "- [index.json](../index.json) — 网页可直接读取的完整 JSON 数据源",
    ]
    (OUT_DIR / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_category_pages(index: dict[str, Any]) -> None:
    records = {r["id"]: r for r in index["experiences"]}
    role_names = {
        "software-development": "软件开发",
        "ai": "AI / 算法",
        "embedded": "嵌入式 / 硬件",
        "general": "通用 / 未明确",
    }
    stage_names = {
        "exam": "机考 / 笔试",
        "interview": "面试",
        "assessment": "测评",
        "application": "投递 / 简历",
        "offer": "Offer / 开奖",
        "general": "通用 / 综合",
    }
    platform_names = {
        "nowcoder": "牛客",
        "xiaohongshu": "小红书",
        "codefun2000": "CodeFun2000 站内",
    }

    # By year
    (OUT_DIR / "by-year").mkdir(parents=True, exist_ok=True)
    for year, ids in index["indexes"]["by_year"].items():
        lines = [f"# {year} 年面经", "", f"共 {len(ids)} 篇。", ""]
        for rid in ids:
            r = records[rid]
            lines.append(f"- [{r['title']}](../{r['path']}) — {r['published_at']} — {r['stage']}")
        (OUT_DIR / "by-year" / f"{year}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # By role
    (OUT_DIR / "by-role").mkdir(parents=True, exist_ok=True)
    for role, ids in index["indexes"]["by_role"].items():
        name = role_names.get(role, role)
        lines = [f"# {name}", "", f"共 {len(ids)} 篇。", ""]
        for rid in ids:
            r = records[rid]
            lines.append(f"- [{r['title']}](../{r['path']}) — {r['published_at']}")
        (OUT_DIR / "by-role" / f"{role}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # By stage
    (OUT_DIR / "by-stage").mkdir(parents=True, exist_ok=True)
    for stage, ids in index["indexes"]["by_stage"].items():
        name = stage_names.get(stage, stage)
        lines = [f"# {name}", "", f"共 {len(ids)} 篇。", ""]
        for rid in ids:
            r = records[rid]
            lines.append(f"- [{r['title']}](../{r['path']}) — {r['published_at']}")
        (OUT_DIR / "by-stage" / f"{stage}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # By platform
    (OUT_DIR / "by-platform").mkdir(parents=True, exist_ok=True)
    for platform, ids in index["indexes"]["by_platform"].items():
        name = platform_names.get(platform, platform)
        lines = [f"# {name}", "", f"共 {len(ids)} 篇。", ""]
        for rid in ids:
            r = records[rid]
            lines.append(f"- [{r['title']}](../{r['path']}) — {r['published_at']}")
        (OUT_DIR / "by-platform" / f"{platform}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build experience post index")
    parser.add_argument("--write-pages", action="store_true", help="Also write category Markdown pages")
    args = parser.parse_args()

    index = build_index()
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[index] {INDEX_PATH.relative_to(ROOT)} — {index['total']} posts")

    if args.write_pages:
        write_nav_readme(index)
        write_category_pages(index)
        print(f"[pages] {OUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
