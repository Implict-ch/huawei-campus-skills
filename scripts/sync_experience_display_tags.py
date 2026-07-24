#!/usr/bin/env python3
"""把面经卡片/详情页展示的 tags，统一改成 LLM 语义标签（与筛选关键词一致）。

会改两处：
  1. knowledge/experiences/**/*.md 的 frontmatter tags
  2. frontend/public/experiences.json（若存在则就地覆盖）

用法:
  python scripts/sync_experience_display_tags.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from role_label_taxonomy import ROLE_LABEL_TAXONOMY  # noqa: E402

TAGS_JSON = ROOT / "frontend" / "public" / "experience_semantic_tags.json"
EXP_JSON = ROOT / "frontend" / "public" / "experiences.json"
EXP_DIR = ROOT / "knowledge" / "experiences"

# 这些是旧的无区分度展示词，一律不允许再出现在卡片上
BLOCKLIST = {
    "校招",
    "实习",
    "机考",
    "面试",
    "流程",
    "测评",
    "推荐",
    "论文",
    "华为",
    "小红书",
    "CodeFun2000",
    "其他",
    "AI大类",
    "通用软件开发",
    "嵌入式软件",
    "通信 / 网络",
    "通信",
    "算法",
}


def allowed_for_role(role: str) -> set[str]:
    return set(ROLE_LABEL_TAXONOMY.get(role, {}).keys())


def normalize_labels(role: str, labels: list) -> list[str]:
    allow = allowed_for_role(role)
    out: list[str] = []
    seen = set()
    for lab in labels or []:
        s = str(lab).strip()
        if not s or s in BLOCKLIST or s in seen:
            continue
        if allow and s not in allow:
            continue
        seen.add(s)
        out.append(s)
    return out


def load_semantic() -> dict[str, list[str]]:
    if not TAGS_JSON.exists():
        raise FileNotFoundError(f"缺少语义标签文件: {TAGS_JSON}")
    data = json.loads(TAGS_JSON.read_text(encoding="utf-8"))
    docs = data.get("docs") or {}
    out = {}
    for eid, row in docs.items():
        role = row.get("role") or ""
        out[eid] = normalize_labels(role, row.get("labels") or [])
    return out


TAGS_LINE_RE = re.compile(r"^tags:\s*.+$", re.M)


def update_md(path: Path, labels: list[str]) -> bool:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return False
    end = text.find("---", 3)
    if end < 0:
        return False
    fm = text[3:end]
    body = text[end:]
    tags_json = json.dumps(labels, ensure_ascii=False)
    if TAGS_LINE_RE.search(fm):
        new_fm = TAGS_LINE_RE.sub(f"tags: {tags_json}", fm, count=1)
    else:
        # 没有 tags 行就插在 frontmatter 末尾
        new_fm = fm.rstrip() + f"\ntags: {tags_json}\n"
    new_text = "---" + new_fm + body
    if new_text == text:
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def update_experiences_json(semantic: dict[str, list[str]]) -> int:
    if not EXP_JSON.exists():
        return 0
    data = json.loads(EXP_JSON.read_text(encoding="utf-8"))
    changed = 0

    def patch_item(item: dict) -> None:
        nonlocal changed
        eid = item.get("id")
        if not eid:
            return
        role = item.get("role") or ""
        if eid in semantic:
            new_tags = semantic[eid]
        else:
            new_tags = normalize_labels(role, item.get("tags") or [])
        if item.get("tags") != new_tags:
            item["tags"] = new_tags
            changed += 1

    for item in data.get("all") or []:
        patch_item(item)
    for items in (data.get("grouped") or {}).values():
        for item in items:
            patch_item(item)

    EXP_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


def main() -> None:
    semantic = load_semantic()
    md_changed = 0
    md_total = 0
    empty = 0

    for path in sorted(EXP_DIR.rglob("hw-exp-*.md")):
        if any(p.name.startswith("_") or p.name.startswith(".") for p in path.relative_to(EXP_DIR).parents):
            continue
        md_total += 1
        # 从 frontmatter 取 id
        text = path.read_text(encoding="utf-8")
        m = re.search(r"^id:\s*(\S+)", text, re.M)
        eid = m.group(1).strip().strip('"').strip("'") if m else path.stem
        labels = semantic.get(eid, [])
        if not labels:
            empty += 1
        if update_md(path, labels):
            md_changed += 1

    json_changed = update_experiences_json(semantic)
    print(f"[sync-tags] md total={md_total}, updated={md_changed}, empty_labels={empty}")
    print(f"[sync-tags] experiences.json items updated={json_changed}")
    print(f"[sync-tags] semantic docs={len(semantic)}")


if __name__ == "__main__":
    main()
