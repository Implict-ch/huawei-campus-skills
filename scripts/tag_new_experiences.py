#!/usr/bin/env python3
"""只给尚未打标的新面经自动分配关键词。

用法（面经入库后执行）：
  python scripts/tag_new_experiences.py

本质是调用 llm_tag_experiences.py 的增量模式（有缓存则跳过旧文）。
新增关键词后若要让旧文也挂上新标签，请改跑：
  python scripts/llm_tag_experiences.py --force
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    cmd = [sys.executable, str(ROOT / "scripts" / "llm_tag_experiences.py")]
    print("[tag-new] running incremental LLM tagging...")
    return subprocess.call(cmd, cwd=str(ROOT))


if __name__ == "__main__":
    raise SystemExit(main())
