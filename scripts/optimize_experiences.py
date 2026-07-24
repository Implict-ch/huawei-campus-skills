#!/usr/bin/env python3
"""
Optimize experience corpus: on contradictory policy claims, keep newest & delete older files.

Also: dedupe by source URL, drop policy-primary stale posts, drop too-short remnants.

Usage:
  python scripts/optimize_experiences.py           # dry-run
  python scripts/optimize_experiences.py --apply
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"

MIN_BODY_CHARS = 180

# Canonical 2026 policy lives in knowledge/exam/ — experiences must not contradict it.
CONTRADICTIONS = [
    {
        "topic": "exam_dev_scoring",
        "old": re.compile(
            r"100\s*[/、,]\s*200\s*[/、,]\s*300"
            r"|\(\s*100\s+200\s+300\s*\)"
            r"|100\s+200\s+300"
            r"|100/200/300"
            r"|100分.*200分.*300分",
            re.I,
        ),
        "new": re.compile(
            r"150\s*[+＋、,，]\s*150\s*[+＋、,]\s*300"
            r"|150分、150分、300分"
            r"|分值改为150分、150分、300分",
            re.I,
        ),
    },
    {
        "topic": "exam_pass_line_low",
        "old": re.compile(
            r"(?<![\d])(150)\s*分?\s*通过"
            r"|150分机考通过"
            r"|150\s*通过(?!\s*线统一)"
            r"|180\s*分?\s*通过",
            re.I,
        ),
        "new": re.compile(
            r"200\s*分?\s*通过"
            r"|通过线统一改成200"
            r"|通过线.*200\s*分",
            re.I,
        ),
    },
]

POLICY_DISCLAIMER = re.compile(
    r"\n> \*\*政策提示\*\*：上文若曾提及旧机考分值.*?\n",
    re.S,
)

STALE_ANY = re.compile(
    r"100/200/300|100\s+200\s+300|600分150分通过|150\s*分?\s*通过|180\s*分?\s*通过",
    re.I,
)

CURRENT_ANY = re.compile(
    r"150\s*[+＋、,，]\s*150\s*[+＋、,]\s*300|通过线统一改成200|200\s*分?\s*通过",
    re.I,
)


@dataclass
class ExpDoc:
    path: Path
    body: str
    front: str
    source_url: str = ""
    date: datetime = field(default_factory=lambda: datetime(2020, 1, 1, tzinfo=timezone.utc))
    claims_old: set[str] = field(default_factory=set)
    claims_new: set[str] = field(default_factory=set)


def parse_frontmatter(text: str) -> tuple[str, str]:
    m = re.match(r"(?s)(---\n.*?\n---\n)(.*)", text)
    if not m:
        return "", text
    return m.group(1), m.group(2)


def note_id_to_date(note_id: str) -> datetime | None:
    if not re.fullmatch(r"[0-9a-f]{24}", note_id, re.I):
        return None
    ts = int(note_id[:8], 16)
    if ts < 1_000_000_000 or ts > 4_000_000_000:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def body_for_analysis(body: str) -> str:
    return POLICY_DISCLAIMER.sub("", body)


def extract_date(path: Path, front: str, body: str) -> datetime:
    candidates: list[datetime] = []
    name = path.name

    m = re.search(r"published_at:\s*(\d{4}-\d{2}-\d{2})", front)
    if m:
        candidates.append(datetime.strptime(m.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc))

    m = re.search(r"note_id:\s*[\"']?([0-9a-f]{24})", front, re.I)
    if m:
        d = note_id_to_date(m.group(1))
        if d:
            candidates.append(d)

    # 牛客/小红书 id 中的日期段现为平台发帖日（20260720 批量入库前的旧文件已 rename_experience_ids 修正）
    if "-nc-" not in name and "-xhs-" not in name:
        m = re.match(r"hw-exp-(\d{8})-", name)
        if m:
            try:
                candidates.append(datetime.strptime(m.group(1), "%Y%m%d").replace(tzinfo=timezone.utc))
            except ValueError:
                pass

    m = re.search(r"nowcoder\.com/discuss/(\d+)", front + body)
    if m:
        discuss_id = int(m.group(1))
        # 相对排序：id 越大通常越新（非精确日历）
        base = datetime(2016, 1, 1, tzinfo=timezone.utc)
        candidates.append(base + __import__("datetime").timedelta(seconds=min(discuss_id // 1000, 400_000_000)))

    for y in re.findall(r"(20[2-3]\d)\s*年", body):
        candidates.append(datetime(int(y), 6, 1, tzinfo=timezone.utc))
    for y in re.findall(r"(20[2-3]\d)-(\d{2})-\d{2}", body):
        candidates.append(datetime(int(y[0]), int(y[1]), 15, tzinfo=timezone.utc))

    if candidates:
        return max(candidates)
    # 无信号的旧帖默认偏早，便于被 2026 政策帖覆盖
    return datetime(2019, 1, 1, tzinfo=timezone.utc)


def extract_url(front: str, body: str) -> str:
    for blob in (front, body):
        m = re.search(r"url:\s*[\"']?(https://[^\"'\s]+)", blob)
        if m:
            return m.group(1).split("?")[0].rstrip("/")
        m = re.search(r"\]\((https://[^)]+)\)", blob)
        if m:
            return m.group(1).split("?")[0].rstrip("/")
    return ""


def load_docs() -> list[ExpDoc]:
    docs: list[ExpDoc] = []
    for path in sorted(EXP_DIR.rglob("hw-exp-*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        front, body = parse_frontmatter(text)
        doc = ExpDoc(
            path=path,
            front=front,
            body=body,
            source_url=extract_url(front, body),
            date=extract_date(path, front, body),
        )
        analyzed = body_for_analysis(body)
        for rule in CONTRADICTIONS:
            if rule["old"].search(analyzed) and not rule["new"].search(analyzed):
                doc.claims_old.add(rule["topic"])
            if rule["new"].search(analyzed):
                doc.claims_new.add(rule["topic"])
        docs.append(doc)
    return docs


def technique_score(body: str) -> int:
    """Higher = more interview/technique value; policy-only posts score low."""
    analyzed = body_for_analysis(body)
    keywords = re.findall(
        r"手撕|项目|一面|二面|主管|算法|DFS|BFS|DP|排序|测评|简历|面试官|"
        r"八股|代码|笔试题|面经|反问|offer|实习|树状数组|最短路|逆序对|真题",
        analyzed,
        re.I,
    )
    policy = len(STALE_ANY.findall(analyzed)) + len(CURRENT_ANY.findall(analyzed))
    text_len = len(re.sub(r"\s+", "", analyzed))
    return text_len // 4 + len(keywords) * 8 - policy * 15


def choose_deletions(docs: list[ExpDoc]) -> tuple[set[Path], dict[str, str]]:
    to_delete: set[Path] = set()
    reasons: dict[str, str] = {}

    by_url: dict[str, list[ExpDoc]] = {}
    for d in docs:
        if d.source_url:
            by_url.setdefault(d.source_url, []).append(d)

    for url, group in by_url.items():
        if len(group) < 2:
            continue
        group.sort(key=lambda x: x.date, reverse=True)
        keeper = group[0]
        for dup in group[1:]:
            to_delete.add(dup.path)
            reasons[str(dup.path)] = f"duplicate url → keep {keeper.path.name}"

    for rule in CONTRADICTIONS:
        topic = rule["topic"]
        old_docs = [d for d in docs if topic in d.claims_old and d.path not in to_delete]
        new_docs = [d for d in docs if topic in d.claims_new and d.path not in to_delete]
        if not new_docs:
            continue
        newest_new = max(new_docs, key=lambda x: x.date)
        for d in old_docs:
            if d.date >= newest_new.date:
                continue
            if technique_score(body_for_analysis(d.body)) >= 55:
                continue  # 保留高价值技巧面经，即使含历史政策一句
            to_delete.add(d.path)
            reasons[str(d.path)] = (
                f"contradiction:{topic} older than {newest_new.path.name} "
                f"({d.date.date()} vs {newest_new.date.date()})"
            )

    # Global: if corpus has 2026 current policy, drop remaining stale-policy-primary files
    has_2026_current = any(
        d.date.year >= 2026 and CURRENT_ANY.search(body_for_analysis(d.body))
        for d in docs
        if d.path not in to_delete
    )
    if has_2026_current:
        for d in docs:
            if d.path in to_delete:
                continue
            analyzed = body_for_analysis(d.body)
            if not STALE_ANY.search(analyzed):
                continue
            if CURRENT_ANY.search(analyzed):
                continue
            if technique_score(d.body) < 35:
                to_delete.add(d.path)
                reasons[str(d.path)] = "stale policy, low technique value, superseded by 2026 posts"

    for d in docs:
        if d.path in to_delete:
            continue
        if d.path.parent.name == "platform":
            continue  # CodeFun2000 A 级面经保留（多为追问清单）
        if "真题" in d.body or "考点标签" in d.body:
            continue
        plain = re.sub(r"\s+", "", body_for_analysis(d.body))
        if len(plain) < MIN_BODY_CHARS:
            to_delete.add(d.path)
            reasons[str(d.path)] = f"body too short ({len(plain)} chars)"

    return to_delete, reasons


def cleanup_remaining(docs: list[ExpDoc], deleted: set[Path], apply: bool) -> int:
    """Remove orphan policy disclaimers; normalize blank lines."""
    n = 0
    for d in docs:
        if d.path in deleted:
            continue
        new_body = POLICY_DISCLAIMER.sub("\n", d.body)
        new_body = re.sub(r"\n{3,}", "\n\n", new_body).strip() + "\n"
        if new_body != d.body:
            n += 1
            if apply:
                d.path.write_text(d.front + new_body, encoding="utf-8")
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    docs = load_docs()
    to_delete, reasons = choose_deletions(docs)

    print(f"Total experiences: {len(docs)}")
    print(f"To delete: {len(to_delete)}")
    for p in sorted(to_delete)[:30]:
        print(f"  - {p.name}: {reasons.get(str(p), '?')}")
    if len(to_delete) > 30:
        print(f"  ... and {len(to_delete) - 30} more")

    if args.apply:
        for p in to_delete:
            if p.exists():
                p.unlink()
        cleaned = cleanup_remaining(docs, to_delete, True)
        print(f"Cleaned disclaimers in {cleaned} files")
        print(f"Remaining: {len(list(EXP_DIR.rglob('hw-exp-*.md')))}")
    else:
        print("Dry-run. Re-run with --apply to delete.", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
