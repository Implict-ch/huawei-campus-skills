---
name: hw-match
description: >-
  根据华为校招 JD 和简历，从 knowledge/ 检索面经，输出匹配分析、高频追问、手撕题与备考优先级。触发：/hw-match、按简历准备华为面试。
disable-model-invocation: true
---

# /hw-match — JD + 简历匹配

## 输入

必需：**JD** + **简历**（文件或粘贴）。缺一项只追问一次。忽略手机号/邮箱/身份证。

可选：当前阶段、距面试天数、方向（软件|AI|嵌入式）。

## 流程

1. 提取 JD 画像与简历证据（有/无/易被深挖）
2. **按优先级 Grep**（与 `/hw-ask` 一致）：
   - **先**：`knowledge/experiences/platform/`、`knowledge/process/platform-*.md`
   - **再**：`knowledge/exam/`（政策）、`knowledge/wiki/compiled/`（面经聚合）、`interview/` 等卡片
   - **后**：`knowledge/experiences/hw-exp-*-nc-*.md`、`hw-exp-*-xhs-*.md`（全文个案）
3. **先检索后总结** — 问题必须标来源：简历|JD|面经|通用；面经类追问优先用检索到的站内/聚合内容
4. **推荐手撕题（Agent 内部）** — 仅从 `knowledge/coding-problems/hot100/index.json` 选题并取 `source_url`；需要题意时 Read 对应题面。**禁止**用 `coding-problems/index.json`（面经 `/ide/` 链）、牛客或库外 URL 充当手撕题链接
5. **参考面经引用**（顺序同 `/hw-ask`）：**前 2 条** 可带链接的自有来源 / B 站（B 站须核对相关度，见 `hw-ask`）；**后最多 2 条** 牛客/小红书（只写平台+标题，无 URL）

## 面向客户文风

报告正文应读起来像**正常咨询建议**，不要暴露 Agent 检索过程或仓库结构。

**禁止**在报告中出现：`knowledge/`、`index.json`、`hot100`、卡片 id、`statement_path`、Grep/Read、「均来自…索引/清单」、知识库、检索优先级等内部用语。

**手撕题表格**：只写题目标题、标签、**自然理由**（面经常考、补某类弱项、与项目相关等）、可点击链接；**不要**解释链接从哪张表来。

**追问清单**：用自然表述挂钩依据，如「结合你的 Redis 短链项目」「多位软开面经提到」；可写《面经标题》，**不要**写文件路径或内部 id。

**参考面经**：沿用 `/hw-ask` 的 `[A/B/C/D]` 与链接规则；条目读起来像推荐阅读，不要写成「检索命中」。

## 输出格式

```markdown
# 匹配报告

## 岗位判断
…

## JD 与简历证据
| JD | 简历证据 | 判断 |

## 最可能被问的问题
1. 短链请求从进入到 302，Redis 与 MySQL 各做什么？缓存未命中怎么办？ — 结合你的短链项目；软开面经常深挖
2. …

## 推荐手撕题
| 题 | 标签 | 理由 | 链接 |
| 有效的括号 | 栈 | 技术面常见；你栈类练习偏少 | [LeetCode 20. 有效的括号](https://codefun2000.com/p/P4025) |

## 备考优先级（P0/P1/…）
…

## 参考面经
- [B] [Ai方向 全程双机位](https://codefun2000.com/ide/P2522) — 站内面经
- [A] 塔子哥公开课 [机考备考指南](https://www.bilibili.com/video/BV1zJNG61EW8?t=366) — B站 **06:06–08:08**
- [C] 牛客面经《华为 校招 一面》
- [C] 小红书面经《华为暑期实习经验》
```

## 禁止（Agent 内部与客户正文均需遵守）

编造内部题库；声称精准押题；无依据匹配度百分比；在报告中输出牛客/小红书 URL；手撕题链接不在 hot100 索引内；**向客户暴露仓库路径、索引文件名或检索过程**。

## 岗位方向

见 `knowledge/roles/roles-overview.md` — 软件 / AI / 嵌入式
