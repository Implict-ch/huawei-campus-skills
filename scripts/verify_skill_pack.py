#!/usr/bin/env python3
"""Verify that npx-installable skills each carry a usable knowledge pack."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_SKILLS = ("hw-ask", "hw-interview")
REQUIRED_REL_PATHS = (
    "knowledge/taxonomy.yaml",
    "knowledge/exam/exam-format.md",
    "knowledge/exam/exam-overview.md",
    "knowledge/assessment/assessment-overview.md",
    "knowledge/assessment/assessment-practice-simulator.md",
    "knowledge/experiences/index.json",
    "knowledge/experiences/platform/README.md",
    "knowledge/coding-problems/hot100/index.json",
    "knowledge/coding-problems/hw-exam/index.json",
    "knowledge/coding-problems/hw-exam/stats.json",
    "knowledge/coding-problems/hw-exam/exam-problem-stats.md",
    "knowledge/coding-problems/hw-exam/choice-question-index.json",
    "knowledge/coding-problems/hw-exam/choice-no-leak.md",
    "knowledge/wiki/compiled/wiki-application.md",
)


def check_skill(name: str) -> list[str]:
    errors: list[str] = []
    skill_dir = ROOT / "skills" / name
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        errors.append(f"{name}: missing SKILL.md")
        return errors

    for rel in REQUIRED_REL_PATHS:
        path = skill_dir / rel
        if not path.exists():
            errors.append(f"{name}: missing {rel}")

    hot100 = skill_dir / "knowledge/coding-problems/hot100/index.json"
    if hot100.is_file():
        try:
            data = json.loads(hot100.read_text(encoding="utf-8"))
            problems = data.get("problems") or []
            if not problems:
                errors.append(f"{name}: hot100 index has no problems")
            else:
                sample = problems[0].get("statement_path")
                if sample:
                    # statement_path is repo/skill-relative like knowledge/...
                    stmt = skill_dir / sample
                    if not stmt.is_file():
                        errors.append(
                            f"{name}: hot100 statement_path not readable from skill root: {sample}"
                        )
        except json.JSONDecodeError as exc:
            errors.append(f"{name}: hot100 index invalid JSON: {exc}")

    hw_exam = skill_dir / "knowledge/coding-problems/hw-exam"
    if hw_exam.is_dir():
        leaked = list(hw_exam.rglob("题面.md"))
        if leaked:
            errors.append(
                f"{name}: hw-exam must not contain 题面.md "
                f"({len(leaked)} file(s); metadata-only pack)"
            )
        choice_idx = hw_exam / "choice-question-index.json"
        choice_no_leak = hw_exam / "choice-no-leak.md"
        if not choice_idx.is_file():
            errors.append(f"{name}: missing choice-question-index.json in hw-exam")
        if not choice_no_leak.is_file():
            errors.append(f"{name}: missing choice-no-leak.md in hw-exam")
        stats_path = hw_exam / "stats.json"
        if stats_path.is_file():
            try:
                stats_data = json.loads(stats_path.read_text(encoding="utf-8"))
                for key in (
                    "choice_bank_tag1_counts",
                    "choice_bank_tag2_stats",
                    "choice_bank_representatives",
                ):
                    if key not in stats_data:
                        errors.append(f"{name}: stats.json missing {key}")
            except json.JSONDecodeError as exc:
                errors.append(f"{name}: stats.json invalid JSON: {exc}")
        if choice_idx.is_file():
            forbidden_keys = frozenset(
                {
                    "content",
                    "stem",
                    "title",
                    "question",
                    "options",
                    "option",
                    "choices",
                    "answer",
                    "analysis",
                    "choiceText",
                    "questionText",
                }
            )
            try:
                data = json.loads(choice_idx.read_text(encoding="utf-8"))
                found: list[str] = []
                stack: list[tuple[str, object]] = [("", data)]
                while stack:
                    path, node = stack.pop()
                    if isinstance(node, dict):
                        for k, v in node.items():
                            p = f"{path}.{k}" if path else k
                            if k in forbidden_keys and v not in (None, "", []):
                                found.append(p)
                            stack.append((p, v))
                    elif isinstance(node, list):
                        for i, item in enumerate(node):
                            stack.append((f"{path}[{i}]", item))
                if found:
                    errors.append(
                        f"{name}: choice-question-index.json contains forbidden "
                        f"stem fields: {', '.join(found[:5])}"
                    )
            except json.JSONDecodeError as exc:
                errors.append(f"{name}: choice-question-index invalid JSON: {exc}")

    exp_index = skill_dir / "knowledge/experiences/index.json"
    if exp_index.is_file():
        try:
            data = json.loads(exp_index.read_text(encoding="utf-8"))
            items = data.get("items") or data.get("experiences") or []
            # Support either list under common keys, or scan paths in file
            sample_path = None
            if isinstance(items, list) and items:
                sample_path = items[0].get("path")
            if sample_path is None:
                text = exp_index.read_text(encoding="utf-8")
                marker = '"path": "knowledge/experiences/'
                if marker in text:
                    start = text.index(marker) + len('"path": "')
                    end = text.index('"', start)
                    sample_path = text[start:end]
            if sample_path:
                target = skill_dir / sample_path
                if not target.is_file():
                    errors.append(
                        f"{name}: experience path not readable from skill root: {sample_path}"
                    )
        except json.JSONDecodeError as exc:
            errors.append(f"{name}: experiences index invalid JSON: {exc}")

    return errors


def check_compat_link() -> list[str]:
    link = ROOT / "knowledge"
    canonical = (ROOT / "skills/hw-ask/knowledge").resolve()
    if not link.exists():
        return ["repo root knowledge/ missing (expected symlink to skills/hw-ask/knowledge)"]
    if link.resolve() != canonical:
        return [f"repo root knowledge/ does not resolve to {canonical}"]
    return []


def check_mirrors_in_sync() -> list[str]:
    left = ROOT / "skills/hw-ask/knowledge"
    right = ROOT / "skills/hw-interview/knowledge"
    if not left.is_dir() or not right.is_dir():
        return ["cannot compare knowledge mirrors; one side missing"]

    left_files = {p.relative_to(left) for p in left.rglob("*") if p.is_file()}
    right_files = {p.relative_to(right) for p in right.rglob("*") if p.is_file()}
    missing_right = sorted(left_files - right_files)
    missing_left = sorted(right_files - left_files)
    errors: list[str] = []
    if missing_right:
        errors.append(
            f"hw-interview knowledge missing {len(missing_right)} file(s); "
            "run: python scripts/sync_skill_knowledge.py"
        )
    if missing_left:
        errors.append(
            f"hw-ask knowledge missing {len(missing_left)} file(s) present only in hw-interview; "
            "treat hw-ask as canonical and resync"
        )
    return errors


def main() -> int:
    errors: list[str] = []
    for name in REQUIRED_SKILLS:
        errors.extend(check_skill(name))
    errors.extend(check_compat_link())
    errors.extend(check_mirrors_in_sync())

    if errors:
        print("verify_skill_pack: FAIL")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("verify_skill_pack: OK")
    print("  - hw-ask and hw-interview each expose knowledge/ relative to skill root")
    print("  - hot100 / experiences sample paths resolve inside skill directories")
    print("  - repo root knowledge/ compat symlink is valid")
    print("  - both knowledge trees contain the same file set")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
