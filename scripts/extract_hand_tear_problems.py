"""Extract hand-tear problem references from experience posts."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

ROOT = Path(__file__).resolve().parent.parent
EXP_DIR = ROOT / "knowledge" / "experiences"
RAW_FILE = ROOT / "frontend" / "tmp" / "hand_tear_problems_raw.json"
OUT_FILE = ROOT / "frontend" / "tmp" / "hand_tear_problems_processed.json"


def decode_nowcoder_jump(url: str) -> str | None:
    """Decode gw-c.nowcoder.com jump link to real target URL."""
    if "gw-c.nowcoder.com/api/sparta/jump/link" in url:
        try:
            qs = parse_qs(urlparse(url).query)
            if "link" in qs:
                return unquote(qs["link"][0])
        except Exception:
            pass
    return None


def extract_references(content: str, source_id: str) -> list[dict]:
    """Extract lines that mention hand-tear / leetcode / codefun problems."""
    results = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        lower = line.lower()
        if not any(k in lower for k in ["手撕", "leetcode", "力扣", "codefun", "编程题", "算法题"]):
            continue

        # leetcode numbers
        nums = set(re.findall(r"leetcode\s*([0-9]+)", line, re.IGNORECASE))
        nums.update(re.findall(r"lc\.?\s*([0-9]+)", line, re.IGNORECASE))

        # markdown links
        links = re.findall(r"\[(.*?)\]\((.*?)\)", line)

        # raw URLs
        raw_urls = re.findall(r"https?://[^\s)\]\\]+", line)

        results.append({
            "source_id": source_id,
            "line": line,
            "links": links,
            "raw_urls": raw_urls,
            "leetcode_nums": list(nums),
        })
    return results


def main() -> None:
    # 1. Scan all experience files and collect raw references
    raw: list[dict] = []
    for path in sorted(EXP_DIR.rglob("hw-exp-*.md")):
        if any(parent.name.startswith("_") for parent in path.relative_to(EXP_DIR).parents):
            continue
        try:
            import frontmatter
            post = frontmatter.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        raw.extend(extract_references(post.content, post.metadata.get("id", path.stem)))

    RAW_FILE.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[extract] raw references: {len(raw)}")

    # 2. Load hot100 index for codefun mapping
    hot100 = json.loads((ROOT / "knowledge" / "coding-problems" / "hot100" / "index.json").read_text(encoding="utf-8"))
    num_to_std: dict[str, dict] = {}
    for p in hot100["problems"]:
        m = re.search(r"[Ll]eet[Cc]ode\s*([0-9]+)", p["title"])
        if m:
            num = m.group(1)
            m2 = re.search(r"[Ll]eet[Cc]ode\s*[0-9]+[\.\s]*(.+?)(?:-原题链接|$)", p["title"])
            title = m2.group(1).strip() if m2 else p["title"]
            num_to_std[num] = {"title": title, "codefun_url": p["source_url"]}

    # 3. Normalize unique problems
    problems: dict[str, dict] = {}

    for item in raw:
        line = item["line"]
        source_id = item["source_id"]

        nums = set(item["leetcode_nums"])

        # collect and decode candidate URLs
        candidate_urls: list[str] = []
        for link_text, link_url in item["links"]:
            decoded = decode_nowcoder_jump(link_url)
            if decoded:
                candidate_urls.append(decoded)
            candidate_urls.append(unquote(link_url))
        candidate_urls += [unquote(u) for u in item["raw_urls"]]

        clean_urls: list[str] = []
        for url in candidate_urls:
            decoded = decode_nowcoder_jump(url)
            if decoded:
                url = decoded
            # strip markdown artifacts
            url = url.split("]")[0].split("(")[0].rstrip("\\")
            clean_urls.append(url)

        leetcode_urls = [u for u in set(clean_urls) if "leetcode" in u.lower() and "problems" in u.lower()]
        codefun_urls = [u for u in set(clean_urls) if "codefun2000" in u.lower() and "/p/P" in u and "/ide/" not in u]

        if not nums and not leetcode_urls and not codefun_urls:
            continue

        if nums:
            for num in nums:
                std = num_to_std.get(num)
                key = f"LC{num}"
                if key not in problems:
                    title = std["title"] if std else None
                    codefun_url = std["codefun_url"] if std else None

                    leetcode_url = None
                    for url in leetcode_urls:
                        if f"/problems/{num}" in url:
                            leetcode_url = url
                            break
                    if not leetcode_url and leetcode_urls:
                        leetcode_url = leetcode_urls[0]
                    if not leetcode_url:
                        leetcode_url = f"https://leetcode.cn/problems/{num}/"

                    if not title:
                        m = re.search(r"[Ll]eet[Cc]ode\s*" + num + r"[\.\s]*([^\[\]\(\)\n，,]+)", line)
                        if m:
                            title = m.group(1).strip().rstrip("，,").strip()
                        else:
                            title = f"LeetCode {num}"

                    problems[key] = {
                        "key": key,
                        "leetcode_num": num,
                        "title": title,
                        "codefun_url": codefun_url,
                        "leetcode_url": leetcode_url,
                        "sources": [],
                    }
                if source_id not in problems[key]["sources"]:
                    problems[key]["sources"].append(source_id)

        if not nums and leetcode_urls:
            for url in leetcode_urls:
                m = re.search(r"problems/([^/\s?]+)", url)
                slug = m.group(1) if m else url
                key = f"URL_{slug}"
                if key not in problems:
                    title = None
                    codefun_url = None
                    for p in hot100["problems"]:
                        normalized = p["title"].lower().replace(" ", "").replace(".", "").replace("-原题链接", "")
                        if slug.replace("-", "") in normalized:
                            m2 = re.search(r"[Ll]eet[Cc]ode\s*[0-9]+[\.\s]*(.+?)(?:-原题链接|$)", p["title"])
                            title = m2.group(1).strip() if m2 else p["title"]
                            codefun_url = p["source_url"]
                            break
                    if not title:
                        title = slug.replace("-", " ").title()
                    problems[key] = {
                        "key": key,
                        "leetcode_num": None,
                        "title": title,
                        "codefun_url": codefun_url,
                        "leetcode_url": url,
                        "sources": [],
                    }
                if source_id not in problems[key]["sources"]:
                    problems[key]["sources"].append(source_id)

        if not nums and not leetcode_urls and codefun_urls:
            for url in codefun_urls:
                key = url
                if key not in problems:
                    problems[key] = {
                        "key": key,
                        "leetcode_num": None,
                        "title": "CodeFun2000 手撕题",
                        "codefun_url": url,
                        "leetcode_url": None,
                        "sources": [],
                    }
                if source_id not in problems[key]["sources"]:
                    problems[key]["sources"].append(source_id)

    OUT_FILE.write_text(json.dumps(list(problems.values()), ensure_ascii=False, indent=2), encoding="utf-8")
    with_codefun = sum(1 for p in problems.values() if p["codefun_url"])
    leetcode_only = sum(1 for p in problems.values() if p["leetcode_url"] and not p["codefun_url"])
    unknown = sum(1 for p in problems.values() if not p["codefun_url"] and not p["leetcode_url"])
    print(f"[extract] unique problems: {len(problems)}")
    print(f"[extract] codefun: {with_codefun}, leetcode-only: {leetcode_only}, unknown: {unknown}")


if __name__ == "__main__":
    main()
