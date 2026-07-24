---
name: hw
description: >-
  华为校招技术岗 Skills 总入口。用户输入 /hw 或不确定用 ask 还是 match 时使用。展示 /hw-ask、/hw-match 并路由。
disable-model-invocation: true
---

# /hw — 总入口

| 命令 | 何时用 |
|------|--------|
| **`/hw-ask`** | 单个问题：投递、机考、测评、面试流程与准备 |
| **`/hw-match`** | 有 JD + 简历，要追问清单和手撕题 |
| **`/hw-update`** | 拉取最新知识包（客户 `git pull`；维护者跑采集+编译） |

知识库在本包 **`knowledge/`** 目录。分层见 `schema/LAYERS.md`。

## 回答原则（ask / match 共用）

1. **检索侧重**：CodeFun2000 + B 站公开课 → 精编卡片 + 编译 Wiki → 牛客/小红书面经全文
2. **来源链接与顺序**：前 2 条自有带链接；B 站固定 **`[A]`** 且链接前写 **「塔子哥公开课」**（须核对片段与问题相关，见 `hw-ask`；**回答里禁止写「字幕」**）；后 2 条牛客/小红书无链接
3. **禁止**在「依据与边界」写文件名、卡片 id、「政策卡片」等内部描述

详见 `skills/hw-ask/SKILL.md`、`skills/hw-match/SKILL.md`、`skills/hw-update/SKILL.md`。
