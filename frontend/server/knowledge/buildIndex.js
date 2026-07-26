import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  ROOT,
  KNOWLEDGE_DIR,
  EMBEDDING_MODEL,
  LOCAL_EMBEDDING_MODEL,
  USE_LOCAL_EMBEDDING,
  embeddingClient,
} from "../config.js";
import { knowledgeDocs, setKnowledgeStats } from "./store.js";
import { computeBm25Stats } from "./bm25.js";
import { walk, computePathPriority } from "./walk.js";
import {
  fetchApiEmbedding,
  loadEmbeddingCache,
  saveEmbeddingCache,
} from "../embeddings.js";
import { resolveExperienceDisplayTags } from "../experiences.js";

export async function buildKnowledgeIndex() {
  const files = walk(KNOWLEDGE_DIR);
  let loaded = 0;
  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const { data, content } = matter(raw);
      const source = Array.isArray(data.sources) && data.sources[0] ? data.sources[0] : {};
      const title = String(data.title || source.title || content.match(/^#\s+(.+)$/m)?.[1] || "").trim();
      const relPath = path.relative(ROOT, file).replace(/\\/g, "/");
      const docId = data.id || relPath;
      const tags = relPath.includes("knowledge/experiences/")
        ? resolveExperienceDisplayTags(docId, data.tags || [])
        : Array.isArray(data.tags)
          ? data.tags
          : [];
      const keywords = Array.isArray(data.keywords) ? data.keywords : [];
      const searchText = [
        title,
        source.title || "",
        data.episode_title || "",
        data.series_title || "",
        data.id || "",
        data.stage || "",
        data.role || "",
        data.question_type || "",
        data.policy_effective || "",
        tags.join(" "),
        keywords.join(" "),
        content.slice(0, 8000),
      ]
        .join(" ")
        .toLowerCase();

      knowledgeDocs.push({
        id: docId,
        title,
        path: relPath,
        sourceGrade: data.source_grade || "",
        stage: data.stage || "",
        role: data.role || "",
        questionType: data.question_type || "",
        policyEffective: data.policy_effective || "",
        updatedAt: data.updated_at || "",
        timeRange: data.time_range || "",
        timeEndSec: data.time_end_sec || 0,
        episodeTitle: data.episode_title || "",
        seriesTitle: data.series_title || "",
        bvid: data.bvid || "",
        timeStartSec: data.time_start_sec || 0,
        tags,
        keywords,
        platform: source.platform || "",
        sourceUrl: source.url || "",
        sourceTitle: source.title || "",
        publishedAt: data.published_at || "",
        pathPriority: computePathPriority(relPath),
        content,
        searchText,
      });
      loaded++;
    } catch (err) {
      console.warn("[index] skip", file, err.message);
    }
  }
  console.log(`[knowledge] indexed ${loaded} docs`);
  const platformCounts = {};
  for (const d of knowledgeDocs) {
    platformCounts[d.platform] = (platformCounts[d.platform] || 0) + 1;
  }
  console.log("[knowledge] platforms:", platformCounts);

  const stats = computeBm25Stats();
  setKnowledgeStats(stats);
  console.log(`[bm25] computed stats for ${stats.N} docs, avgDL=${stats.avgDL.toFixed(2)}`);

  const cache = loadEmbeddingCache();
  if (embeddingClient) {
    console.log(`[embedding] api mode, model=${EMBEDDING_MODEL}`);
    let generated = 0;
    let reused = 0;
    for (const doc of knowledgeDocs) {
      const key = doc.path;
      if (cache[key] && cache[key].model === EMBEDDING_MODEL && cache[key].embedding) {
        doc.embedding = cache[key].embedding;
        reused++;
        continue;
      }
      try {
        const embedding = await fetchApiEmbedding(doc.searchText);
        if (embedding) {
          cache[key] = { model: EMBEDDING_MODEL, embedding };
          doc.embedding = embedding;
          generated++;
        }
      } catch (err) {
        console.warn("[embedding] failed for", doc.path, err.message);
      }
      if (generated % 50 === 0 && generated > 0) {
        saveEmbeddingCache(cache);
      }
    }
    saveEmbeddingCache(cache);
    console.log(`[embedding] api: generated ${generated}, reused ${reused}, total ${knowledgeDocs.length}`);
  } else if (USE_LOCAL_EMBEDDING) {
    let loadedEmb = 0;
    for (const doc of knowledgeDocs) {
      const key = doc.path;
      if (cache[key] && cache[key].embedding) {
        doc.embedding = cache[key].embedding;
        loadedEmb++;
      }
    }
    if (loadedEmb > 0) {
      console.log(`[embedding] local mode: loaded ${loadedEmb} doc embeddings from cache (${LOCAL_EMBEDDING_MODEL})`);
    } else {
      console.log(`[embedding] local mode: no cache found. Run: npm run build-embeddings`);
    }
  } else {
    console.log("[embedding] disabled (set EMBEDDING_API_KEY or USE_LOCAL_EMBEDDING=true)");
  }
}
