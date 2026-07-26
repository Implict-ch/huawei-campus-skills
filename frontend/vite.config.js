import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "mdx-components": path.resolve(root, "src/mdx/mdxComponents.jsx"),
      "@cf-shared": path.resolve(root, "shared"),
    },
  },
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        providerImportSource: "mdx-components",
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex],
      }),
    },
    react({ include: /\.(jsx|js|mdx|tsx|ts)$/ }),
  ],
  root,
  server: {
    port: 5175,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // 简历模拟面试会并行多轮 LLM，可能 30s+ 无正文；避免代理空闲断开导致「回复缺内容」
        timeout: 180000,
        proxyTimeout: 180000,
      },
      "/knowledge-assets": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(root, "dist"),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(root, "src/index.js"),
      name: "HwCampusSkillsFrontend",
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react-router-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-router-dom": "ReactRouterDOM",
        },
      },
    },
  },
});
