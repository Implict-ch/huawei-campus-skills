---
name: hw-update
description: >-
  更新华为校招知识包：客户模式 git pull 拉取最新库；维护者模式跑采集与编译。触发：/hw-update、更新知识库、同步面经。
disable-model-invocation: true
---

# /hw-update — 知识包更新

**禁止**用 Grep/Read 扫描 `knowledge/` 来「手工更新」；**只执行脚本**。

## 客户（默认）

在 **`hw-campus-skills` 包根目录** 执行：

```powershell
python scripts/hw_update.py
```

等价于 `git pull --ff-only` + 打印 `knowledge/.manifest.json` 条数摘要。

完成后告知用户：可直接继续 `/hw-ask` 或 `/hw-match`，**无需**重跑 compile。

## 维护者

```powershell
python scripts/hw_update.py --mode maintainer
python scripts/hw_update.py --mode maintainer --skip-ingest   # 仅重编 wiki + manifest
python scripts/hw_update.py --mode maintainer --dry-run
```

流水线：牛客 ingest → filter 链 → `compile_wiki.py` → 写 manifest。

可选（需 Cookie / OpenCLI，**不在**默认 maintainer 链内）：

- `CODEFUN2000_COOKIE=... python scripts/sync_codefun2000.py`
- `python scripts/ingest_xiaohongshu.py`（需 OpenCLI）
- `python scripts/ingest_bilibili_video.py --series campus-202607`

## 输出给用户

- 是否 pull 成功 / 各脚本是否报错
- `knowledge/.manifest.json` 中的 `generated_at`、`counts`（牛客/小红书/编译主题数等）
- **不要**在回复里贴 manifest 路径当作「依据与边界」来源

## 架构说明

见 `schema/LAYERS.md`、`schema/COMPILE.md`。
