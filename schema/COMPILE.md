# Wiki 编译规则（模式 C）

`scripts/compile_wiki.py` 从 **原始面经** 生成 **编译 Wiki 卡片**，供 Agent 优先于全文面经检索。

## 输入

- `knowledge/experiences/hw-exp-*-nc-*.md`
- `knowledge/experiences/hw-exp-*-xhs-*.md`
- **不含** `knowledge/experiences/platform/`（平台面经单独维护）

## 输出

- 目录：`knowledge/wiki/compiled/*.md`
- Frontmatter 固定字段：
  - `kind: compiled_wiki`
  - `compile_source: experiences`
  - `source_grade: B`（多源聚合；单源不足时降为 C）
  - `source_count`、`compiled_at`、`source_hash`
- 正文区块（确定性生成，**不用 LLM**）：
  1. **统计**：匹配面经数、按 `published_at` 年份分布
  2. **高频标签**：tags 计数 Top 10
  3. **摘录要点**：正文中匹配主题正则的句子/行（去重、限长）
  4. **近期面经索引**：按日期倒序最多 15 条（仅 id + 标题，供 Agent 按需 Read 原文）

## 主题映射

| 输出文件 | stage | 匹配条件 |
|----------|-------|----------|
| `wiki-exam-mechanics.md` | exam | stage=exam 且含机考/笔试/ACM/分值/通过线 |
| `wiki-exam-after-passing.md` | exam | 机考通过、面试通知、后续流程 |
| `wiki-exam-prep.md` | exam | 备考、刷题、牛客 OJ、七天上岸 |
| `wiki-exam-pitfalls.md` | exam | 坑、骗分、双机位违规、切屏 |
| `wiki-dual-camera.md` | exam | 双机位、摄像头、监考 |
| `wiki-assessment.md` | assessment | 测评、性格、心理 |
| `wiki-interview-tech.md` | interview | 技术面、手撕、项目深挖 |
| `wiki-interview-manager.md` | interview | 主管面、HR 面、综合面 |
| `wiki-application.md` | application | 投递、内推、志愿 |
| `wiki-offer.md` | offer | offer、意向、开奖 |

一篇面经可进入多个主题（多标签）。

## 增量

- 状态文件：`knowledge/.compile-manifest.json`
- 每个主题对「匹配面经路径列表 + 内容 hash」做 SHA256；未变则跳过写入。
- `--force` 强制全量重编。

## 与精编卡片关系

- `knowledge/exam/exam-format.md` 等 **人工政策卡片** 不被 compile 修改。
- Agent 答 **政策类** 问题时：先读 `exam/` 带 `policy_effective`，再用 `wiki/compiled/` 看面经侧信号，最后才 grep 全文面经。
