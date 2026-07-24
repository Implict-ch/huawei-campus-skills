# 华为校招 Agent Skills

面向 Cursor / Claude Code / Codex 的 **`/hw-*` 技能包** + 本地知识库（模式 A：Git 分发知识包）。

```bash
npx skills add ./hw-campus-skills --all -y
```

## 客户日常

| 命令 | 作用 |
|------|------|
| `/hw` | 菜单与路由 |
| `/hw-ask <问题>` | 投递/机考/测评/面试 — **先结论，再标 A/B/C/D 证据** |
| `/hw-match` | JD + 简历 → 高频追问 + 手撕题 + 备考顺序 |
| `/hw-update` | （可选）`git pull` 拉取维护者已编译的知识包 |

**不需要**本地跑爬虫或 compile；问答只走 `/hw-ask` / `/hw-match`。

## 目录

```text
hw-campus-skills/
├── README.md
├── schema/              # LAYERS.md / COMPILE.md（分层与编译规则）
├── knowledge/
│   ├── taxonomy.yaml
│   ├── .manifest.json       # 包版本与条数（compile 后生成）
│   ├── process/               # CodeFun2000 流程说明
│   ├── exam/                  # 精编政策卡片（人工维护）
│   ├── wiki/compiled/         # 面经聚合 Wiki（compile_wiki.py）
│   ├── experiences/           # 原始面经（牛客/小红书）
│   │   └── platform/          # CodeFun2000 站内面经
│   ├── videos/                # B 站公开课切片
│   └── coding-problems/       # 面经手撕索引 + hot100/ 练习题库
├── scripts/
│   ├── hw_update.py           # 客户 pull / 维护者流水线入口
│   └── compile_wiki.py        # 原始面经 → wiki/compiled
└── skills/
    ├── hw/  hw-ask/  hw-match/  hw-update/
```

## 知识库检索顺序

见 `knowledge/taxonomy.yaml` 的 `retrieval_priority`：

1. 站内流程说明 + B 站视频 + `hot100/` 手撕题索引  
2. `exam/` 精编卡片 + `wiki/compiled/` 聚合摘要  
3. 牛客/小红书面经全文（补充）

面向客户的引用规则：B 站固定 `[A]`；CodeFun2000 带链接；牛客/小红书**不带外链**。详见 `skills/hw-ask/SKILL.md`。

## 安装

```bash
npx skills add <repo-path> --all -y
```

遵循 [Agent Skills 开放标准](https://agentskills.io/specification)。

---

## 维护者

### 一键更新（推荐）

```powershell
cd hw-campus-skills
python scripts/hw_update.py --mode maintainer
```

等价于：牛客 ingest → 质量/校招/死链过滤 → 优化去重 → **compile_wiki** → 写 manifest。

仅重编 Wiki（不爬牛客）：

```powershell
python scripts/hw_update.py --mode maintainer --skip-ingest
```

### CI（模式 B）

仓库 `.github/workflows/hw-campus-knowledge.yml` 每周自动跑 maintainer 链（牛客公开 API，无需 OpenCLI）。

### 分步脚本（与一键链相同）

```powershell
python scripts/ingest_nowcoder.py
python scripts/filter_quality.py
python scripts/filter_campus_only.py
python scripts/filter_dead_links.py
python scripts/clean_experience_blanks.py
python scripts/optimize_experiences.py --apply
python scripts/compile_wiki.py
```

**小红书**（需 Chrome + OpenCLI + 登录）：`ingest_xiaohongshu.py`  
**B 站字幕**（需 OpenCLI）：`ingest_bilibili_video.py`  
**CodeFun2000 正文**（需 Cookie）：`sync_codefun2000.py`

### 机考政策（2026）

开发岗 **150+150+300**，常见通过线 **200 分** — 以 `knowledge/exam/exam-format.md`（`policy_effective: 2026`）为准；compile Wiki 不覆盖政策卡片。

### 当前规模

运行后查看 `knowledge/.manifest.json` 的 `counts` 字段（牛客 ~1000+、编译主题 10 篇、CodeFun2000 平台 ~97 等，以本地为准）。
