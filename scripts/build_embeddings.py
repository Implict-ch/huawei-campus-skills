"""生成本地文档 embedding 缓存，供 RAG 混合搜索使用。

运行要求：
- Python 3.10+（已验证 Python 3.11）
- sentence-transformers（会自动下载 BGE 等模型）
- python-frontmatter

首次运行会从 HuggingFace 下载模型，建议设置镜像：
    $env:HF_ENDPOINT="https://hf-mirror.com"  # PowerShell
    export HF_ENDPOINT=https://hf-mirror.com   # Linux/macOS

用法：
    py -3.11 scripts/build_embeddings.py

输出：
    frontend/tmp/knowledge-embeddings.json
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

import frontmatter
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = ROOT / "knowledge"
CACHE_FILE = ROOT / "frontend" / "tmp" / "knowledge-embeddings.json"
MODEL_NAME = os.environ.get("LOCAL_EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")
BATCH_SIZE = int(os.environ.get("EMBEDDING_BATCH_SIZE", "32"))


def walk(dir_path: Path) -> list[Path]:
    files: list[Path] = []
    for entry in sorted(dir_path.iterdir()):
        if entry.is_dir():
            # 与前端索引保持一致：跳过备份 / 归档 / 临时目录
            if entry.name.startswith("_") or entry.name.startswith("."):
                continue
            files.extend(walk(entry))
        elif entry.is_file() and entry.name.endswith(".md"):
            files.append(entry)
    return files


def build_search_text(path: Path) -> str:
    raw = path.read_text(encoding="utf-8")
    post = frontmatter.loads(raw)
    data = post.metadata
    content = post.content

    sources = data.get("sources")
    source = sources[0] if isinstance(sources, list) and sources else {}

    title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    title = str(
        data.get("title")
        or source.get("title")
        or (title_match.group(1) if title_match else "")
    ).strip()

    tags = data.get("tags") if isinstance(data.get("tags"), list) else []
    keywords = data.get("keywords") if isinstance(data.get("keywords"), list) else []

    parts = [
        title,
        str(source.get("title", "")),
        str(data.get("id", "")),
        str(data.get("stage", "")),
        str(data.get("role", "")),
        str(data.get("question_type", "")),
        str(data.get("policy_effective", "")),
        " ".join(str(t) for t in tags),
        " ".join(str(k) for k in keywords),
        content[:8000],
    ]
    return " ".join(parts).lower()


def main() -> None:
    files = walk(KNOWLEDGE_DIR)
    print(f"[embedding] found {len(files)} knowledge docs")

    cache: dict[str, dict] = {}
    if CACHE_FILE.exists():
        try:
            cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            print(f"[embedding] loaded cache with {len(cache)} entries")
        except Exception as e:
            print(f"[embedding] failed to load cache: {e}")

    def file_hash(path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()[:16]

    need_embed: list[tuple[str, str, str]] = []
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        cached = cache.get(rel)
        current_hash = file_hash(path)
        if (
            cached
            and cached.get("model") == MODEL_NAME
            and cached.get("embedding")
            and cached.get("hash") == current_hash
        ):
            continue
        need_embed.append((rel, build_search_text(path), current_hash))

    # Remove cached entries for files that no longer exist
    current_rels = {path.relative_to(ROOT).as_posix() for path in files}
    stale = [rel for rel in cache if rel not in current_rels]
    for rel in stale:
        del cache[rel]

    if not need_embed:
        if stale:
            CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[embedding] removed {len(stale)} stale entries, saved {len(cache)} embeddings")
        else:
            print("[embedding] all docs already have up-to-date embeddings")
        return

    print(f"[embedding] generating {len(need_embed)} embeddings with {MODEL_NAME} ...")
    model = SentenceTransformer(MODEL_NAME)

    texts = [text for _, text, _ in need_embed]
    embeddings = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        normalize_embeddings=True,
    )

    for (rel, _, current_hash), emb in zip(need_embed, embeddings):
        cache[rel] = {"model": MODEL_NAME, "hash": current_hash, "embedding": emb.tolist()}

    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[embedding] saved {len(cache)} embeddings to {CACHE_FILE}")


if __name__ == "__main__":
    main()
