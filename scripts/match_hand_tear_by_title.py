"""Match hand-tear problem references to CodeFun2000 by title / semantics.

User asked: do NOT rely on LeetCode numbers. Instead, match by problem name
or meaning. We still use LeetCode numbers only as a final fallback when a
number is explicitly mentioned in the experience, to look up the hot100
(CodeFun2000) index directly.
"""

from __future__ import annotations

import difflib
import json
import re
from pathlib import Path

from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parent.parent
HOT100_DIR = ROOT / "knowledge" / "coding-problems" / "hot100"
RAW_FILE = ROOT / "frontend" / "tmp" / "hand_tear_problems_raw.json"
OUT_FILE = ROOT / "frontend" / "tmp" / "hand_tear_problems_matched.json"

STOP_NAMES = {
    "手写", "代码", "项目", "环节", "算法", "排序", "滑动窗口", "字符串", "链表", "二叉树",
    "数组", "栈", "队列", "图", "树", "数字", "原题", "热题", "高频", "medium", "easy", "hard",
    "困难", "中等", "简单", "编程", "题目", "题", "问题", "实现", "不难", "场景",
    "介绍", "后面", "然后", "笔试", "面试", "一面", "二面", "三面", "主管面", "hr面", "技术面",
    "没有", "全都", "都没", "给了", "两道", "一题", "两题", "三题", "四题", "五题", "做了",
    "写了", "用样例", "检查", "正确", "输出", "输入", "时间复杂度", "空间复杂度", "机器学习",
    "transformer", "注意力", "attention", "kmeans", "k-means", "knn", "softmax", "sql",
    "linux", "c", "c++", "java", "python", "i2c", "spi", "iic", "pfc", "llc", "数分",
    "的时候", "就是", "一个数组", "给一个数组", "给定一个", "输入为一个", "大小为",
    "字符串模拟", "有效代码行数", "算法题是leetcode", "leetcode:", "leetcode", "算法",
}

# Patterns that indicate the extracted text is not a concrete problem title
VAGUE_NAME_PATTERNS = [
    r"给定一个",
    r"输入为一个",
    r"大小为",
    r"算法题是leetcode",
    r"leetcode:\s*$",
    r"^(字符串|数组|链表|二叉树|栈|队列|图|树)模拟$",
    r"^(一个|给一个|输入一个|数组|链表).*(数组|链表|字符串)$",
    r"^(就是|的时候|的|了|然后|后面|最后|接着)$",
]


def extract_hot100_problems() -> tuple[list[dict], dict[int, dict]]:
    """Load hot100 problems and build number -> problem index."""
    idx = json.loads((HOT100_DIR / "index.json").read_text(encoding="utf-8"))
    by_id = {p["id"]: p for p in idx["problems"]}

    problems = []
    number_index: dict[int, dict] = {}

    for path in sorted(HOT100_DIR.rglob("题面.md")):
        pid = path.parent.name
        meta = by_id.get(pid, {})
        source_url = meta.get("source_url", f"https://codefun2000.com/p/{pid}")
        idx_title = meta.get("title", "")

        title = ""
        leetcode_number = None
        m = re.search(r"[Ll]eet[Cc]ode\s*([0-9]+)[\.\s]*([^\-]+)", idx_title)
        if m:
            leetcode_number = int(m.group(1))
            title = m.group(2).strip().rstrip("-原题链接").strip()

        full_text = path.read_text(encoding="utf-8")
        first_line = full_text.splitlines()[0] if full_text else ""

        if not title:
            m = re.search(r"[Ll]eet[Cc]ode\s*([0-9]+)[\.\s]*([^\-\[]+?)(?:\s*[-\[]|$)", first_line)
            if m:
                leetcode_number = int(m.group(1))
                title = m.group(2).strip().rstrip("-原题链接").strip()

        english_title = ""
        m = re.search(r"problems/([^/\s?]+)/", first_line)
        if m:
            english_title = m.group(1).replace("-", " ").title()

        desc = ""
        if "### **题目描述**" in full_text:
            parts = full_text.split("### **题目描述**", 1)
            desc = parts[1].split("### **输入描述**")[0].strip()[:300]
        elif "# 题目内容" in full_text:
            parts = full_text.split("# 题目内容", 1)
            desc = parts[1].split("# 输入描述")[0].strip()[:300]
        elif "# 题目描述" in full_text:
            parts = full_text.split("# 题目描述", 1)
            desc = parts[1].split("# 输入描述")[0].strip()[:300]

        if not title and desc:
            title = desc.splitlines()[0].strip()[:40]

        # Keep Chinese, English, digits, Roman numerals, spaces, and hyphens
        title = re.sub(r"[^\u4e00-\u9fa5a-zA-Z0-9\u2160-\u217f\s\-]+", "", title).strip()

        problem = {
            "pid": pid,
            "title": title,
            "english_title": english_title,
            "description": desc,
            "codefun_url": source_url,
            "full_text": f"{title} {english_title} {desc}".strip(),
        }
        problems.append(problem)
        if leetcode_number is not None:
            number_index[leetcode_number] = problem

    return problems, number_index


