# CodeFun2000 平台面经（hwmj）

站内 **97 篇**校招面经，每篇对应一个题目 ID。数据源：仓库根目录 `华为面经/`。

## 命名

`hw-exp-cf-P{pid}.md`（如 `hw-exp-cf-P2528.md`）

## 同步

更新 `华为面经/`（含 `标题.txt` / `题面.md` / `网址.txt`）后，运行：

```powershell
python scripts/sync_hwmj_from_folder.py
python scripts/build_experience_index.py --write-pages
cd frontend
npm run build-experiences
```

会：

- 用标题里的批次/月份写入 `published_at`
- 按章节 + 标题关键词映射到岗位 `role`
- 重建 `knowledge/coding-problems/index.json` 与 `catalog.json`

## frontmatter 要点

- `source_grade: B`
- `sources[].platform: codefun2000`
- `sources[].url`：文件内必填；Agent 回答时应输出可点击链接
- `catalog_pid` / `category` / `published_at` / `role`
