import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  ROOT,
  EMBEDDING_CACHE,
  EMBEDDING_MODEL,
  LOCAL_EMBEDDING_MODEL,
  USE_LOCAL_EMBEDDING,
  embeddingClient,
} from "./config.js";

export async function fetchApiEmbedding(text) {
  if (!embeddingClient) return null;
  const input = text.slice(0, 8000);
  const res = await embeddingClient.embeddings.create({ model: EMBEDDING_MODEL, input });
  return res.data[0].embedding;
}

let localEmbeddingWorker = null;
let localEmbeddingReady = false;
let localEmbeddingRequestId = 0;
const localEmbeddingPending = new Map();

function startLocalEmbeddingWorker() {
  if (localEmbeddingWorker) return;
  console.log("[embedding-worker] starting local embedding worker (Python 3.11 + sentence-transformers)...");
  const proc = spawn("py", ["-3.11", "scripts/embedding_worker.py"], {
    cwd: ROOT,
    env: { ...process.env, HF_ENDPOINT: "https://hf-mirror.com", LOCAL_EMBEDDING_MODEL },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  proc.stdout.on("data", (data) => {
    buffer += data.toString();
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      try {
        const msg = JSON.parse(line);
        if (msg.status === "ready") {
          localEmbeddingReady = true;
          console.log("[embedding-worker] ready");
          continue;
        }
        const reqId = msg._requestId;
        if (reqId && localEmbeddingPending.has(reqId)) {
          const { resolve, reject } = localEmbeddingPending.get(reqId);
          localEmbeddingPending.delete(reqId);
          if (msg.error) reject(new Error(msg.error));
          else resolve(msg.embeddings);
        }
      } catch (err) {
        console.warn("[embedding-worker] bad line:", line, err.message);
      }
    }
  });

  proc.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (text) console.log("[embedding-worker]", text);
  });

  proc.on("exit", (code) => {
    console.log("[embedding-worker] exited with code", code);
    localEmbeddingWorker = null;
    localEmbeddingReady = false;
    for (const { reject } of localEmbeddingPending.values()) {
      reject(new Error("embedding worker exited"));
    }
    localEmbeddingPending.clear();
  });

  localEmbeddingWorker = proc;
}

async function fetchLocalEmbeddings(texts) {
  if (!USE_LOCAL_EMBEDDING) return null;
  if (!localEmbeddingWorker) startLocalEmbeddingWorker();

  if (!localEmbeddingReady) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("embedding worker start timeout")), 120000);
      const check = setInterval(() => {
        if (localEmbeddingReady) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  const requestId = `${Date.now()}-${++localEmbeddingRequestId}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      localEmbeddingPending.delete(requestId);
      reject(new Error("embedding worker timeout"));
    }, 60000);

    localEmbeddingPending.set(requestId, {
      resolve: (embeddings) => {
        clearTimeout(timeout);
        resolve(embeddings);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    localEmbeddingWorker.stdin.write(JSON.stringify({ texts: Array.isArray(texts) ? texts : [texts], _requestId: requestId }) + "\n");
  });
}

export async function fetchEmbedding(text) {
  if (embeddingClient) return fetchApiEmbedding(text);
  if (USE_LOCAL_EMBEDDING) {
    const embeddings = await fetchLocalEmbeddings([text]);
    return embeddings ? embeddings[0] : null;
  }
  return null;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function loadEmbeddingCache() {
  try {
    return JSON.parse(fs.readFileSync(EMBEDDING_CACHE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveEmbeddingCache(cache) {
  fs.mkdirSync(path.dirname(EMBEDDING_CACHE), { recursive: true });
  fs.writeFileSync(EMBEDDING_CACHE, JSON.stringify(cache, null, 2), "utf-8");
}

export { EMBEDDING_MODEL, LOCAL_EMBEDDING_MODEL, USE_LOCAL_EMBEDDING, embeddingClient };
