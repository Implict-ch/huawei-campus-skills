# 知识库分层

| 层 | 路径 | 性质 | 谁维护 | Agent 检索优先级 |
|----|------|------|--------|------------------|
| **公开课视频** | `knowledge/videos/segments/`（及 episodes） | 塔子哥 B 站公开课切片 | 维护者脚本 + 手工 | **最高**（冲突以视频为准） |
| **平台自有** | `knowledge/process/`、`experiences/platform/`、`coding-problems/` | 精编 / 平台内容 | 维护者脚本 + 手工 | **高** |
| **精编卡片** | `knowledge/exam/`、`application/`、`assessment/`、`interview/`、`roles/` | 人工策展（含 `policy_effective` 政策） | 维护者手工 | **中高**（分值/场次等硬政策） |
| **编译 Wiki** | `knowledge/wiki/compiled/` | 从面经确定性聚合（`compile_wiki.py`） | CI / 维护者脚本 | **中**（面经摘要，非个案全文） |
| **原始面经** | `knowledge/experiences/hw-exp-*.{nc,xhs}.md` | 牛客 / 小红书全文 | 采集脚本 | **低**（补充与交叉验证） |

## 原则

- **客户日常**：只用 `/hw-ask`、`/hw-match`；不跑采集、不跑 compile。
- **客户可选更新**：`/hw-update` → `git pull` 拉取维护者已编译好的知识包。
- **维护者 / CI**：`python scripts/hw_update.py --mode maintainer` 负责 ingest → filter → compile → manifest。
- **政策口径**：带 `policy_effective` 的 `knowledge/exam/*.md` **不被** compile 覆盖；compile 只写 `wiki/compiled/`。
