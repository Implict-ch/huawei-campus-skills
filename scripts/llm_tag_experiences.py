#!/usr/bin/env python3
"""离线 LLM 语义打标：给每篇面经打多标签，供筛选使用。

白话理解：
  1. 你更新面经库时，运行本脚本
  2. 脚本把每篇面经发给大模型，让它按「意思」贴标签（如 大模型、Java）
  3. 标签存进 JSON 文件
  4. 用户网站上点筛选时，后端只读这个 JSON，不再调用大模型

用法:
  python scripts/llm_tag_experiences.py
  python scripts/llm_tag_experiences.py --limit 10          # 只打前 10 篇（调试）
  python scripts/llm_tag_experiences.py --force             # 忽略缓存，强制重打

  # 换成 gpt-4o 等（需要对应 API Key）
  python scripts/llm_tag_experiences.py --model gpt-4o --base-url https://api.openai.com/v1 --api-key sk-xxx
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from openai import OpenAI

# 项目根目录（hw-campus-skills/）
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

# 从词表文件导入：允许贴哪些标签、标签含义、关键词兜底别名
from role_label_taxonomy import (  # noqa: E402
    ROLE_LABEL_ALIASES,
    ROLE_LABEL_TAXONOMY,
    enforce_period_mutex,
    label_group,
)

# ---------- 输入 / 输出文件路径 ----------
# 面经列表（按岗位分好组）
EXP_JSON = ROOT / "frontend" / "public" / "experiences.json"
# 打标结果：每篇面经对应哪些标签（给后端筛选用）
OUT_TAGS = ROOT / "frontend" / "public" / "experience_semantic_tags.json"
# 筛选侧边栏要显示哪些标签（从打标结果汇总出来）
OUT_KEYWORDS = ROOT / "frontend" / "public" / "experience_keywords.json"
# 本地缓存：同一篇文章内容没变就不用再问大模型
CACHE_FILE = ROOT / "frontend" / "tmp" / "llm_tag_cache.json"
# API Key 等配置
ENV_FILE = ROOT / "frontend" / ".env"


def load_env(path: Path) -> dict:
    """读取 .env 文件，得到 {键: 值} 字典。"""
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def load_json(path: Path, default):
    """读 JSON；文件不存在时返回 default。"""
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data) -> None:
    """把 data 写成格式化的 JSON 文件。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def content_hash(text: str) -> str:
    """给文本算一个短指纹。内容变了，指纹就会变，用来判断要不要重新打标。"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def clean_text(text: str) -> str:
    """清洗面经正文：去掉图片、链接、frontmatter，压缩空白。"""
    text = re.sub(r"!?\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"^---\s*\n.*?---\s*\n", "", text, flags=re.DOTALL)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def read_experience_text(item: dict) -> str:
    """读出一篇面经的「标题+正文」，太长则截断，省 API 费用。"""
    path = ROOT / item.get("filePath", "")
    title = item.get("title") or ""
    body = ""
    if path.exists():
        body = clean_text(path.read_text(encoding="utf-8", errors="replace"))
    else:
        body = title
    # 只取前 2800 字，足够判断标签，又不会太贵
    return f"{title}\n{body}"[:2800]


def keyword_fallback(role: str, text: str) -> list[str]:
    """大模型失败或没标出任何标签时的兜底：用「正文里有没有这个词」硬匹配。

    不如语义打标准，但总比一篇都没标签强。
    """
    aliases = ROLE_LABEL_ALIASES.get(role, {})
    text_l = text.lower()
    hits = []
    for label, als in aliases.items():
        for a in als:
            a_l = a.lower()
            # 很短的英文词（如 arm）用「词边界」匹配，避免误伤
            if len(a_l) <= 4 and re.fullmatch(r"[a-z0-9+#./]+", a_l):
                if re.search(rf"(?<![a-z0-9]){re.escape(a_l)}(?![a-z0-9])", text_l):
                    hits.append(label)
                    break
            elif a_l in text_l:
                hits.append(label)
                break
    return hits


def build_prompt(role: str, text: str) -> str:
    """拼发给大模型的提示词：告诉它有哪些候选标签、怎么输出。"""
    taxonomy = ROLE_LABEL_TAXONOMY[role]
    # 把「标签名: 含义说明」列给模型看
    label_lines = "\n".join(f"- {k}: {v}" for k, v in taxonomy.items())
    return f"""你是华为校招面经标注助手。请根据面经内容，从候选标签中选出所有相关标签（多标签）。

要求：
1. 只输出 JSON，不要 markdown，不要解释
2. 格式：{{"labels": ["标签1", "标签2"]}}
3. labels 必须是候选列表中的原样字符串；无关则返回空数组
4. 按语义判断，即使原文没出现标签字面词，只要内容实质相关也应标注
5. 不要为了凑数乱标；不确定就不要标
6. 「实习」与「校招」互斥：一篇面经最多标注其中一个。出现秋招/春招/校招/应届等必须标「校招」；只有明确暑期实习/日常实习/寒假实习等才标「实习」。两者冲突时标「校招」

候选标签：
{label_lines}

面经内容：
{text}

