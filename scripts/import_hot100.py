#!/usr/bin/env python3
"""Import 面试手撕 Hot100 folder into knowledge/coding-problems/hot100/ and build index.json."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "面试手撕hot100"
DST = ROOT / "knowledge" / "coding-problems" / "hot100"
INDEX_PATH = DST / "index.json"

TITLE_RE = re.compile(r"^\[([^\]]+)\]")


def extract_title(statement: str) -> str:
    first = statement.strip().splitlines()[0] if statement.strip() else ""
    m = TITLE_RE.match(first.strip())
    if m:
        return m.group(1).strip()
    return first.strip() or "（无标题）"


def main() -> int:
    if not SRC.is_dir():
        print(f"[error] source not found: {SRC}", flush=True)
        return 1

    if DST.exists():
        shutil.rmtree(DST)
    shutil.copytree(SRC, DST)

    problems = []
    for url_file in sorted(DST.rglob("网址.txt")):
        chapter = url_file.parent.parent.name
        pid_dir = url_file.parent.name
        if not pid_dir.startswith("P"):
            continue
        pid = pid_dir[1:]
        source_url = url_file.read_text(encoding="utf-8").strip()
        stmt_path = url_file.parent / "题面.md"
        title = pid_dir
        if stmt_path.exists():
            title = extract_title(stmt_path.read_text(encoding="utf-8"))

        rel_stmt = stmt_path.relative_to(ROOT).as_posix()
        problems.append(
            {
                "id": pid_dir,
                "pid": pid,
                "chapter": chapter,
                "title": title,
                "tags": [chapter],
                "source_url": source_url,
                "statement_path": rel_stmt,
            }
        )

    problems.sort(key=lambda p: (p["chapter"], int(p["pid"])))

    index = {
        "version": 1,
        "title": "面试手撕 Hot100",
        "description": "华为校招技术面手撕练习索引；/hw-match 推荐手撕题仅从此清单选取链接",
        "problem_count": len(problems),
        "problems": problems,
    }
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[done] imported {len(problems)} problems -> {INDEX_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
