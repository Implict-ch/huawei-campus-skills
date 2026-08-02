# 知识库配图（Knowledge Assets）

本地图片放在本目录，按主题分子目录，例如 `exam/`、`process/`。

## 约定

| 项 | 规则 |
|---|---|
| 路径 | `knowledge/assets/<主题>/<文件名>.png\|jpg\|webp` |
| 卡片引用 | Markdown：`![](/knowledge-assets/<主题>/<文件名>.png)` |
| HTTP | 服务端挂载 `/knowledge-assets` → 本目录；开发时 Vite 代理同路径到 API |
| 命名 | 来源文档 id + 语义，如 `p0101-dual-camera-placement.png` |

## 待补文件（P0101）

- `exam/p0101-dual-camera-placement.png` — 已镜像（源：cdn `hypp0k8c9ac9voizkmyhb.png`）
- `exam/p0101-score-query-official.png` — 已镜像（源：`codefun2000.com/file/2/YZVPG57izuEfKrHaUUkzG.png`）

## CDN 防盗链说明

`cdn.codefun2000.com` 开启了 **Referer ACL**：浏览器直接打开、或从 `localhost` 页面 `<img>` 引用，常返回 `403 denied by Referer ACL`。  
带 `Referer: https://codefun2000.com/...` 则可下载。

因此知识库配图应 **镜像到本目录** 后用 `/knowledge-assets/...` 展示，不要在对话里热链 CDN。  
上线到 codefun2000 同域后热链或可工作，仍建议以本地镜像为准（本地调试、防链变更、离线包都稳）。
