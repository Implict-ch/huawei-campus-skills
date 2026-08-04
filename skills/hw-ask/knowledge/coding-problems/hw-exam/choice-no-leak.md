---
id: hw-choice-no-leak
kind: card
stage: exam
question_type: prep
roles: [ai]
source_grade: A
updated_at: 2026-08-04
title: AI 机考选择题 · 题面防泄露（Agent 强制）
---

# AI 机考选择题 · 题面防泄露

> **Agent 必读**：用户问选择题考点、频次、会不会考、怎么练、代表真题时，**先读本卡片**，再读 `stats.json` / `choice-question-index.json`。

## 知识库事实

- `choice-question-index.json`、`stats.json` 的 `choice_bank_*`：**仅元数据**（大类、小类、题数、qid、展示题号 `n`、刷题 URL），**不含题干与选项**。
- `hw-exam/index.json` 中 `is_choice_question: true` 条目仅为场次元数据（如「第1题-选择题」），**不含卷面**。
- **禁止**调用 CodeFun2000 `api/choice/list` 或其它接口向用户复述返回的 `questions` 正文。

## 允许输出（面向客户）

| 允许 | 示例 |
|------|------|
| 频次与占比 | 大类题数、占全库占比；**每个小类题数 + 占该类比例**（`choice_bank_tag2_stats`） |
| 小类名称 | 特征值分解、向量空间 |
| 代表真题表 | 题号列超链接 + 小类 |
| 考法概括（无题干） | 「以矩阵运算、特征值分解为主」 |
| 刷题入口 | [AI方向笔试-选择题专项题库](https://codefun2000.com/choice/hw) |

## 禁止输出（面向客户）

- 选择题**题干**、**选项**（A/B/C/D）、**答案解析**、**完整公式题面**
- 从牛客/小红书面经**摘录或复述**机考选择题卷面（即使知识库里有全文）
- 用户问「第53题怎么做」「把选项发我」→ **拒绝贴题面**，引导去 [choice/hw](https://codefun2000.com/choice/hw) 对应链接刷题

## 检索边界

1. **选择题考点/频次/推题**：只 Read `hw-exam/` 下 `choice-*`、`stats.json`、`exam-problem-stats.md`；**不要**为推题去 Read `knowledge/experiences/` 全文。
2. 若 Grep 命中 `experiences/` 且文件带 `contains_choice_stems: true`：**最多**用政策类一句话（如「20 道选择 + 2 道编程」），**禁止**引用该文件内「## 一、选择题」及以下段落。
3. 面经里一句话考点概括允许（如「考了 Transformer、PCA」），**禁止**展开成带选项的题面。

## 用户追问时的标准回复

用户要题干/选项/答案时：

```markdown
知识库与答疑助手不输出华为机考选择题卷面（版权与公平性）。请直接打开上表链接在 CodeFun2000 选择题专项题库中刷题；需要备考方向可继续问「线代怎么练」「大模型选择题考哪些」。
```
