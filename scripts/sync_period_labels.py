#!/usr/bin/env python3
"""为已有语义标签补齐互斥的「时期」标签（实习 / 校招）。

判定规则（按用户要求）：
- 「校招」：标题/正文出现 秋招 / 春招 / 校招 / 应届 / 校园招聘 / xx届 等
- 「实习」：标题/正文出现明确实习语义（暑期实习 / 寒假实习 / 日常实习 / 实习生 /
  实习岗 / 实习面 等）；单独「暑期」「日常」需结合实习语境
- 两者冲突时：标题侧校招信号优先于实习；标题侧明确暑期实习则归实习
- 都未命中时默认「校招」
- 一篇面经最多一个时期标签

用法:
  python scripts/sync_period_labels.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from role_label_taxonomy import PERIOD_LABELS, enforce_period_mutex  # noqa: E402

TAGS_JSON = ROOT / "frontend" / "public" / "experience_semantic_tags.json"
EXP_JSON = ROOT / "frontend" / "public" / "experiences.json"

# 校招：明确校招季/应届语义（标题出现这些时绝不能算实习）
CAMPUS_RE = re.compile(
    r"秋招|春招|校招|校园招聘|应届生|应届|"
    r"(?<!\d)(?:2[0-9])届|(?:20(?:2[0-9]|1[0-9]))届",
    re.I,
)

# 实习：必须是明确实习语义，避免简历「实习经历」误伤可再收紧
INTERN_RE = re.compile(
    r"暑期实习|寒假实习|日常实习|实习生|实习岗|实习面|实习offer|"
    r"实习面试|实习投递|实习入职|实习hc|实习名额|"
    r"(?:暑期|寒假|日常)\s*实习",
    re.I,
)

# 较弱但可用的实习信号（仅在无校招信号时启用）
INTERN_SOFT_RE = re.compile(r"(?<![a-zA-Z\u4e00-\u9fff])实习(?![a-zA-Z\u4e00-\u9fff经历经验项目])", re.I)


def infer_period(title: str, body: str = "") -> str:
    title = title or ""
    body = body or ""
    text = f"{title}\n{body}"

    title_campus = bool(CAMPUS_RE.search(title))
    title_intern = bool(INTERN_RE.search(title))
    text_campus = bool(CAMPUS_RE.search(text))
    text_intern = bool(INTERN_RE.search(text))
    text_intern_soft = bool(INTERN_SOFT_RE.search(text))

    # 标题明确校招 → 校招（即使正文提到实习经历）
    if title_campus and not title_intern:
        return "校招"
    # 标题明确暑期/日常实习 → 实习
    if title_intern and not title_campus:
        return "实习"
    # 标题同时有：校招优先（秋招里提到暑期实习也先归校招；极少见）
    if title_campus and title_intern:
        return "校招"

    # 正文：有校招信号且无强实习信号 → 校招
    if text_campus and not text_intern:
        return "校招"
    # 正文：有强实习信号且无校招信号 → 实习
    if text_intern and not text_campus:
        return "实习"
    # 正文冲突：校招优先（用户要求秋招/春招/校招类必须是校招）
    if text_campus and text_intern:
        return "校招"
    # 仅有弱「实习」字样、无校招 → 实习
    if text_intern_soft and not text_campus:
        return "实习"

    return "校招"


def load_text_map() -> dict[str, tuple[str, str]]:
    """id -> (title, body snippet)"""
    out = {}
    if not EXP_JSON.exists():
        return out
    data = json.loads(EXP_JSON.read_text(encoding="utf-8"))
    for _role, items in (data.get("grouped") or {}).items():
        for it in items:
            eid = it.get("id")
            if not eid:
                continue
            title = it.get("title") or ""
            body = ""
            path = ROOT / (it.get("filePath") or "")
            if path.exists():
                try:
                    raw = path.read_text(encoding="utf-8")
                    body = re.sub(r"^---\s*\n.*?---\s*\n", "", raw, count=1, flags=re.S)[:6000]
                except Exception:
                    body = ""
            out[eid] = (title, body)
    return out


def main() -> int:
    if not TAGS_JSON.exists():
        print(f"[error] missing {TAGS_JSON}")
        return 1

    data = json.loads(TAGS_JSON.read_text(encoding="utf-8"))
    docs = data.get("docs") or {}
    texts = load_text_map()

    changed = 0
    counts = {"实习": 0, "校招": 0}
    # 抽样校验：标题含秋招却被标实习的数量
    bad_intern = []
    for eid, row in docs.items():
        labels = list(row.get("labels") or [])
        labels = [x for x in labels if x not in PERIOD_LABELS]
        title, body = texts.get(eid, (eid, ""))
        period = infer_period(title, body)
        labels.append(period)
        labels = enforce_period_mutex(labels)
        # 互斥：若误带两个，enforce 会留实习；这里强制校招优先
        if "实习" in labels and "校招" in labels:
            labels = [x for x in labels if x != "实习"]
        if labels != (row.get("labels") or []):
            changed += 1
        row["labels"] = labels
        counts[period] = counts.get(period, 0) + 1
        if period == "实习" and CAMPUS_RE.search(title or ""):
            bad_intern.append(title)

    data["docs"] = docs
    TAGS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[period] updated docs={len(docs)} changed={changed} 实习={counts['实习']} 校招={counts['校招']}")
    print(f"[period] title-campus-but-intern={len(bad_intern)}")
    if bad_intern[:5]:
        print("[period] samples:", bad_intern[:5])
    print(f"[period] saved -> {TAGS_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
