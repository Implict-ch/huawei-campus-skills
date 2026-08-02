#!/usr/bin/env python3
"""
Knowledge pack update orchestrator (modes A/B/C).

Customer (default):
  python scripts/hw_update.py
  python scripts/hw_update.py --mode customer

Maintainer / CI:
  python scripts/hw_update.py --mode maintainer
  python scripts/hw_update.py --mode maintainer --skip-ingest   # compile + manifest only
  python scripts/hw_update.py --mode maintainer --dry-run
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "knowledge" / ".manifest.json"

MAINTAINER_STEPS: list[list[str]] = [
    [sys.executable, "scripts/ingest_nowcoder.py"],
    [sys.executable, "scripts/filter_quality.py"],
    [sys.executable, "scripts/filter_campus_only.py"],
    [sys.executable, "scripts/filter_dead_links.py"],
    [sys.executable, "scripts/clean_experience_blanks.py"],
    [sys.executable, "scripts/optimize_experiences.py", "--apply"],
    [sys.executable, "scripts/compile_wiki.py"],
    [sys.executable, "scripts/sync_skill_knowledge.py"],
    [sys.executable, "scripts/verify_skill_pack.py"],
]


def run_step(cmd: list[str], dry_run: bool) -> int:
    rel = " ".join(Path(c).name if i == 0 and c.endswith(".py") else c for i, c in enumerate(cmd))
    print(f"\n>>> {' '.join(cmd)}")
    if dry_run:
        print("    (dry-run, skipped)")
        return 0
    proc = subprocess.run(cmd, cwd=ROOT)
    if proc.returncode != 0:
        print(f"[error] step failed: {rel}", file=sys.stderr)
    return proc.returncode


def git_pull(dry_run: bool) -> int:
    print("\n>>> git pull --ff-only")
    if dry_run:
        print("    (dry-run, skipped)")
        return 0
    try:
        proc = subprocess.run(
            ["git", "pull", "--ff-only"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        print("[warn] git not found; read knowledge/.manifest.json for version info")
        return 0
    print(proc.stdout or proc.stderr)
    return proc.returncode


def print_manifest() -> None:
    if not MANIFEST.exists():
        print("[info] no knowledge/.manifest.json yet; maintainer should run compile_wiki.py")
        return
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    print("\n--- knowledge pack ---")
    print(f"generated_at: {data.get('generated_at')}")
    print(f"git_commit:   {data.get('git_commit') or '(n/a)'}")
    counts = data.get("counts", {})
    for k, v in counts.items():
        print(f"  {k}: {v}")


def customer_update(dry_run: bool) -> int:
    code = git_pull(dry_run)
    print_manifest()
    return code


def maintainer_update(dry_run: bool, skip_ingest: bool) -> int:
    steps = MAINTAINER_STEPS
    if skip_ingest:
        steps = steps[-1:]  # compile_wiki only (also writes .manifest.json)

    for cmd in steps:
        code = run_step(cmd, dry_run)
        if code != 0:
            return code

    print_manifest()
    print(f"\n[done] maintainer update at {datetime.now(timezone.utc).isoformat()}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Update hw-campus-skills knowledge pack")
    parser.add_argument(
        "--mode",
        choices=["customer", "maintainer"],
        default="customer",
        help="customer=git pull; maintainer=ingest+filter+compile",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--skip-ingest",
        action="store_true",
        help="maintainer: only run compile_wiki (skip nowcoder ingest/filters)",
    )
    args = parser.parse_args()

    if args.mode == "customer":
        return customer_update(args.dry_run)
    return maintainer_update(args.dry_run, args.skip_ingest)


if __name__ == "__main__":
    raise SystemExit(main())
