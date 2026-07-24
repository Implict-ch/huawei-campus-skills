#!/usr/bin/env python3
"""Normalize whitespace in all experience markdown files."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "knowledge" / "experiences"
SENTENCE_END = re.compile(r"[.。!！?？…」』\"'）)]$")
HEADING = re.compile(r"^#{1,6}\s")
SECTION = re.compile(
    r"^(笔试|测评|机考|一面|二面|三面|四面|主管面|专业面|HR面|终面|"
    r"[一二三四]面（[^）]+）|[一二三四]面)$"
)
META = re.compile(r"^- (作者|来源|分类)：")


def split_frontmatter(text: str) -> tuple[str, str]:
    if not text.startswith("---"):
        return "", text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return "", text
    return f"---{parts[1]}---", parts[2]


def normalize_line(line: str) -> str:
    line = line.replace("\t", " ")
    line = re.sub(r"\s+", " ", line.strip())
    return line


def is_question_line(line: str) -> bool:
    if line.startswith("手撕"):
        return True
    if "?" in line or "？" in line:
        return True
    if re.match(r"^\d+[、.)]", line):
        return True
    if re.match(r"^(讲下|写一个|介绍|描述|说说)", line):
        return True
    return False


def is_paragraph_line(line: str) -> bool:
    if len(line) >= 72:
        return True
    if line.count("。") >= 1 or line.count(". ") >= 1:
        return True
    if line.startswith("部门：") or line.startswith("【"):
        return True
    return False


def clean_body(body: str) -> str:
    lines = [normalize_line(l) for l in body.splitlines()]
    lines = [l for l in lines if l]

    out: list[str] = []
    in_interview = False
    seen_header_block = False

    for line in lines:
        if line.startswith("# ") and not seen_header_block:
            out.append(line)
            continue
        if META.match(line):
            if out and out[-1].startswith("# "):
                out.append("")
            out.append(line)
            if line.startswith("- 来源："):
                seen_header_block = True
            continue

        if HEADING.match(line):
            if out and out[-1] != "":
                out.append("")
            out.append(line)
            in_interview = "面" in line
            continue

        if SECTION.match(line):
            if out and out[-1] != "":
                out.append("")
            out.append(f"## {line}")
            in_interview = "面" in line
            continue

        if not seen_header_block:
            out.append(line)
            continue

        # first line after meta: optional title repeat -> skip duplicate of # title
        if (
            len(out) >= 3
            and out[0].startswith("# ")
            and line == out[0][2:].strip()
            and not any(l.startswith("##") for l in out)
        ):
            if out[-1] != "":
                out.append("")
            out.append(line)
            continue

        if in_interview:
            if (
                is_paragraph_line(line)
                and not is_question_line(line)
                and not line.startswith("手撕")
            ):
                if out and out[-1] != "":
                    out.append("")
                out.append(line)
            else:
                out.append(f"- {line.lstrip('- ')}")
            continue

        if out and out[-1] != "":
            prev = out[-1]
            need_blank = (
                HEADING.match(line)
                or SECTION.match(line)
                or (SENTENCE_END.search(prev) and not prev.startswith("- "))
                or (prev.startswith("- ") and not line.startswith("- ") and is_paragraph_line(line))
                or (is_paragraph_line(prev) and is_paragraph_line(line) and SENTENCE_END.search(prev))
            )
            if need_blank and out[-1] != "":
                out.append("")
        out.append(line)

    while out and out[0] == "":
        out.pop(0)
    while out and out[-1] == "":
        out.pop()

    return "\n".join(out) + "\n"


def clean_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    fm, body = split_frontmatter(original)
    if not fm:
        return False
    cleaned_body = clean_body(body)
    new_text = fm.rstrip() + "\n\n" + cleaned_body.lstrip("\n")
    if not new_text.endswith("\n"):
        new_text += "\n"
    if new_text == original:
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def main() -> int:
    files = sorted(ROOT.rglob("hw-exp-*.md"))
    changed = sum(1 for p in files if clean_file(p))
    print(f"Cleaned {changed} / {len(files)} experience files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
