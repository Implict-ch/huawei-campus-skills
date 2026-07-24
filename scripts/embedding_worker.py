"""本地 Embedding 推理 Worker（无外部 API）。

由 Node.js 后端通过 stdin/stdout 启动并常驻。接收 JSON 行请求，
返回 sentence-transformers 生成的归一化向量。

请求格式（每行一个 JSON 对象）：
    {"texts": ["文本1", "文本2", ...]}

响应格式：
    {"embeddings": [[0.1, ...], [0.2, ...]]}

启动前建议设置 HuggingFace 镜像：
    $env:HF_ENDPOINT="https://hf-mirror.com"  # PowerShell

用法：
    py -3.11 scripts/embedding_worker.py
"""

from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

from sentence_transformers import SentenceTransformer

MODEL_NAME = os.environ.get("LOCAL_EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")


def main() -> None:
    sys.stderr.write(f"[embedding-worker] loading {MODEL_NAME} ...\n")
    sys.stderr.flush()

    model = SentenceTransformer(MODEL_NAME)

    sys.stderr.write("[embedding-worker] ready\n")
    sys.stderr.flush()

    # 发送 ready 信号到 stdout，方便 Node.js 判断启动完成
    print(json.dumps({"status": "ready"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            texts = req.get("texts", [])
            if isinstance(texts, str):
                texts = [texts]
            if not texts:
                print(json.dumps({"error": "empty texts"}), flush=True)
                continue
            embeddings = model.encode(
                texts,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            print(
                json.dumps({"embeddings": [e.tolist() for e in embeddings]}),
                flush=True,
            )
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
