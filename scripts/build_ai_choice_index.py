#!/usr/bin/env python3
"""Sync AI choice-question stats from CodeFun2000 choice bank (https://codefun2000.com/choice/hw)."""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "skills" / "hw-ask" / "knowledge" / "coding-problems" / "hw-exam"
INDEX_PATH = OUT_DIR / "index.json"
CHOICE_BANK_URL = "https://codefun2000.com/choice/hw"
LIST_API = "https://codefun2000.com/api/choice/list"
UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}


def fetch_choice_context() -> dict:
    req = urllib.request.Request(CHOICE_BANK_URL, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    m = re.search(r"window\.UiContextNew\s*=\s*'(\{.*?\})';", html, re.DOTALL)
    if not m:
        raise RuntimeError("UiContextNew not found on choice/hw page")
    return json.loads(m.group(1))


def fetch_tag1_list(psid: str, tag1: str) -> dict:
    params = urllib.parse.urlencode({"psid": psid, "tag1": tag1})
    url = f"{LIST_API}?{params}"
    req = urllib.request.Request(url, headers=UA)
    return json.loads(urllib.request.urlopen(req, timeout=60).read().decode("utf-8"))


def choice_practice_url(tag1: str, qid: int | None = None, n: int | None = None) -> str:
    tag1_enc = urllib.parse.quote(tag1, safe="")
    base = f"{CHOICE_BANK_URL}#tag1={tag1_enc}"
    if qid is not None and n is not None:
        return f"{base}&qid={qid}&n={n}"
    return base


def build_display_numbers(questions: list[dict], tag2_order: list[str]) -> dict[int, int]:
    """Map question list index -> 1-based display number n (matches site grid)."""
    groups: dict[str, list[int]] = {}
    for i, q in enumerate(questions):
        tag2 = q.get("tag2") or ""
        groups.setdefault(tag2, []).append(i)

    order_map = {name: idx for idx, name in enumerate(tag2_order)}
    group_list = [
        {"tag2": tag2, "indices": sorted(indices)}
        for tag2, indices in groups.items()
    ]
    if tag2_order:
        group_list.sort(
            key=lambda g: (
                order_map.get(g["tag2"], 10**9),
                min(g["indices"]),
            )
        )
    else:
        group_list.sort(key=lambda g: min(g["indices"]))

    display: dict[int, int] = {}
    num = 0
    for g in group_list:
        for idx in g["indices"]:
            num += 1
            display[idx] = num
    return display


def pick_representatives(
    questions: list[dict],
    display: dict[int, int],
    tag1: str,
    limit: int = 4,
    tag2_filter: str | None = None,
) -> list[dict]:
    indices = [
        i
        for i, q in enumerate(questions)
        if tag2_filter is None or (q.get("tag2") or "") == tag2_filter
    ]
    # spread across difficulty of qid / positions
    picked: list[dict] = []
    step = max(1, len(indices) // limit)
    for i in indices[:limit * step][:limit]:
        if len(picked) >= limit:
            break
        if i % step == 0 or len(picked) < limit:
            q = questions[i]
            n = display.get(i, i + 1)
            picked.append(
                {
                    "qid": q.get("qid"),
                    "tag2": q.get("tag2") or "",
                    "n": n,
                    "url": choice_practice_url(tag1, q.get("qid"), n),
                }
            )
    # ensure at least min(limit, len(indices))
    if len(picked) < min(limit, len(indices)):
        for i in indices:
            if i not in {questions.index(p) for p in []}:
                pass
        seen_qids = {p["qid"] for p in picked}
        for i in indices:
            q = questions[i]
            if q.get("qid") in seen_qids:
                continue
            n = display.get(i, i + 1)
            picked.append(
                {
                    "qid": q.get("qid"),
                    "tag2": q.get("tag2") or "",
                    "n": n,
                    "url": choice_practice_url(tag1, q.get("qid"), n),
                }
            )
            if len(picked) >= limit:
                break
    return picked[:limit]


def simplify_pick(
    questions: list[dict],
    display: dict[int, int],
    tag1: str,
    indices: list[int],
    limit: int = 3,
) -> list[dict]:
    if not indices:
        return []
    if len(indices) <= limit:
        chosen = indices
    else:
        step = max(1, len(indices) // limit)
        chosen = [indices[i * step] for i in range(limit)]
    reps = []
    for i in chosen[:limit]:
        q = questions[i]
        reps.append(
            {
                "qid": q.get("qid"),
                "tag2": q.get("tag2") or "",
                "n": display.get(i, i + 1),
                "url": choice_practice_url(tag1, q.get("qid"), display.get(i, i + 1)),
            }
        )
    return reps


def build_category(
    psid: str,
    tag1_meta: dict,
    tag1_count: int,
    total: int,
) -> dict:
    tag1 = tag1_meta["name"]
    data = fetch_tag1_list(psid, tag1)
    questions = data.get("questions") or []
    tag2_order = data.get("tag2Order") or []
    display = build_display_numbers(questions, tag2_order)

    tag2_counts = Counter(q.get("tag2") or "未分类" for q in questions)
    subcategories = []
    ordered_tag2 = tag2_order + [t for t in tag2_counts if t not in tag2_order]
    for tag2 in ordered_tag2:
        if tag2 not in tag2_counts:
            continue
        cnt = tag2_counts[tag2]
        indices = [i for i, q in enumerate(questions) if (q.get("tag2") or "未分类") == tag2]
        subcategories.append(
            {
                "tag2": tag2,
                "count": cnt,
                "share_pct_within_tag1": round(100 * cnt / len(questions), 1) if questions else 0,
                "practice_url": choice_practice_url(tag1),
                "representatives": simplify_pick(questions, display, tag1, indices, limit=3),
            }
        )

    all_indices = list(range(len(questions)))
    return {
        "tag1": tag1,
        "description": tag1_meta.get("description") or "",
        "count": len(questions),
        "share_pct": round(100 * len(questions) / total, 1) if total else 0,
        "practice_url": choice_practice_url(tag1),
        "subcategories": subcategories,
        "representatives": simplify_pick(questions, display, tag1, all_indices, limit=4),
    }


def strip_index_choice_fields() -> None:
    if not INDEX_PATH.is_file():
        return
    data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    for p in data.get("problems", []):
        p.pop("choice_category_counts", None)
        p.pop("choice_question_count", None)
    INDEX_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_exam_problem_stats_md(categories: list[dict], total: int) -> None:
    stats_md = OUT_DIR / "exam-problem-stats.md"
    if not stats_md.is_file():
        return
    text = stats_md.read_text(encoding="utf-8")

    table_lines = [
        "| 大类 | 题数 | 占比 |",
        "|------|-----:|-----:|",
    ]
    for c in categories:
        table_lines.append(
            f"| [{c['tag1']}]({c['practice_url']}) | {c['count']} | {c['share_pct']}% |"
        )

    rep_sections: list[str] = []
    for c in categories:
        rep_sections.append(f"### [{c['tag1']}]({c['practice_url']})（共 {c['count']} 道）")
        rep_sections.append("")
        rep_sections.append("| 小类 | 题数 | 占该类比例 |")
        rep_sections.append("|------|-----:|-----------:|")
        for sub in c["subcategories"]:
            rep_sections.append(
                f"| {sub['tag2']} | {sub['count']} | {sub['share_pct_within_tag1']}% |"
            )
        rep_sections.append("")
        rep_sections.append("代表真题（题号列超链接，与编程题同规格）：")
        rep_sections.append("")
        rep_sections.append("| 题号 | 小类 |")
        rep_sections.append("|------|------|")
        for r in c["representatives"]:
            rep_sections.append(f"| [第{r['n']}题]({r['url']}) | {r['tag2']} |")
        rep_sections.append("")

    new_block = (
        f"## AI 方向 · 选择题专项题库（{total} 道 / 七大类）\n\n"
        f"> 数据源：[AI方向笔试-选择题专项题库]({CHOICE_BANK_URL})（CodeFun2000）。"
        "明细见 `choice-question-index.json`。\n"
        "> **Agent**：用户问选择题频次/怎么练 → **先 Read choice-no-leak.md**；"
        "**笼统问题**只输出七大类频次表（**大类名即超链接**，无刷题入口列），禁止逐类小类表；"
        "**具体大类**再给小类分布 + 代表真题表；禁止输出题干/选项。\n"
        "> **「会考 XX 吗」**：选择题 + 编程题双题型；禁止只答一侧。\n\n"
        + "\n".join(table_lines)
        + "\n\n"
        "## AI 方向 · 选择题代表题（Agent 内部参考，勿整段复制给用户）\n\n"
        "> 每个大类 3–4 道代表题链接；小类频次见上表与各大类小节。\n\n"
        + "\n".join(rep_sections)
    )

    pattern = (
        r"## AI 方向 · 选择题.*?"
        r"(?=## AI 方向 · ML/算法细分考点)"
    )
    if not re.search(pattern, text, re.DOTALL):
        print("[warn] exam-problem-stats.md pattern not found")
        return
    text = re.sub(pattern, new_block + "\n", text, count=1, flags=re.DOTALL)
    stats_md.write_text(text, encoding="utf-8")


def main() -> int:
    ctx = fetch_choice_context()
    psid = ctx.get("psid")
    if not psid:
        print("[error] psid missing", file=sys.stderr)
        return 1

    tag1_list = ctx.get("tag1List") or []
    tag1_counts = ctx.get("tag1Counts") or {}
    total = ctx.get("totalQuestions") or sum(tag1_counts.values())

    categories = []
    for meta in tag1_list:
        name = meta["name"]
        categories.append(build_category(psid, meta, tag1_counts.get(name, 0), total))

    now = datetime.now(timezone.utc).isoformat()
    choice_index = {
        "version": 2,
        "generated_at": now,
        "source_url": CHOICE_BANK_URL,
        "api_endpoint": LIST_API,
        "psid": psid,
        "total_questions": total,
        "categories": categories,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "choice-question-index.json").write_text(
        json.dumps(choice_index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    stats_path = OUT_DIR / "stats.json"
    stats = {}
    if stats_path.is_file():
        stats = json.loads(stats_path.read_text(encoding="utf-8"))
    # remove legacy local-folder stats
    for key in list(stats.keys()):
        if key.startswith("ai_choice_") or key == "choice_index_generated_at":
            stats.pop(key, None)

    stats["choice_bank_url"] = CHOICE_BANK_URL
    stats["choice_bank_psid"] = psid
    stats["choice_bank_total_questions"] = total
    stats["choice_bank_tag1_counts"] = {c["tag1"]: c["count"] for c in categories}
    stats["choice_bank_tag2_counts"] = {
        c["tag1"]: {sub["tag2"]: sub["count"] for sub in c["subcategories"]}
        for c in categories
    }
    stats["choice_bank_tag2_stats"] = {
        c["tag1"]: [
            {
                "tag2": sub["tag2"],
                "count": sub["count"],
                "share_pct_within_tag1": sub["share_pct_within_tag1"],
            }
            for sub in c["subcategories"]
        ]
        for c in categories
    }
    stats["choice_bank_representatives"] = {
        c["tag1"]: c["representatives"] for c in categories
    }
    stats["choice_index_generated_at"] = now
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    strip_index_choice_fields()
    update_exam_problem_stats_md(categories, total)

    print(f"[ok] {total} questions, {len(categories)} tag1 categories")
    for c in categories:
        subs = len(c["subcategories"])
        print(f"  {c['tag1']}: {c['count']} ({subs} subcategories)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
