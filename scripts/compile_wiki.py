#!/usr/bin/env python3
"""
Deterministic wiki compiler: aggregate raw experiences into knowledge/wiki/compiled/.

Usage:
  python scripts/compile_wiki.py           # incremental
  python scripts/compile_wiki.py --force   # rebuild all topics
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"
OUT_DIR = ROOT / "knowledge" / "wiki" / "compiled"
MANIFEST_PATH = ROOT / "knowledge" / ".compile-manifest.json"

TITLE_RE = re.compile(r"^#\s+(.+)", re.M)
PUBLISHED_RE = re.compile(r"published_at:\s*(\d{4}-\d{2}-\d{2})")
STAGE_RE = re.compile(r"^stage:\s*(\S+)", re.M)
TAGS_RE = re.compile(r"^tags:\s*\[(.*?)\]", re.M)
ID_RE = re.compile(r"^id:\s*(\S+)", re.M)


@dataclass
class Topic:
    slug: str
    stage: str
    keywords: list[str]
    body_patterns: list[re.Pattern[str]]
    title: str
    question_type: str = "process"


@dataclass
class ExpRecord:
    path: Path
    exp_id: str
    title: str
    stage: str
    tags: list[str]
    published: str
    body: str
    text_lower: str


TOPICS: list[Topic] = [
    Topic(
        "wiki-exam-mechanics",
        "exam",
        ["机考", "笔试", "ACM", "编程", "分值", "通过线", "150", "300", "600", "OJ"],
        [
            re.compile(r".{0,80}(机考|笔试|ACM|编程题|通过线|150|300|600|分值).{0,120}", re.I),
        ],
        "机考机制与分值（面经聚合）",
    ),
    Topic(
        "wiki-exam-after-passing",
        "exam",
        ["机考通过", "笔试通过", "面试通知", "后续", "没消息", "沉默"],
        [
            re.compile(r".{0,60}(机考|笔试).{0,40}(通过|过了).{0,80}", re.I),
            re.compile(r".{0,80}(面试通知|没消息|沉默|多久).{0,80}", re.I),
        ],
        "机考通过后的流程（面经聚合）",
    ),
    Topic(
        "wiki-exam-prep",
        "exam",
        ["备考", "刷题", "准备", "七天上岸", "牛客", "练习"],
        [
            re.compile(r".{0,80}(备考|刷题|准备|练习|牛客).{0,100}", re.I),
        ],
        "机考备考（面经聚合）",
    ),
    Topic(
        "wiki-exam-pitfalls",
        "exam",
        ["坑", "骗分", "切屏", "违规", "挂", "注意事项"],
        [
            re.compile(r".{0,80}(坑|骗分|切屏|违规|注意事项|别).{0,100}", re.I),
        ],
        "机考常见坑（面经聚合）",
    ),
    Topic(
        "wiki-dual-camera",
        "exam",
        ["双机位", "摄像头", "监考", "手机", "第二机位"],
        [
            re.compile(r".{0,80}(双机位|摄像头|监考|第二机位|手机架).{0,100}", re.I),
        ],
        "双机位与监考（面经聚合）",
    ),
    Topic(
        "wiki-assessment",
        "assessment",
        ["测评", "性格", "心理", "SHL", "北森"],
        [
            re.compile(r".{0,80}(测评|性格|心理|SHL|北森).{0,100}", re.I),
        ],
        "测评（面经聚合）",
        "process",
    ),
    Topic(
        "wiki-interview-tech",
        "interview",
        ["技术面", "手撕", "算法", "项目", "一面", "二面"],
        [
            re.compile(r".{0,80}(技术面|手撕|算法|项目深挖|一面|二面).{0,100}", re.I),
        ],
        "技术面（面经聚合）",
    ),
    Topic(
        "wiki-interview-manager",
        "interview",
        ["主管", "HR面", "综合面", "终面", "业务主管"],
        [
            re.compile(r".{0,80}(主管|HR面|综合面|终面|业务主管).{0,100}", re.I),
        ],
        "主管 / HR 面（面经聚合）",
    ),
    Topic(
        "wiki-application",
        "application",
        ["投递", "内推", "志愿", "官网", "简历"],
        [
            re.compile(r".{0,80}(投递|内推|志愿|官网|简历).{0,100}", re.I),
        ],
        "投递（面经聚合）",
    ),
    Topic(
        "wiki-offer",
        "offer",
        ["offer", "意向", "开奖", "OC", "录用"],
        [
            re.compile(r".{0,80}(offer|意向|开奖|OC|录用).{0,100}", re.I),
        ],
        "Offer（面经聚合）",
    ),
]


def parse_frontmatter(text: str) -> tuple[str, str]:
    m = re.match(r"(?s)(---\n.*?\n---\n)(.*)", text)
    if not m:
        return "", text
    return m.group(1), m.group(2)


def parse_tags(raw: str) -> list[str]:
    if not raw:
        return []
    return [t.strip().strip('"').strip("'") for t in raw.split(",") if t.strip()]


def load_experiences() -> list[ExpRecord]:
    records: list[ExpRecord] = []
    for path in sorted(EXP_DIR.glob("hw-exp-*-nc-*.md")) + sorted(
        EXP_DIR.glob("hw-exp-*-xhs-*.md")
    ):
        text = path.read_text(encoding="utf-8")
        _, body = parse_frontmatter(text)
        front = text[: len(text) - len(body)] if body else text
        title_m = TITLE_RE.search(body)
        title = title_m.group(1).strip() if title_m else path.stem
        pub_m = PUBLISHED_RE.search(front)
        published = pub_m.group(1) if pub_m else ""
        stage_m = STAGE_RE.search(front)
        stage = stage_m.group(1) if stage_m else "general"
        tags_m = TAGS_RE.search(front)
        tags = parse_tags(tags_m.group(1)) if tags_m else []
        id_m = ID_RE.search(front)
        exp_id = id_m.group(1) if id_m else path.stem
        records.append(
            ExpRecord(
                path=path,
                exp_id=exp_id,
                title=title,
                stage=stage,
                tags=tags,
                published=published,
                body=body,
                text_lower=(title + "\n" + body).lower(),
            )
        )
    return records


def matches_topic(exp: ExpRecord, topic: Topic) -> bool:
    hay = exp.text_lower
    kw_hit = sum(1 for k in topic.keywords if k.lower() in hay)
    if exp.stage == topic.stage and kw_hit >= 1:
        return True
    if kw_hit >= 2:
        return True
    for pat in topic.body_patterns:
        if pat.search(exp.body):
            return True
    return False


def extract_snippets(exps: list[ExpRecord], topic: Topic, limit: int = 25) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for exp in exps:
        for line in exp.body.splitlines():
            line = line.strip()
            if len(line) < 12 or len(line) > 220:
                continue
            if line.startswith("#") or line.startswith("- 作者") or line.startswith("- 来源"):
                continue
            if not any(p.search(line) for p in topic.body_patterns):
                if not any(k.lower() in line.lower() for k in topic.keywords[:6]):
                    continue
            norm = re.sub(r"\s+", " ", line)
            if norm in seen:
                continue
            seen.add(norm)
            out.append(norm)
            if len(out) >= limit:
                return out
    return out


def topic_source_hash(exps: list[ExpRecord]) -> str:
    h = hashlib.sha256()
    for exp in sorted(exps, key=lambda e: e.path.name):
        h.update(exp.path.name.encode())
        h.update(exp.body.encode("utf-8", errors="replace"))
    return h.hexdigest()


def render_topic(topic: Topic, exps: list[ExpRecord], source_hash: str) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    grade = "B" if len(exps) >= 3 else "C"
    years = Counter(e.published[:4] for e in exps if e.published)
    tag_counts = Counter(t for e in exps for t in e.tags)
    snippets = extract_snippets(exps, topic)
    recent = sorted(
        exps,
        key=lambda e: e.published or "0000",
        reverse=True,
    )[:15]

    year_lines = "\n".join(
        f"- {y}：{c} 篇" for y, c in sorted(years.items(), reverse=True) if y
    ) or "- （无 published_at）"

    tag_lines = "\n".join(
        f"- {t}（{c}）" for t, c in tag_counts.most_common(10)
    ) or "- （无 tags）"

    snippet_lines = "\n".join(f"- {s}" for s in snippets) or "- （无匹配摘录）"

    index_lines = "\n".join(
        f"- `{e.exp_id}` — {e.title}" + (f"（{e.published}）" if e.published else "")
        for e in recent
    )

    keywords_yaml = ", ".join(topic.keywords[:8])
    return f"""---
