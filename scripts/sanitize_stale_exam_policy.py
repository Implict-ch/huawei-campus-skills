#!/usr/bin/env python3
"""
Remove or redact outdated exam *policy* from experiences (100/200/300, 150 pass, etc.).
Keeps technique/interview content. Canonical policy lives in knowledge/exam/*.md (2026).

Usage:
  python scripts/sanitize_stale_exam_policy.py          # dry-run
  python scripts/sanitize_stale_exam_policy.py --apply
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"

# Whole-file policy FAQ duplicates (content merged into knowledge/exam/)
DELETE_IDS = {
    "hw-exp-20250716-faq-26-campus",
    "hw-exp-20250714-campus-recruit",
}

STALE_POLICY = re.compile(
    r"100\s*[/、,]\s*200\s*[/、,]\s*300"
    r"|\(\s*100\s+200\s+300\s*\)"
    r"|100\s+200\s+300"
    r"|100\s*\+\s*200\s*\+\s*300"
    r"|100\s*[,，]\s*200\s*[,，]\s*300"
    r"|100分.*200分.*300分"
    r"|600\s*分\s*[\(（]?\s*100\s*200\s*300"
    r"|600分150分通过"
    r"|150\s*分?\s*通过"
    r"|180\s*分?\s*通过"
    r"|150分机考通过"
    r"|150\s*通过",
    re.I,
)

CURRENT_POLICY = re.compile(
    r"150\s*[+＋、,，]\s*150\s*[+＋、,]\s*300"
    r"|150分、150分、300分"
    r"|2026.*200\s*分"
    r"|通过线统一改成200",
    re.I,
)

POLICY_SECTION = re.compile(
    r"^##?\s*(机考|机试|笔试|分值|通过线|考试形式)\s*$",
    re.M | re.I,
)


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[。！？\n])", text)
    return [p for p in parts if p.strip()]


def sentence_has_stale_policy(s: str) -> bool:
    if CURRENT_POLICY.search(s):
        return False
    return bool(STALE_POLICY.search(s))


INLINE_STALE = [
    re.compile(r"机考满分600\s*[\(（]?\s*100\s+200\s+300\s*[\)）]?[^。\n]*", re.I),
    re.compile(r"第一题100分[^。\n]*第三题300分[^。\n]*", re.I),
    re.compile(r"HW机考\s*100/200/300[^。\n]*", re.I),
    re.compile(r"HR说100分就给过[^。\n，；]*[，；]?", re.I),
    re.compile(r"分别100,200,300分[^。\n]*", re.I),
    re.compile(r"600分150分通过[^。\n，；]*", re.I),
]


def redact_body(body: str) -> tuple[str, int]:
    removed = 0
    text = body
    for pat in INLINE_STALE:
        text, n = pat.subn("", text)
        removed += n

    out: list[str] = []
    for sent in split_sentences(text):
        if sent.strip().startswith("> **政策提示**"):
            out.append(sent)
            continue
        if sentence_has_stale_policy(sent):
            removed += 1
            continue
        out.append(sent)
    return "".join(out), removed


def is_policy_primary(body: str) -> bool:
    """Mostly exam scoring FAQ with little else."""
    if len(body) > 1200:
        return False
    stale_hits = len(STALE_POLICY.findall(body))
    if stale_hits == 0:
        return False
    technique = len(re.findall(r"手撕|项目|一面|二面|主管|排序|DFS|DP|测评技巧|骗分", body, re.I))
    return stale_hits >= 2 and technique <= 1


def process_file(path: Path, apply: bool) -> str:
    stem_id = path.stem
    if stem_id in DELETE_IDS:
        if apply and path.exists():
            path.unlink()
        return "delete"

    text = path.read_text(encoding="utf-8", errors="replace")
    m = re.match(r"(?s)(---\n.*?\n---\n)(.*)", text)
    if not m:
        return "skip"
    front, body = m.group(1), m.group(2)

    if not STALE_POLICY.search(body):
        return "ok"

    if is_policy_primary(body):
        if apply and path.exists():
            path.unlink()
        return "delete-primary"

    new_body, n = redact_body(body)
    if n == 0:
        return "ok"

    note = (
        "\n> **政策提示**：上文若曾提及旧机考分值（如 100/200/300、150 分通过），"
        "均已失效；现行规则见 `knowledge/exam/exam-format.md`（2026）。\n"
    )
    if note.strip() not in new_body:
        new_body = new_body.rstrip() + note

    if apply:
        path.write_text(front + new_body, encoding="utf-8")
    return f"redact:{n}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    stats: dict[str, int] = {}
    for path in sorted(EXP_DIR.rglob("hw-exp-*.md")):
        result = process_file(path, args.apply)
        stats[result] = stats.get(result, 0) + 1

    mode = "APPLIED" if args.apply else "DRY-RUN"
    print(f"[{mode}] {stats}")
    if not args.apply and any(k != "ok" and k != "skip" for k in stats):
        print("Re-run with --apply to write changes.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
