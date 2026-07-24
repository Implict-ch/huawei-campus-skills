# 华为校招智能助手部署指南

本文档说明如何将本项目部署到不同环境，并确保 RAG（检索增强生成）技术正常工作。

---

## 一、部署方式选择

| 部署目标 | 推荐方式 | 原因 |
|---|---|---|
| 本地开发/测试 | 本地 embedding 模型 | 无需额外 API 费用，已验证可用 |
| CodeFun2000 主站 | 建议优先使用 OpenAI Embedding API | 服务器环境稳定、无需 Python 3.11 和模型下载 |
| 客户本地部署 | 建议优先使用 OpenAI Embedding API | 客户机器环境不可控，本地模型依赖较多 |

---

## 二、通用环境要求

### 2.1 基础依赖

- **Node.js**（建议 v18+，当前项目使用 v24+）
- **npm** 或 **pnpm**
- 完整的 `knowledge/` 知识库目录
- 完整的 `frontend/` 前端目录

### 2.2 环境变量

复制 `frontend/.env.example` 为 `frontend/.env`，并填入实际配置：

```bash
cp frontend/.env.example frontend/.env
```

核心配置项：

```env
# 内置大模型（用于最终生成回答）
BUILTIN_API_KEY=sk-your-deepseek-key
BUILTIN_BASE_URL=https://api.deepseek.com/v1
BUILTIN_MODEL=deepseek-chat

# 方式一：本地 embedding（无需外部 API，依赖 Python 3.11）
USE_LOCAL_EMBEDDING=true
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5

# 方式二：外部 API embedding（推荐用于主站/客户部署）
# 如需启用，请填写并确保 USE_LOCAL_EMBEDDING 不设置或设为 false
EMBEDDING_API_KEY=sk-your-openai-key
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

**注意**：`EMBEDDING_API_KEY` 优先级高于本地模型。如果同时配置了 API Key 和本地模型，系统会优先使用 API。

---

## 三、场景一：本地开发/测试部署

### 3.1 安装依赖

```bash
cd frontend
npm install
```

### 3.2 安装 Python 3.11 及本地 embedding 依赖

```bash
# 确保 Python 3.11 已安装
python3.11 --version

# 安装依赖
python3.11 -m pip install sentence-transformers python-frontmatter
```

### 3.3 生成文档向量缓存

```bash
cd frontend
npm run build-embeddings
```

该命令会生成 `frontend/tmp/knowledge-embeddings.json`，包含所有知识库文档的 BGE 向量。

### 3.4 启动服务

```bash
# 启动后端
npm run server

# 或者同时启动前端开发服务器
npm run dev:all
```

### 3.5 验证

- 浏览器访问 `http://localhost:5175`（Vite 默认端口）
- 后端健康接口：`http://localhost:3001/api/health`
- 首次 AI 提问时，本地 Python Worker 会加载 BGE 模型（约 10-20 秒），后续响应更快

---

## 四、场景二：CodeFun2000 主站部署

### 4.1 推荐方案：使用 OpenAI Embedding API

主站部署建议直接使用外部 API embedding，避免服务器环境复杂化。

#### 4.1.1 配置环境变量

```env
BUILTIN_API_KEY=sk-your-deepseek-key
BUILTIN_BASE_URL=https://api.deepseek.com/v1
BUILTIN_MODEL=deepseek-chat

USE_LOCAL_EMBEDDING=false
EMBEDDING_API_KEY=sk-your-openai-key
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

#### 4.1.2 安装与启动

```bash
cd frontend
npm install
npm run server
```

**注意**：使用 API embedding 时，首次启动或新增文档时，系统会自动调用 OpenAI API 生成向量并缓存到 `frontend/tmp/knowledge-embeddings.json`。建议预先在本地生成好缓存文件并随部署一起上传，减少线上 API 调用量和启动时间。

### 4.2 备选方案：使用本地 embedding 模型

如果主站无法使用外部 API，可以使用本地模型，但需满足以下条件：

#### 4.2.1 服务器额外依赖

- **Python 3.11** 已安装
- 已安装 Python 依赖：
  ```bash
  python3.11 -m pip install sentence-transformers python-frontmatter
  ```
- 服务器能访问 HuggingFace 镜像 `https://hf-mirror.com`（用于下载约 100MB 的 BGE 模型），或已预置模型缓存

#### 4.2.2 预生成向量缓存（强烈建议）

在开发环境预先生成 `frontend/tmp/knowledge-embeddings.json`，并随代码一起部署到主站。这样可以避免线上首次启动时下载模型和生成向量。

