#!/usr/bin/env python3
"""Sync canonical knowledge into both installable skills.

Canonical: skills/hw-ask/knowledge/
Mirror:    skills/hw-interview/knowledge/
Agents:    .agents/skills/hw-ask/knowledge/ + SKILL.md

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
AGENTS_HW_ASK = ROOT / ".agents" / "skills" / "hw-ask"
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


def copy_tree(src: Path, dst: Path) -> None:
    if dst.is_symlink() or dst.exists():
        if dst.is_symlink() or dst.is_file():
            dst.unlink()
        else:
            shutil.rmtree(dst)
    shutil.copytree(src, dst, symlinks=True)


def sync_mirror(*, dry_run: bool) -> None:
    if not CANONICAL.is_dir():
        raise SystemExit(f"[error] canonical knowledge missing: {CANONICAL}")

    targets = [
        ("hw-interview/knowledge", MIRROR),
        (".agents/skills/hw-ask/knowledge", AGENTS_HW_ASK / "knowledge"),
    ]
    for label, target in targets:
        print(f"[info] sync {CANONICAL} -> {target}")
        if dry_run:
            print("    (dry-run, skipped)")
            continue
        copy_tree(CANONICAL, target)
        print(f"[ok] {label} mirrored")

    skill_src = ROOT / "skills" / "hw-ask" / "SKILL.md"
    skill_dst = AGENTS_HW_ASK / "SKILL.md"
    if skill_src.is_file() and not dry_run:
        AGENTS_HW_ASK.mkdir(parents=True, exist_ok=True)
        shutil.copy2(skill_src, skill_dst)
        print("[ok] .agents/skills/hw-ask/SKILL.md updated")


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
