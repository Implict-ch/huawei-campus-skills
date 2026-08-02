#!/usr/bin/env python3
"""Sync canonical knowledge into both installable skills.

Canonical: skills/hw-ask/knowledge/
Mirror:    skills/hw-interview/knowledge/
Compat:    ./knowledge -> skills/hw-ask/knowledge (symlink)

Run after editing the knowledge pack, and before release / npx publish checks:
  python scripts/sync_skill_knowledge.py
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANONICAL = ROOT / "skills" / "hw-ask" / "knowledge"
MIRROR = ROOT / "skills" / "hw-interview" / "knowledge"
COMPAT_LINK = ROOT / "knowledge"


def ensure_compat_link() -> None:
    target = Path("skills/hw-ask/knowledge")
    if COMPAT_LINK.is_symlink():
        if os.readlink(COMPAT_LINK) == str(target):
            return
        COMPAT_LINK.unlink()
    elif COMPAT_LINK.exists():
        raise SystemExit(
            f"[error] {COMPAT_LINK} exists and is not a symlink; "
            "refuse to overwrite. Move/remove it first."
        )
    COMPAT_LINK.symlink_to(target)
    print(f"[ok] compat link {COMPAT_LINK} -> {target}")


def sync_mirror(*, dry_run: bool) -> None:
    if not CANONICAL.is_dir():
        raise SystemExit(f"[error] canonical knowledge missing: {CANONICAL}")

    print(f"[info] sync {CANONICAL} -> {MIRROR}")
    if dry_run:
        print("    (dry-run, skipped)")
        return

    if MIRROR.is_symlink() or MIRROR.exists():
        if MIRROR.is_symlink() or MIRROR.is_file():
            MIRROR.unlink()
        else:
            shutil.rmtree(MIRROR)

    shutil.copytree(CANONICAL, MIRROR, symlinks=True)
    print("[ok] hw-interview/knowledge mirrored")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync skill-bundled knowledge pack")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sync_mirror(dry_run=args.dry_run)
    if not args.dry_run:
        ensure_compat_link()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
