#!/usr/bin/env python3
"""把 D:\hw-campus-skills\华为算法岗手撕题 目录下的题目合并进 hand_tear_data.json。

目录结构：
  华为算法岗手撕题/
  ├── 机器学习/Pxxxx/{题面.md, 网址.txt, 标题.txt}
  ├── 深度学习/Pxxxx/{题面.md, 网址.txt, 标题.txt}
  └── 大模型岗/Pxxxx/{题面.md, 网址.txt, 标题.txt}
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "华为算法岗手撕题"
OUT_FILE = ROOT / "frontend" / "tmp" / "hand_tear_data.json"
EXP_FILE = ROOT / "frontend" / "public" / "experiences.json"

CATEGORY_TO_GROUP = {
    "机器学习": "算法/AI 岗",
    "深度学习": "算法/AI 岗",
    "大模型岗": "算法/AI 岗",
}

# 分类展示名 -> URL slug（避免中文路由）
CATEGORY_SLUGS = {
    "大模型岗": "llm",
    "机器学习": "ml",
    "深度学习": "dl",
}

# 传统工程岗的现有分类（保留）
TRADITIONAL_GROUP = "传统工程岗"


def extract_keywords(title: str) -> list[str]:
    """从题目标题中提取可匹配面经的关键词。"""
    title_lower = title.lower()
    keywords = []
    # 常见算法/AI 术语映射（保持与面经文本中的写法一致）
    term_map = {
        "grpo": "grpo",
        "ppo": "ppo",
        "self-attention": "self-attention",
        "attention": "attention",
        "transformer": "transformer",
        "adamw": "adamw",
        "adam": "adam",
        "k-means": "k-means",
        "kmeans": "k-means",
        "k-means": "k-means",
        "fm": "fm",
        "factorization machine": "fm",
        "factorization": "factorization",
        "bp": "bp",
        "反向传播": "反向传播",
        "梯度下降": "梯度下降",
        "em": "em 算法",
        "pca": "pca",
        "lstm": "lstm",
        "rnn": "rnn",
        "cnn": "cnn",
        "bert": "bert",
        "lora": "lora",
        "svm": "svm",
        "支持向量机": "支持向量机",
        "决策树": "决策树",
        "随机森林": "随机森林",
        "softmax": "softmax",
        "交叉熵": "交叉熵",
        " KL": "kl",
        "mlp": "mlp",
        "归一化": "归一化",
        "激活函数": "激活函数",
        "dropout": "dropout",
        "batchnorm": "batchnorm",
        "layer norm": "layer norm",
        "卷积": "卷积",
        "池化": "池化",
        "目标检测": "目标检测",
        "图像分类": "图像分类",
        "语义分割": "语义分割",
        "生成对抗": "生成对抗",
        "gan": "gan",
        "vae": "vae",
        "diffusion": "diffusion",
        "强化学习": "强化学习",
        "rl": "强化学习",
        "推荐系统": "推荐系统",
        "协同过滤": "协同过滤",
        "矩阵分解": "矩阵分解",
        "auc": "auc",
        "roc": "roc",
        "f1": "f1",
        "准确率": "准确率",
        "召回率": "召回率",
        "precision": "precision",
        "recall": "recall",
    }
    for term, search in term_map.items():
        if term in title_lower:
            keywords.append(search)
    # 去重保序
    seen = set()
    uniq = []
    for k in keywords:
        if k not in seen:
            seen.add(k)
            uniq.append(k)
    return uniq


def build_experience_index() -> list[dict]:
    """构建面经全文索引，用于按关键词匹配真实来源。"""
    if not EXP_FILE.exists():
        return []
    data = json.loads(EXP_FILE.read_text(encoding="utf-8"))
    grouped = data.get("grouped", {})
    idx = []
    for role, items in grouped.items():
        for it in items:
            path = ROOT / it["filePath"]
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8").lower()
            tag_text = " ".join(it.get("tags", [])).lower()
            idx.append(
                {
                    "id": it["id"],
                    "title": it["title"],
                    "role": it["role"],
                    "text": text + " " + tag_text,
                }
            )
    return idx


def find_related_experiences(title: str, exp_index: list[dict], max_results: int = 2) -> list[dict]:
    """根据题目标题关键词，在面经中找真实相关来源。"""
    keywords = extract_keywords(title)
    if not keywords:
        return []

    matches = []
    for e in exp_index:
        score = 0
        for kw in keywords:
            if kw in e["text"]:
                score += 1
        if score > 0:
            matches.append({**e, "score": score})

    # 按相关度降序，再按标题去重
    matches.sort(key=lambda x: (-x["score"], x["title"]))
    seen = set()
    out = []
    for m in matches:
        if m["id"] in seen:
            continue
        seen.add(m["id"])
        out.append({"id": m["id"], "title": m["title"], "role": m["role"]})
        if len(out) >= max_results:
            break
    return out


def parse_ai_problems() -> list[dict]:
    problems: list[dict] = []
    if not SRC_DIR.exists():
        raise FileNotFoundError(f"找不到目录: {SRC_DIR}")

    exp_index = build_experience_index()

    for category_dir in sorted(SRC_DIR.iterdir()):
        if not category_dir.is_dir():
            continue
        category = category_dir.name
        group = CATEGORY_TO_GROUP.get(category, "算法/AI 岗")
        for pid_dir in sorted(category_dir.iterdir()):
            if not pid_dir.is_dir():
                continue
            title_file = pid_dir / "标题.txt"
            url_file = pid_dir / "网址.txt"

            if not (title_file.exists() and url_file.exists()):
                continue

            title = title_file.read_text(encoding="utf-8").strip()
            url = url_file.read_text(encoding="utf-8").strip().splitlines()[0].strip()

            # 只关联真实相关的面经来源；找不到就为空
            sources = find_related_experiences(title, exp_index, max_results=2)

            problems.append(
                {
                    "title": title,
                    "codefun_url": url,
                    "leetcode_url": "",
                    "category": category,
                    "group": group,
                    "sources": sources,
                }
            )
    return problems


def load_existing() -> dict:
    if not OUT_FILE.exists():
        return {"categories": [], "problems": []}
    return json.loads(OUT_FILE.read_text(encoding="utf-8"))


def merge() -> dict:
    data = load_existing()
    ai_problems = parse_ai_problems()

    # 给现有分类补上 group 字段（传统工程岗）
    for cat in data.get("categories", []):
        cat.setdefault("group", TRADITIONAL_GROUP)

    # 移除旧 AI 岗题目，避免重复合并
    data["problems"] = [p for p in data.get("problems", []) if p.get("group") != "算法/AI 岗"]
    data["categories"] = [c for c in data.get("categories", []) if c.get("group") != "算法/AI 岗"]

    # 加入新分类
    existing_cats = {c["name"] for c in data.get("categories", [])}
    for p in ai_problems:
        if p["category"] not in existing_cats:
            data["categories"].append(
                {
                    "name": p["category"],
                    "count": 0,
                    "slug": CATEGORY_SLUGS.get(p["category"], p["category"]),
                    "group": p["group"],
                }
            )
            existing_cats.add(p["category"])

    # 合并题目（AI 岗题放在前面，按分类分组）
    all_problems = ai_problems + data["problems"]
    cat_counts = {}
    for p in all_problems:
        cat_counts[p["category"]] = cat_counts.get(p["category"], 0) + 1
    for c in data["categories"]:
        c["count"] = cat_counts.get(c["name"], 0)

    data["problems"] = all_problems

    # 「原创 / 变种」是聚合视图：计数=所有 original/variant，不限 category 字段
    orig_count = sum(1 for p in all_problems if p.get("kind") in ("original", "variant"))
    for c in data["categories"]:
        if c.get("name") == "原创 / 变种":
            c["count"] = orig_count
            break
    else:
        if orig_count:
            data["categories"].append(
                {
                    "name": "原创 / 变种",
                    "count": orig_count,
                    "slug": "original",
                    "group": TRADITIONAL_GROUP,
                }
            )

    print(f"[merge-ai] parsed {len(ai_problems)} AI hand-tear problems")
    print(f"[merge-ai] total categories: {len(data['categories'])}")
    print(f"[merge-ai] total problems: {len(data['problems'])}")
    return data


def main():
    data = merge()
    OUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[merge-ai] saved -> {OUT_FILE}")


if __name__ == "__main__":
    main()