def clean_name(name: str) -> str:
    """Clean extracted problem name."""
    name = name.replace("**", " ").strip()
    name = re.sub(r"^\d+[、\.\s]+", "", name)
    name = re.sub(r"\s+\d+(\s*[、\.].*)?$", "", name).strip()
    name = re.sub(r"[，,。\.\s]{2,}|[,，;；:]", " ", name)
    name = re.sub(r"\b(easy|medium|hard|leetcode|lc|力扣|原题|热题|高频|中等|简单|困难)\b", "", name, flags=re.IGNORECASE).strip()
    return name.strip()


def is_valid_name(name: str) -> bool:
    """Check if extracted name is specific enough to be a problem title."""
    if not name or len(name) < 4:
        return False
    if name.lower() in STOP_NAMES:
        return False
    if re.fullmatch(r"[a-zA-Z\s]+", name) and len(name.strip()) < 5:
        return False
    for pattern in VAGUE_NAME_PATTERNS:
        if re.search(pattern, name):
            return False
    return True


def extract_leetcode_number(line: str) -> int | None:
    """Extract LeetCode number from line if present."""
    m = re.search(r"(?:leetcode|lc|力扣)[\s\.]*([0-9]{1,4})", line, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"(?:第\s*)?([0-9]{1,4})\s*[\.\s]*题", line)
    if m:
        return int(m.group(1))
    return None


def extract_problem_names(line: str) -> list[str]:
    """Extract one or more concise problem names from a hand-tear line."""
    line = line.strip()
    names = []

    # 1. Markdown links [title](url)
    for m in re.finditer(r"\[([^\]]{1,40})\]\s*\(", line):
        name = clean_name(m.group(1))
        if is_valid_name(name):
            names.append(name)
    if names:
        return names

    # 2. Single hand-tear problem with optional leetcode/lc number.
    m = re.search(
        r"手撕(?:代码|题|一道|了)?[:：]?\s*(?:leetcode|lc|力扣)?\s*[0-9]*[\.\s]*([^，,、（()\[\]【】\n]{1,40})",
        line,
        re.IGNORECASE,
    )
    if m:
        name = clean_name(m.group(1))
        if is_valid_name(name):
            return [name]

    # 3. Multiple Chinese titles separated by commas/顿号 after 手撕
    m = re.search(r"手撕(?:代码|题|一道|了)?[:：]?\s*([^，,。、【】\[\]\n]{1,120})", line, re.IGNORECASE)
    if m:
        segment = m.group(1)
        parts = re.split(r"[,，、]", segment)
        for part in parts:
            part = clean_name(part)
            part = re.sub(r"^(两题|一题|道题|题|第\s*[0-9一二三四五]+\s*[、\.\s]*)", "", part).strip()
            if is_valid_name(part):
                names.append(part)
        if names:
            return names

    # 4. leetcode/lc title without 手撕
    m = re.search(
        r"(?:力扣|leetcode|lc)[\s\.]*([0-9]{0,4})[\.\s]*([^，,、（()\[\]【】\n]{1,40})",
        line,
        re.IGNORECASE,
    )
    if m:
        name = clean_name(m.group(2))
        if is_valid_name(name):
            return [name]

    return []


