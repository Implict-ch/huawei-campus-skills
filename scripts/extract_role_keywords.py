#!/usr/bin/env python3
"""生成「筛选侧边栏要显示哪些标签」的列表。

优先读 LLM 打标结果（experience_semantic_tags.json），统计每个岗位出现过的标签；
如果还没有打标结果，才退回旧的「正文词频统计」逻辑。

正常情况你只要跑打标脚本即可（它会顺带写出 keywords）：
  python scripts/llm_tag_experiences.py

本脚本用于：已经有 semantic_tags，只想重新汇总侧边栏列表时。
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import List

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from role_label_taxonomy import (  # noqa: E402
    PERIOD_LABELS,
    ROLE_LABEL_ALIASES,
    ROLE_LABEL_TAXONOMY,
    label_group,
)

EXP_JSON = ROOT / "frontend" / "public" / "experiences.json"
# LLM 打标结果（优先用这个）
TAGS_JSON = ROOT / "frontend" / "public" / "experience_semantic_tags.json"
# 输出：后端/前端读取的关键词列表
OUT_JSON = ROOT / "frontend" / "public" / "experience_keywords.json"


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# 侧栏始终展示的额外标签（即使当前 0 篇命中）
ALWAYS_SHOW_LABELS = {
    "ai": ["Agent"],
}


def ensure_period_keywords(out: dict) -> dict:
    """每个岗位侧栏固定包含「实习」「校招」，并排在最前。"""
    for role in list(out.keys()):
        by_kw = {x["keyword"]: x for x in out[role]}
        period = []
        for lab in PERIOD_LABELS:
            if lab in by_kw:
                period.append(by_kw[lab])
            else:
                period.append(
                    {
                        "keyword": lab,
                        "group": label_group(role, lab),
                        "aliases": ROLE_LABEL_ALIASES.get(role, {}).get(lab, [lab.lower()]),
                    }
                )
        # 固定额外标签（如 AI 方向的 Agent）插在时期之后、其它之前
        fixed = []
        for lab in ALWAYS_SHOW_LABELS.get(role, []):
            if lab in PERIOD_LABELS:
                continue
            if lab in by_kw:
                fixed.append(by_kw[lab])
            else:
                fixed.append(
                    {
                        "keyword": lab,
                        "group": label_group(role, lab),
                        "aliases": ROLE_LABEL_ALIASES.get(role, {}).get(lab, [lab.lower()]),
                    }
                )
        skip = set(PERIOD_LABELS) | set(ALWAYS_SHOW_LABELS.get(role, []))
        others = [x for x in out[role] if x["keyword"] not in skip]
        out[role] = period + fixed + others
    return out


def from_semantic_tags() -> dict | None:
    """从 LLM 打标结果汇总：哪个岗位出现过哪些标签。"""
    if not TAGS_JSON.exists():
        return None
    data = load_json(TAGS_JSON)
    docs = data.get("docs") or {}
    if not docs:
        return None

    # 统计：每个岗位下，每个标签被贴了多少次
    role_counter: dict[str, Counter] = defaultdict(Counter)
    for _eid, row in docs.items():
        role = row.get("role") or ""
        if role not in ROLE_LABEL_TAXONOMY:
            continue
        for lab in row.get("labels") or []:
            if lab in ROLE_LABEL_TAXONOMY[role]:
                role_counter[role][lab] += 1

    out = {}
    for role, taxonomy in ROLE_LABEL_TAXONOMY.items():
        c = role_counter.get(role, Counter())
        order = {k: i for i, k in enumerate(taxonomy.keys())}
        # 至少出现 1 次就放进侧边栏
        items = [{"keyword": lab, "count": cnt} for lab, cnt in c.items() if cnt >= 1]
        items.sort(key=lambda x: (-x["count"], order.get(x["keyword"], 999)))
        out[role] = [
            {
                "keyword": x["keyword"],
                "group": label_group(role, x["keyword"]),
                # aliases 留给「无语义标签时」的字面匹配兜底用
                "aliases": ROLE_LABEL_ALIASES.get(role, {}).get(x["keyword"], [x["keyword"].lower()]),
            }
            for x in items
        ]
        print(f"{role}: {[x['keyword'] for x in items]} (semantic)")
    return ensure_period_keywords(out)


def clean_text(text: str) -> str:
    """清洗正文（仅旧词频逻辑用）。"""
    text = re.sub(r"!?\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"[#*\-`|\[\]()]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def count_keyword(text: str, aliases: List[str]) -> int:
    """在正文里数某个标签（及其别名）出现了几次（仅旧词频逻辑用）。"""
    text_lower = text.lower()
    count = 0
    for alias in aliases:
        a = alias.lower()
        if re.fullmatch(r"[a-z0-9+#./]+", a) and len(a) <= 4:
            count += len(re.findall(rf"(?<![a-z0-9]){re.escape(a)}(?![a-z0-9])", text_lower))
        else:
            count += text_lower.count(a)
    return count


def from_frequency() -> dict:
    """旧逻辑：没有 LLM 打标结果时，用正文「撞词次数」决定显示哪些标签。"""
    data = load_json(EXP_JSON)
    grouped = data.get("grouped", {})
    role_texts = defaultdict(str)
    for role, items in grouped.items():
        if role not in ROLE_LABEL_TAXONOMY:
            continue
        for item in items:
            path = ROOT / item.get("filePath", "")
            if not path.exists():
                continue
            try:
                raw = path.read_text(encoding="utf-8")
                content = re.sub(r"^---\s*\n.*?---\s*\n", "", raw, flags=re.DOTALL)
                text = clean_text((item.get("title") or "") + "\n" + content)
                role_texts[role] += "\n" + text
            except Exception as e:
                print(f"[skip] {path}: {e}")

    keywords_by_role = {}
    for role, taxonomy in ROLE_LABEL_TAXONOMY.items():
        text = role_texts.get(role, "")
        aliases_map = ROLE_LABEL_ALIASES.get(role, {})
        scores = []
        for keyword in taxonomy.keys():
            aliases = aliases_map.get(keyword, [keyword.lower()])
            score = count_keyword(text, aliases)
            if score >= 2:
                scores.append({"keyword": keyword, "aliases": aliases, "score": score})
        scores.sort(key=lambda x: -x["score"])
        keywords_by_role[role] = [
            {
                "keyword": x["keyword"],
                "group": label_group(role, x["keyword"]),
                "aliases": x["aliases"],
            }
            for x in scores
        ]
        print(f"{role}: {[x['keyword'] for x in scores]} (frequency)")
    return ensure_period_keywords(keywords_by_role)


def main():
    # 优先语义打标结果；没有才词频
    result = from_semantic_tags()
    if result is None:
        print("[keywords] semantic tags missing, fallback to frequency")
        result = from_frequency()
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"saved {OUT_JSON}")


if __name__ == "__main__":
    main()
