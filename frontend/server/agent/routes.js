import OpenAI from "openai";
import {
  BUILTIN_API_KEY,
  BUILTIN_BASE_URL,
  BUILTIN_MODEL,
  normalizeChatModel,
} from "../config.js";
import {
  SYSTEM_PROMPT,
  OFF_TOPIC_REPLY,
  WEAK_RETRIEVAL_REPLY,
  META_GREETING_REPLY,
  ACK_NO_HISTORY_REPLY,
  META_GREETING_SUGGESTIONS,
} from "../prompts.js";
import { writePlainSse, writeOffTopicSse } from "../lib/sse.js";
import {
  isMetaGreeting,
  isConversationalAck,
  historyHasSubstance,
  isLikelyOffTopic,
} from "./guards.js";
import { buildSuggestedFollowups } from "./followups.js";
import { isAiAlgorithmQuestion, loadAiHandTearSamples } from "./handTear.js";
import { postProcessCodeFunLinks } from "./postProcess.js";
import {
  buildRetrievalQuery,
  normalizeHistory,
  prepareModelHistory,
  retrieveDocsScored,
  selectCitationSources,
  inferQueryIntents,
} from "../retrieval.js";
import {
  formatRetrieved,
  formatVideoTimestampHint,
  toRetrievedMeta,
  isExamTrackQuestion,
  isTargetUniversityQuestion,
  ensureExamTrackCard,
  ensureTargetUniversityCard,
} from "../knowledge/formatContext.js";

export function registerAgentRoutes(app) {
  app.post("/api/agent", async (req, res) => {
    const { question, history, apiKey, model, baseUrl } = req.body;
    if (!question?.trim()) {
      return res.status(400).json({ error: "缺少 question" });
    }

    if (isMetaGreeting(question)) {
      return writePlainSse(res, META_GREETING_REPLY, {
        metaGreeting: true,
        suggestions: META_GREETING_SUGGESTIONS,
      });
    }

    const ack = isConversationalAck(question);
    const hasSubstanceHistory = historyHasSubstance(history);

    if (ack && !hasSubstanceHistory) {
      return writePlainSse(res, ACK_NO_HISTORY_REPLY, { conversationalAck: true });
    }

    if (isLikelyOffTopic(question)) {
      return writeOffTopicSse(res, OFF_TOPIC_REPLY);
    }

    let finalApiKey = String(apiKey || "").trim();
    let finalBaseUrl = baseUrl ? String(baseUrl).trim() : "";
    let finalModel = model || "gpt-4o-mini";

    if (model === "builtin-deepseek") {
      if (!BUILTIN_API_KEY) {
        return res.status(400).json({ error: "服务端未配置内置模型 API Key" });
      }
      finalApiKey = BUILTIN_API_KEY;
      finalBaseUrl = BUILTIN_BASE_URL;
      finalModel = BUILTIN_MODEL;
    } else if (!finalApiKey) {
      return res.status(400).json({ error: "缺少 API Key" });
    }

    finalModel = normalizeChatModel(finalModel);

    const historyForRetrieval = normalizeHistory(history);
    let retrievalQuery = buildRetrievalQuery(question, historyForRetrieval);
    if (ack && hasSubstanceHistory) {
      const lastUser = [...historyForRetrieval]
        .reverse()
        .find((m) => m.role === "user" && !isConversationalAck(m.content) && !isMetaGreeting(m.content));
      if (lastUser?.content) retrievalQuery = buildRetrievalQuery(lastUser.content, historyForRetrieval);
    }
    const abortController = new AbortController();
    const onResponseClose = () => {
      if (!res.writableEnded) abortController.abort();
    };
    res.on("close", onResponseClose);

    try {
      const scored = await retrieveDocsScored(retrievalQuery, 12);
      if (scored.weak && !(hasSubstanceHistory && (ack || String(question).trim().length <= 20))) {
        return writePlainSse(res, WEAK_RETRIEVAL_REPLY, { weakRetrieval: true });
      }

      let retrieved = scored.weak ? [] : scored.docs;
      if (!scored.weak && isExamTrackQuestion(retrievalQuery)) {
        retrieved = ensureExamTrackCard(retrieved);
      }
      if (!scored.weak && isTargetUniversityQuestion(retrievalQuery)) {
        retrieved = ensureTargetUniversityCard(retrieved);
      }
      const citationDocs =
        scored.weak || ack ? [] : selectCitationSources(scored.ranked);
      let context = formatRetrieved(retrieved);
      context += formatVideoTimestampHint(retrieved);
      if (
        retrieved.length > 0 &&
        (isAiAlgorithmQuestion(question) || isAiAlgorithmQuestion(retrievalQuery))
      ) {
        context += loadAiHandTearSamples();
      }

      const client = new OpenAI({
        apiKey: finalApiKey,
        baseURL: finalBaseUrl || undefined,
        timeout: 60000,
        maxRetries: 1,
      });

      const { messages: historyMessages } = await prepareModelHistory(history, {
        client,
        model: finalModel,
      });

      const messages = [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + context },
        ...historyMessages,
        { role: "user", content: question },
      ];

      const chat = await client.chat.completions.create(
        {
          model: finalModel,
          messages,
          temperature: 0.3,
          max_tokens: 1500,
          stream: true,
        },
        { signal: abortController.signal }
      );

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.status(200);

      let fullAnswer = "";
      try {
        for await (const chunk of chat) {
          if (abortController.signal.aborted) break;
          const delta = chunk.choices?.[0]?.delta?.content || "";
          if (!delta) continue;
          fullAnswer += delta;
          res.write(`data: ${JSON.stringify({ chunk: delta, done: false })}\n\n`);
        }
      } catch (streamErr) {
        if (abortController.signal.aborted || streamErr?.name === "AbortError") {
          if (fullAnswer) {
            res.write(
              `data: ${JSON.stringify({ done: true, retrieved: toRetrievedMeta(citationDocs), aborted: true })}\n\n`
            );
          } else {
            res.write(`data: ${JSON.stringify({ done: true, retrieved: [], aborted: true })}\n\n`);
          }
          res.end();
          return;
        }
        throw streamErr;
      }

      if (abortController.signal.aborted) {
        res.write(
          `data: ${JSON.stringify({ done: true, retrieved: toRetrievedMeta(citationDocs), aborted: true })}\n\n`
        );
        res.end();
        return;
      }

      const answer = postProcessCodeFunLinks(fullAnswer);
      if (answer !== fullAnswer) {
        res.write(`data: ${JSON.stringify({ answer, done: false, replace: true })}\n\n`);
      }

      const suggestions =
        ack || scored.weak
          ? []
          : buildSuggestedFollowups({
              question,
              answer,
              history: historyForRetrieval,
              citationDocs,
              intents: inferQueryIntents(question),
            });

      res.write(
        `data: ${JSON.stringify({
          done: true,
          retrieved: toRetrievedMeta(citationDocs),
          suggestions,
        })}\n\n`
      );
      res.end();
    } catch (err) {
      if (abortController.signal.aborted || err?.name === "AbortError") {
        if (!res.headersSent) {
          res.status(499).end();
        } else {
          try {
            res.write(`data: ${JSON.stringify({ done: true, retrieved: [], aborted: true })}\n\n`);
            res.end();
          } catch {
            // ignore
          }
        }
        return;
      }
      console.error("[agent] error", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "调用模型失败" });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message || "调用模型失败", done: true })}\n\n`);
        res.end();
      }
    } finally {
      res.off("close", onResponseClose);
    }
  });
}