```bash
cd frontend
npm run build-embeddings
```

#### 4.2.3 启动

```bash
cd frontend
npm install
npm run server
```

---

## 五、场景三：客户本地部署（从 GitHub 拉取）

客户环境差异较大，**强烈建议使用 OpenAI Embedding API**。

### 5.1 客户操作步骤

```bash
git clone <仓库地址>
cd <项目目录>/frontend
cp .env.example .env
# 编辑 .env，填入 BUILTIN_API_KEY 和 EMBEDDING_API_KEY
npm install
npm run server
```

### 5.2 如果客户坚持使用本地 embedding

需要额外告知客户安装：

- Python 3.11
- `sentence-transformers`
- `python-frontmatter`

并在客户机器上执行：

```bash
cd frontend
npm run build-embeddings
npm run server
```

### 5.3 注意事项

- `frontend/tmp/knowledge-embeddings.json` 文件较大（约 50 万行），如果随仓库提交，客户拉取时可能较慢
- 如果客户新增或修改了 `knowledge/` 中的 Markdown，需要重新执行 `npm run build-embeddings`

---

## 六、RAG / 向量检索说明

### 6.1 什么是 RAG 在本项目中的实现

本项目 RAG 流程：

1. 用户提问
2. 检索：关键词匹配 + BM25 + 向量余弦相似度 + 规则加权（混合搜索）
3. 增强：将检索到的参考资料拼接到 LLM 的 system prompt 中
4. 生成：调用 DeepSeek / OpenAI 等模型生成回答

### 6.2 向量检索是否 100% 启用

| 条件 | 向量检索 | 整体 RAG |
|---|---|---|
| 有 `knowledge-embeddings.json` 缓存 + 本地模型/API 可用 | ✅ | ✅ |
| 无 embedding 缓存 | ❌，回退到 BM25+关键词 | ✅ |
| 无 Python 3.11 且未配置 API Key | ❌，回退到 BM25+关键词 | ✅ |

**结论**：即使向量检索不可用，系统仍会使用关键词 + BM25 + 规则加权进行检索增强，RAG 框架始终工作。但神经网络语义检索需要满足 embedding 条件。

### 6.3 确保 100% 向量检索的方案

- **最简单**：配置 OpenAI Embedding API Key
- **最可控**：Docker 打包（包含 Python 3.11 + sentence-transformers + 预下载模型 + 预生成向量缓存）
- **最不建议**：依赖每台客户机器自己安装 Python 环境

---

## 七、常见问题

### Q1：启动后进程立刻退出怎么办？

当前项目使用 `dotenv@17.4.2`，在某些环境下会导致 Node.js 服务启动后异常退出。建议：

1. 降级 `dotenv` 到 `16.x`：
   ```bash
   cd frontend
   npm install dotenv@16
   ```
2. 检查 `frontend/.env` 是否正确配置
3. 使用 `npm run server` 查看日志定位问题

### Q2：首次 AI 提问响应很慢？

- 使用本地 embedding 时，首次启动 Python Worker 需要加载 BGE 模型（约 10-20 秒）
- 使用 API embedding 时，首次生成向量需要调用外部 API（约 1-3 秒）
- 后续提问会明显变快

### Q3：新增或修改了知识库文档怎么办？

如果使用本地 embedding，需要重新生成向量缓存：

```bash
cd frontend
npm run build-embeddings
```

如果使用 API embedding，后端启动时会自动检测缺失的向量并补齐。

### Q4：如何验证向量检索是否生效？

启动后端后查看日志：

- 本地模式：`[embedding] local mode: loaded N doc embeddings from cache (BAAI/bge-small-zh-v1.5)`
- API 模式：`[embedding] api mode, model=text-embedding-3-small`

如果看到 `[embedding] disabled ...`，说明未启用向量检索，已回退到关键词检索。

---

## 八、文件位置速查

| 文件/目录 | 说明 |
|---|---|
| `frontend/server/index.js` | 后端主入口，RAG 检索逻辑 |
| `frontend/.env` | 后端环境变量配置 |
| `frontend/.env.example` | 环境变量模板 |
| `frontend/tmp/knowledge-embeddings.json` | 文档向量缓存 |
| `knowledge/` | 知识库 Markdown 文件 |
| `scripts/build_embeddings.py` | 本地 embedding 生成脚本 |
| `scripts/embedding_worker.py` | 本地 embedding 推理 Worker |
| `skills/hw-ask/SKILL.md` | AI 回答规则与引用规范 |
