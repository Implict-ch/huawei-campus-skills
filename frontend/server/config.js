import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../.env") });

export const SERVER_DIR = __dirname;
export const ROOT = path.resolve(__dirname, "../..");

export const BUILTIN_API_KEY = process.env.BUILTIN_API_KEY || "";
export const BUILTIN_BASE_URL = process.env.BUILTIN_BASE_URL || "https://api.deepseek.com/v1";
export const BUILTIN_MODEL = process.env.BUILTIN_MODEL || "deepseek-v4-flash";

/** DeepSeek 已弃用 deepseek-chat，统一映射到 v4 */
export function normalizeChatModel(name) {
  const m = String(name || "").trim();
  if (!m || m === "deepseek-chat" || m === "deepseek-reasoner") return "deepseek-v4-flash";
  return m;
}

export const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || "";
export const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1";
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
export const LOCAL_EMBEDDING_MODEL = process.env.LOCAL_EMBEDDING_MODEL || "BAAI/bge-small-zh-v1.5";
export const EMBEDDING_CACHE = path.join(ROOT, "frontend", "tmp", "knowledge-embeddings.json");
export const USE_LOCAL_EMBEDDING = process.env.USE_LOCAL_EMBEDDING !== "false";
export const embeddingApiEnabled = Boolean(EMBEDDING_API_KEY);
export const embeddingClient = embeddingApiEnabled
  ? new OpenAI({ apiKey: EMBEDDING_API_KEY, baseURL: EMBEDDING_BASE_URL, timeout: 60000, maxRetries: 2 })
  : null;

export const KNOWLEDGE_DIR = path.join(ROOT, "knowledge");
export const EXPERIENCES_PUBLIC = path.join(ROOT, "frontend", "public", "experiences.json");
export const HAND_TEAR_DATA = path.join(ROOT, "frontend", "tmp", "hand_tear_data.json");
export const KEYWORDS_FILE = path.join(ROOT, "frontend", "public", "experience_keywords.json");
export const SEMANTIC_TAGS_FILE = path.join(ROOT, "frontend", "public", "experience_semantic_tags.json");
export const KNOWLEDGE_ASSETS_DIR = path.join(ROOT, "knowledge", "assets");

export const PORT = process.env.PORT || 3001;