id: {topic.slug}
kind: compiled_wiki
compile_source: experiences
stage: {topic.stage}
question_type: {topic.question_type}
roles: [general]
source_grade: {grade}
source_count: {len(exps)}
source_hash: {source_hash}
keywords: [{keywords_yaml}]
compiled_at: {now}
---

# {topic.title}

> 由 `compile_wiki.py` 从 {len(exps)} 篇牛客/小红书面经确定性聚合；**政策口径以 `knowledge/exam/` 精编卡片为准**。

## 统计

{year_lines}

## 高频标签

{tag_lines}

## 摘录要点

{snippet_lines}

## 近期面经索引

{index_lines}
"""


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {"topics": {}}


def save_manifest(data: dict) -> None:
    MANIFEST_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_package_manifest(records: list[ExpRecord]) -> None:
    pkg_path = ROOT / "knowledge" / ".manifest.json"
    nc = sum(1 for r in records if "-nc-" in r.path.name)
    xhs = sum(1 for r in records if "-xhs-" in r.path.name)
    platform = len(list((EXP_DIR / "platform").glob("hw-exp-*.md"))) if (EXP_DIR / "platform").exists() else 0
    exam_cards = len(list((ROOT / "knowledge" / "exam").glob("*.md")))
    wiki_topics = len(list(OUT_DIR.glob("*.md"))) if OUT_DIR.exists() else 0
    segments = len(list((ROOT / "knowledge" / "videos" / "segments").glob("*.md"))) if (ROOT / "knowledge" / "videos" / "segments").exists() else 0
    hot100 = len(list((ROOT / "knowledge" / "coding-problems" / "hot100").rglob("题面.md")))

    git_commit = ""
    try:
        import subprocess

        git_commit = (
            subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=ROOT,
                stderr=subprocess.DEVNULL,
            )
            .decode()
            .strip()
        )
    except Exception:
        pass

    data = {
        "package": "hw-campus-skills",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "git_commit": git_commit,
        "counts": {
            "experiences_nowcoder": nc,
            "experiences_xiaohongshu": xhs,
            "experiences_platform": platform,
            "wiki_compiled_topics": wiki_topics,
            "exam_cards": exam_cards,
            "video_segments": segments,
            "hot100_problems": hot100,
        },
    }
    pkg_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[manifest] {pkg_path.relative_to(ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compile experience corpus into wiki cards")
    parser.add_argument("--force", action="store_true", help="Rebuild all topics")
    args = parser.parse_args()

    records = load_experiences()
    if not records:
        print("[warn] no experiences found", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    topics_state = manifest.setdefault("topics", {})
    updated = 0
    skipped = 0

    for topic in TOPICS:
        matched = [e for e in records if matches_topic(e, topic)]
        sh = topic_source_hash(matched)
        prev = topics_state.get(topic.slug, {})
        if not args.force and prev.get("source_hash") == sh and prev.get("source_count") == len(matched):
            skipped += 1
            continue

        out_path = OUT_DIR / f"{topic.slug}.md"
        out_path.write_text(render_topic(topic, matched, sh), encoding="utf-8")
        topics_state[topic.slug] = {
            "source_hash": sh,
            "source_count": len(matched),
            "compiled_at": datetime.now(timezone.utc).isoformat(),
            "output": str(out_path.relative_to(ROOT)).replace("\\", "/"),
        }
        updated += 1
        print(f"[compile] {topic.slug}: {len(matched)} sources -> {out_path.name}")

    manifest["compiled_at"] = datetime.now(timezone.utc).isoformat()
    save_manifest(manifest)
    write_package_manifest(records)
    print(f"[done] updated={updated} skipped={skipped} total_experiences={len(records)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
