import fs from "node:fs";
import path from "node:path";

export function walk(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".") || entry.name === "assets") continue;
      files.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

export function computePathPriority(filePath) {
  const p = filePath.replace(/\\/g, "/");
  if (p.includes("knowledge/videos/segments/")) return 130;
  if (p.includes("knowledge/videos/")) return 120;
  if (p.includes("knowledge/coding-problems/acm-intro.md")) return 118;
  if (p.includes("knowledge/codenote/hw_note/")) return 112;
  if (p.includes("knowledge/coding-problems/hot100/")) return 110;
  if (p.includes("knowledge/process/")) return 100;
  if (p.includes("knowledge/experiences/platform/")) return 90;
  if (p.includes("knowledge/exam/")) return 60;
  if (p.includes("knowledge/wiki/compiled/")) return 55;
  if (p.includes("knowledge/application/") || p.includes("knowledge/assessment/") || p.includes("knowledge/interview/") || p.includes("knowledge/roles/")) return 50;
  if (p.includes("knowledge/experiences/")) return 30;
  return 10;
}