def title_match_score(name: str, hot100: dict) -> float:
    """Score a problem name against a hot100 problem."""
    name = name.lower().strip()
    if not name or len(name) < 3:
        return 0.0
    hot_title = hot100["title"].lower().strip()
    hot_english = hot100["english_title"].lower().strip()

    if len(hot_title) < 2 and len(hot_english) < 2:
        return 0.0

    if hot_title and name == hot_title:
        return 1.0
    if hot_english and name == hot_english:
        return 0.95

    def containment_score(a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        if a in b or b in a:
            longer = max(len(a), len(b))
            shorter = min(len(a), len(b))
            diff = longer - shorter
            if diff == 0:
                return 1.0
            if diff <= 2:
                return 0.9
            if diff <= 4:
                return 0.75
            if diff <= 6:
                return 0.6
            return 0.4
        return 0.0

    best = 0.0
    if hot_title:
        best = max(best, containment_score(name, hot_title))
    if hot_english:
        best = max(best, containment_score(name, hot_english))
    if best > 0:
        return best

    return max(
        difflib.SequenceMatcher(None, name, hot_title).ratio() if hot_title else 0.0,
        difflib.SequenceMatcher(None, name, hot_english).ratio() if hot_english else 0.0,
    )


def is_relevant_line(line: str) -> bool:
    """Filter lines that are likely about hand-tear problems."""
    keywords = ["手撕", "leetcode", "力扣", "lc", "算法题", "编程题", "手写代码", "原题"]
    return any(k in line.lower() for k in keywords)


def main() -> None:
    import os
    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

    print("[match] loading raw references...")
    raw = json.loads(RAW_FILE.read_text(encoding="utf-8"))

    print("[match] loading hot100 problems...")
    hot100_problems, number_index = extract_hot100_problems()
    print(f"[match] hot100 problems: {len(hot100_problems)}")
    empty_title = sum(1 for p in hot100_problems if len(p["title"]) < 2)
    print(f"[match] hot100 problems with empty title: {empty_title}")

    print("[match] loading BGE model...")
    model = SentenceTransformer("BAAI/bge-small-zh-v1.5")
    hot_embeddings = model.encode(
        [p["full_text"] for p in hot100_problems],
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    matches: dict[str, dict] = {}

    for item in raw:
        line = item["line"]
        source_id = item["source_id"]
        if not is_relevant_line(line):
            continue

        # Collect all leetcode URLs from this line
        leetcode_urls = []
        for link_text, link_url in item["links"]:
            if "leetcode" in link_url.lower() and "problems" in link_url.lower():
                leetcode_urls.append(link_url)
        leetcode_urls += re.findall(r"https?://leetcode\.[^\s)]+", line, re.IGNORECASE)
        leetcode_urls = list(dict.fromkeys(leetcode_urls))

        def choose_leetcode_url(name: str) -> str | None:
            if not leetcode_urls:
                return None
            if len(leetcode_urls) == 1:
                return leetcode_urls[0]
            best_url = None
            best_score = 0.0
            name_lower = name.lower()
            name_has_chinese = bool(re.search(r"[\u4e00-\u9fa5]", name))
            for url in leetcode_urls:
                slug = re.search(r"/problems/([^/\s?]+)/", url)
                if slug:
                    slug_text = slug.group(1).replace("-", " ")
                    slug_lower = slug_text.lower()
                    # For Chinese names vs English slugs, sequence similarity is meaningless.
                    if name_has_chinese and not re.search(r"[\u4e00-\u9fa5]", slug_text):
                        score = 0.0
                    else:
                        score = difflib.SequenceMatcher(None, name_lower, slug_lower).ratio()
                    if score > best_score:
                        best_score = score
                        best_url = url
            return best_url if best_score >= 0.3 else None

        names = extract_problem_names(line)
        leetcode_number = extract_leetcode_number(line)

        if not names:
            if leetcode_number is not None and leetcode_number in number_index:
                hp = number_index[leetcode_number]
                leetcode_url = choose_leetcode_url(f"LeetCode {leetcode_number}")
                key = f"{hp['pid']}::lc{leetcode_number}"
                if key not in matches:
                    matches[key] = {
                        "key": f"LeetCode {leetcode_number}",
                        "line": line,
                        "sources": [],
                        "codefun_url": hp["codefun_url"],
                        "leetcode_url": leetcode_url,
                        "matched_title": hp["title"] or hp["english_title"] or hp["pid"],
                        "match_score": 0.8,
                    }
                if source_id not in matches[key]["sources"]:
                    matches[key]["sources"].append(source_id)
            continue

        for name in names:
            leetcode_url = choose_leetcode_url(name)
            best_score = 0.0
            best_problem = None
            for hp in hot100_problems:
                score = title_match_score(name, hp)
                if score > best_score:
                    best_score = score
                    best_problem = hp

            if best_score < 0.75:
                name_emb = model.encode([name], normalize_embeddings=True, show_progress_bar=False)
                sims = name_emb @ hot_embeddings.T
                best_idx = int(sims[0].argmax())
                sem_score = float(sims[0][best_idx])
                candidate = hot100_problems[best_idx]
                # Semantic match must be reasonably high and also have some title overlap
                title_score_for_candidate = title_match_score(name, candidate)
                if sem_score >= 0.6 and title_score_for_candidate >= 0.5 and sem_score > best_score:
                    best_score = sem_score
                    best_problem = candidate

            if best_score < 0.6 and leetcode_number is not None and leetcode_number in number_index:
                best_problem = number_index[leetcode_number]
                best_score = 0.8

            if best_score < 0.6 or best_problem is None:
                continue

            pid = best_problem["pid"]
            key = f"{pid}::{name}"
            if key not in matches:
                matches[key] = {
                    "key": name,
                    "line": line,
                    "sources": [],
                    "codefun_url": best_problem["codefun_url"],
                    "leetcode_url": leetcode_url,
                    "matched_title": best_problem["title"] or best_problem["english_title"] or best_problem["pid"],
                    "match_score": round(best_score, 3),
                }
            if source_id not in matches[key]["sources"]:
                matches[key]["sources"].append(source_id)

    print(f"[match] unique matched problems: {len(matches)}")

    result = sorted(matches.values(), key=lambda x: (x["codefun_url"] is None, x["key"]))
    OUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[match] saved to {OUT_FILE}")


if __name__ == "__main__":
    main()
