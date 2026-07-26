import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORT, KNOWLEDGE_ASSETS_DIR } from "./config.js";
import { buildKnowledgeIndex } from "./knowledge/buildIndex.js";
import { registerExperiencesRoutes } from "./experiences.js";
import { registerAgentRoutes } from "./agent/routes.js";
import handleResumeInterview from "./resumeInterview.js";
import { handleResumeUpload } from "./resumeUpload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

app.use(
  "/knowledge-assets",
  express.static(KNOWLEDGE_ASSETS_DIR, {
    maxAge: 0,
    etag: true,
    lastModified: true,
    fallthrough: true,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    },
  })
);

registerExperiencesRoutes(app);
registerAgentRoutes(app);

app.post("/api/resume-upload", handleResumeUpload);
app.post("/api/resume-interview", handleResumeInterview);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const startServer = () => {
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
};

buildKnowledgeIndex()
  .then(startServer)
  .catch((err) => {
    console.error("[knowledge] failed to build index", err);
    process.exit(1);
  });
