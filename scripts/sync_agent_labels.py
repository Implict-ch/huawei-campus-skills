#!/usr/bin/env python3
"""按正文重算 AI 大类「Agent」标签，并修正标题含 AI 却归错岗位的语义条目。

规则：
  - 仅当正文/标题出现 agent / agents / ai agent / multi-agent / 智能体 / 多智能体 时打上 Agent
  - 标题含 AI（如 AI软开）的文档，semantic tags 的 role 改为 ai
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from build_experience_index import title_implies_ai  # noqa: E402

TAGS_JSON = ROOT / "frontend" / "public" / "experience_semantic_tags.json"
EXP_JSON = ROOT / "frontend" / "public" / "experiences.json"

AGENT_RE = re.compile(
    r"(?i)(?:\bagents?\b|ai\s*agent|multi[-\s]?agent|智能体|多智能体)"
)


def strip_frontmatter(raw: str) -> str:
    if raw.startswith("---"):
        end = raw.find("---", 3)
        if end >= 0:
            return raw[end + 3 :]
    return raw


def main() -> None:
    tags = json.loads(TAGS_JSON.read_text(encoding="utf-8"))
    docs = tags.get("docs") or {}
    exp = json.loads(EXP_JSON.read_text(encoding="utf-8"))
    by_id = {x["id"]: x for x in exp.get("all") or []}

    added = removed = role_fixed = scanned = 0

    for eid, row in docs.items():
        item = by_id.get(eid)
        path = ROOT / (item.get("filePath") if item else "")
        title = (item or {}).get("title") or ""
        body = ""
        if item and path.exists():
            body = strip_frontmatter(path.read_text(encoding="utf-8", errors="ignore"))
        text = f"{title}\n{body}"

        # 标题含 AI → 语义条目归入 ai
        if title and title_implies_ai(title) and row.get("role") != "ai":
            row["role"] = "ai"
            role_fixed += 1

        labels = list(row.get("labels") or [])
        has_agent = bool(AGENT_RE.search(text))
        had = "Agent" in labels

        if row.get("role") == "ai":
            scanned += 1
            if has_agent and not had:
                labels.append("Agent")
                added += 1
            elif not has_agent and had:
                labels = [x for x in labels if x != "Agent"]
                removed += 1
        else:
            # 非 AI 岗不应带 Agent
            if had:
                labels = [x for x in labels if x != "Agent"]
                removed += 1

        row["labels"] = labels
        docs[eid] = row

    tags["docs"] = docs
    tags["generatedAt"] = datetime.now().isoformat(timespec="seconds")
    tags["method"] = tags.get("method") or "llm_multilabel"
    tags["note"] = "Agent labels synced by sync_agent_labels.py (keyword mention only)"
    TAGS_JSON.write_text(json.dumps(tags, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"scanned_ai={scanned} agent_added={added} agent_removed={removed} "
        f"role_fixed_to_ai={role_fixed} -> {TAGS_JSON}"
    )


if __name__ == "__main__":
    main()