只输出 JSON："""


def parse_labels(raw: str, allowed: set[str]) -> list[str]:
    """把大模型返回的文字解析成标签列表，并丢掉不在词表里的非法标签。"""
    raw = raw.strip()
    # 有的模型会包一层 ```json ... ```，先剥掉
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # 再尝试从整段回复里抠出 {...}
        m = re.search(r"\{.*\}", raw, re.S)
        if not m:
            return []
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return []

    labels = data.get("labels") if isinstance(data, dict) else data
    if not isinstance(labels, list):
        return []

    out = []
    for x in labels:
        s = str(x).strip()
        # 只保留词表里有的，且去重
        if s in allowed and s not in out:
            out.append(s)
    return enforce_period_mutex(out)


def tag_one(
    client: OpenAI,
    model: str,
    role: str,
    item: dict,
    cache: dict,
    force: bool,
    lock: threading.Lock,
) -> dict:
    """给「一篇」面经打标签。这是最核心的一步。"""
    eid = item["id"]
    text = read_experience_text(item)
    # 内容和岗位一起算指纹；岗位或正文一变就要重打
    h = content_hash(role + "\n" + text)

    # ---- 1) 先看缓存，命中就直接返回，省钱 ----
    with lock:
        cached = cache.get(eid)
    if (not force) and cached and cached.get("hash") == h and isinstance(cached.get("labels"), list):
        return {
            "id": eid,
            "role": role,
            "labels": cached["labels"],
            "source": cached.get("source", "cache"),
            "hash": h,
        }

    allowed = set(ROLE_LABEL_TAXONOMY[role].keys())
    labels: list[str] = []
    source = "llm"  # 标记标签来源：llm / fallback_keyword / cache

    # ---- 2) 调用大模型 ----
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你只输出合法 JSON。"},
                {"role": "user", "content": build_prompt(role, text)},
            ],
            temperature=0.1,  # 低一点，输出更稳定
            max_tokens=200,
        )
        content = resp.choices[0].message.content or ""
        labels = parse_labels(content, allowed)
    except Exception as e:
        # 网络/额度等失败：退回关键词匹配
        print(f"[warn] LLM failed {eid}: {e}")
        source = "fallback_keyword"
        labels = keyword_fallback(role, text)

    # ---- 3) 模型返回空数组时，也用关键词兜底 ----
    if not labels:
        fb = keyword_fallback(role, text)
        if fb:
            labels = fb
            source = "fallback_keyword"

    # ---- 4) 写入缓存，供下次跳过 ----
    with lock:
        cache[eid] = {"hash": h, "labels": labels, "source": source, "role": role}

    return {"id": eid, "role": role, "labels": labels, "source": source, "hash": h}


def build_keywords_from_tags(tags_by_id: dict) -> dict:
    """根据打标结果，统计每个岗位「出现过哪些标签」，生成侧边栏关键词列表。"""
    role_counter: dict[str, Counter] = defaultdict(Counter)
    for _eid, row in tags_by_id.items():
        role = row.get("role") or ""
        if role not in ROLE_LABEL_TAXONOMY:
            continue
        for lab in row.get("labels") or []:
            if lab in ROLE_LABEL_TAXONOMY[role]:
                role_counter[role][lab] += 1

    out = {}
    for role, taxonomy in ROLE_LABEL_TAXONOMY.items():
        c = role_counter.get(role, Counter())
        items = []
        for lab, cnt in c.most_common():
            if cnt < 1:
                continue
            aliases = ROLE_LABEL_ALIASES.get(role, {}).get(lab, [lab.lower()])
            items.append({"keyword": lab, "aliases": aliases, "count": cnt})
        # 出现次数多的排前面
        order = {k: i for i, k in enumerate(taxonomy.keys())}
        items.sort(key=lambda x: (-x["count"], order.get(x["keyword"], 999)))
        out[role] = [
            {
                "keyword": x["keyword"],
                "group": label_group(role, x["keyword"]),
                "aliases": x["aliases"],
            }
            for x in items
        ]
        print(f"{role}: {[x['keyword'] for x in items]} (n={len(items)})")
    # 时期标签固定出现在侧栏
    from role_label_taxonomy import PERIOD_LABELS, ROLE_LABEL_ALIASES

    for role in list(out.keys()):
        by_kw = {x["keyword"]: x for x in out[role]}
        period = []
        for lab in PERIOD_LABELS:
            if lab in by_kw:
                period.append(by_kw[lab])
            else:
                period.append(
                    {
                        "keyword": lab,
                        "group": label_group(role, lab),
                        "aliases": ROLE_LABEL_ALIASES.get(role, {}).get(lab, [lab.lower()]),
                    }
                )
        others = [x for x in out[role] if x["keyword"] not in PERIOD_LABELS]
        out[role] = period + others
    return out


def main() -> int:
    """脚本入口：读配置 → 并发打标 → 写结果文件。"""
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="只处理前 N 篇（调试）")
    parser.add_argument("--force", action="store_true", help="忽略缓存强制重打")
    parser.add_argument("--workers", type=int, default=4, help="同时打几篇（并发数）")
    parser.add_argument("--model", default="", help="模型名，如 gpt-4o / deepseek-chat")
    parser.add_argument("--base-url", default="", help="OpenAI 兼容 API 地址")
    parser.add_argument("--api-key", default="", help="API Key")
    args = parser.parse_args()

    env = load_env(ENV_FILE)

    # 配置优先级：命令行参数 > TAG_* > BUILTIN_*（和 Agent 内置模型同一套）
    api_key = (
        args.api_key
        or env.get("TAG_API_KEY")
        or os.environ.get("TAG_API_KEY")
        or env.get("BUILTIN_API_KEY")
        or os.environ.get("BUILTIN_API_KEY", "")
    )
    base_url = (
        args.base_url
        or env.get("TAG_BASE_URL")
        or os.environ.get("TAG_BASE_URL")
        or env.get("BUILTIN_BASE_URL")
        or os.environ.get("BUILTIN_BASE_URL")
        or "https://api.deepseek.com/v1"
    )
    model = (
        args.model
        or env.get("TAG_MODEL")
        or os.environ.get("TAG_MODEL")
        or env.get("BUILTIN_MODEL")
        or os.environ.get("BUILTIN_MODEL")
        or "deepseek-chat"
    )
    if not api_key:
        print(
            "缺少 API Key。可设置 frontend/.env 的 BUILTIN_API_KEY / TAG_API_KEY，或传 --api-key",
            file=sys.stderr,
        )
        return 1

    # 从 experiences.json 取出所有要打标的面经
    exp = load_json(EXP_JSON, {})
    grouped = exp.get("grouped") or {}
    jobs = []
    for role, items in grouped.items():
        if role not in ROLE_LABEL_TAXONOMY:
            continue
        for item in items:
            jobs.append((role, item))
    jobs.sort(key=lambda x: x[1].get("id", ""))
    if args.limit > 0:
        jobs = jobs[: args.limit]

    cache = load_json(CACHE_FILE, {})
    cache_lock = threading.Lock()  # 多线程写缓存时加锁，避免写乱
    # OpenAI 官方 SDK，也兼容 DeepSeek 等（换 base_url 即可）
    client = OpenAI(api_key=api_key, base_url=base_url, timeout=60, max_retries=2)

    print(f"[llm-tag] jobs={len(jobs)} model={model} workers={args.workers} force={args.force}")
    results = []
    done = 0
    t0 = time.time()

    def _work(pair):
        role, item = pair
        return tag_one(client, model, role, item, cache, args.force, cache_lock)

    # 多线程并发打标，加快速度
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        futs = [ex.submit(_work, j) for j in jobs]
        for fut in as_completed(futs):
            row = fut.result()
            results.append(row)
            done += 1
            if done % 20 == 0 or done == len(jobs):
                # 每隔一段时间把缓存存盘，中途崩了也不至于全丢
                with cache_lock:
                    save_json(CACHE_FILE, cache)
                elapsed = time.time() - t0
                print(f"[llm-tag] {done}/{len(jobs)} elapsed={elapsed:.1f}s")

    with cache_lock:
        save_json(CACHE_FILE, cache)

    # 整理成「面经 id -> 标签」字典
    tags_by_id = {
        r["id"]: {"role": r["role"], "labels": r["labels"], "source": r["source"]}
        for r in results
    }

    # 调试时只打了部分：保留文件里旧的其它篇，避免被覆盖成空
    if args.limit > 0 and OUT_TAGS.exists():
        old = load_json(OUT_TAGS, {})
        old_docs = old.get("docs") if isinstance(old, dict) else old
        if isinstance(old_docs, dict):
            for k, v in old_docs.items():
                if k not in tags_by_id:
                    tags_by_id[k] = v

    # 全量跑时：确保每篇在 experiences 里的都能对应到标签
    if args.limit <= 0:
        for role, items in grouped.items():
            if role not in ROLE_LABEL_TAXONOMY:
                continue
            for item in items:
                eid = item["id"]
                if eid not in tags_by_id and eid in cache:
                    tags_by_id[eid] = {
                        "role": role,
                        "labels": cache[eid].get("labels") or [],
                        "source": cache[eid].get("source") or "cache",
                    }

    # 写出最终打标结果（后端筛选读这个）
    payload = {
        "version": 1,
        "method": "llm_multilabel",
        "model": model,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total": len(tags_by_id),
        "docs": tags_by_id,
    }
    save_json(OUT_TAGS, payload)

    # 再汇总出侧边栏要显示的标签列表
    keywords = build_keywords_from_tags(tags_by_id)
    save_json(OUT_KEYWORDS, keywords)

    src_count = Counter(r["source"] for r in results)
    print(f"[llm-tag] saved tags -> {OUT_TAGS.relative_to(ROOT)}")
    print(f"[llm-tag] saved keywords -> {OUT_KEYWORDS.relative_to(ROOT)}")
    print(f"[llm-tag] sources: {dict(src_count)}")

    # 同步卡片/详情展示 tags，与语义标签保持一致
    try:
        from sync_experience_display_tags import main as sync_display_tags

        sync_display_tags()
    except Exception as e:
        print(f"[llm-tag] warn: sync display tags failed: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
