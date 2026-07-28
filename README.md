# 华为校招 Agent Skills

面向 Cursor / Claude Code / Codex 的 **`/hw-ask` · `/hw-interview` 技能包** + 本地知识库（Git 分发）。

本仓库**不提供**可视化 Web 助手；线上产品见 Hydro 插件 `codefun2000.addons` → `hw-skills-page`。

```bash
npx skills add ./hw-skills --all -y
# 或：npx skills add git@github.com:codefun2000/hw-skills.git --all -y
```

## 客户日常

| 命令 | 作用 |
|------|------|
| `/hw-ask` | 答疑助手：投递、机考、测评、面试、offer 等——先结论，再标 A/B/C/D 证据 |
| `/hw-interview` | 模拟面试助手：根据简历生成项目追问、八股、手撕题与参考面经 |

知识更新：维护者将插件知识库 sync 并 `git push` 后，客户在本仓执行 `git pull`（或重新 `npx skills add`）。**无需**本地跑爬虫或 compile。

## 目录

```text
hw-skills/
├── README.md
├── SYNC.md              # 维护者：插件 knowledge → 本仓 一键同步说明书
├── schema/              # LAYERS.md / COMPILE.md
├── knowledge/           # 知识库（由插件 sync，勿在客户侧手改后指望被保留）
├── scripts/             # 维护者采集/编译脚本（可选）
├── skills/
│   ├── hw-ask/
│   └── hw-interview/
└── 华为算法岗手撕题/      # 手撕数据维护用（非客户产品）
```

## 知识库检索顺序

见 `knowledge/taxonomy.yaml` 的 `retrieval_priority`（若存在），以及各 `SKILL.md`：

1. 站内流程说明 + B 站公开课 + `hot100/` 手撕索引  
2. `exam/` 精编卡片 + `wiki/compiled/` 聚合摘要 + `assessment/` 等  
3. 牛客/小红书面经全文（补充）

面向客户的引用规则：B 站固定 `[A]`；CodeFun2000 带链接；牛客/小红书**不带外链**。详见 `skills/hw-ask/SKILL.md`。

## 安装

```bash
npx skills add <repo-path-or-url> --all -y
```

遵循 [Agent Skills 开放标准](https://agentskills.io/specification)。

安装后 IDE 中应仅出现 **`hw-ask`** 与 **`hw-interview`** 两个 skill。

## 维护者

- **日常改知识库**：先改插件 `codefun2000.addons/react-page/hw-skills-page/knowledge/`，验证线上 RAG 后按 **[SYNC.md](./SYNC.md)** 一键同步到本仓并推送。
- **采集流水线**（可选）：`python scripts/hw_update.py --mode maintainer` 等；产出若写在本仓 `knowledge/`，仍须以插件为 Source of Truth——建议将结果并入插件后再走 SYNC。

### 机考政策（2026）

以 `knowledge/exam/` 带 `policy_effective: 2026` 的卡片为准；面经中历史分值表述不可当作现行政策。
