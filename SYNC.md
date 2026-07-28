# 知识库一键同步说明书（维护者 / Agent）

> **固定入口**：将 Hydro 插件内的知识库（Source of Truth）同步到本 skills 仓库，并上传远程。  
> Agent 执行本文件时：**按顺序逐步执行**，不要跳步；不要手改本仓 `knowledge/` 后当作权威源。

## 前提

| 项 | 路径 |
|----|------|
| 插件仓（SoT） | `/root/codefun2000.addons` |
| 插件知识库 | `react-page/hw-skills-page/knowledge/` |
| Skills 仓（本仓） | `/root/hw-skills` |
| 远程 | `origin` → `git@github.com:codefun2000/hw-skills.git` |
| 同步脚本 | `codefun2000.addons/react-page/hw-skills-page/scripts/sync-knowledge-to-skills.mjs` |

可选环境变量：`HW_SKILLS_REPO`（默认探测 `/root/hw-skills`）。

客户可见 skill **仅两个**：`/hw-ask`、`/hw-interview`（与插件 slash 同名）。

---

## 步骤（必须按序）

### 1. 确认插件侧知识库已改完

- 在插件仓编辑 `react-page/hw-skills-page/knowledge/`。
- （推荐）线上 RAG / 管理员 `reload-knowledge` 验证无误后再同步。

### 2. 执行同步脚本（复制 knowledge）

在插件仓根或任意目录执行：

```bash
node /root/codefun2000.addons/react-page/hw-skills-page/scripts/sync-knowledge-to-skills.mjs
```

期望输出含：`file count SRC=… DEST=…` 且无 `ERROR`。  
脚本会 `--delete` 镜像插件树，并排除 `experiences/_audit/`；缺关键卡（如 `assessment-practice-simulator.md`）会失败退出。

### 3. 确认 skills 文案（若有变更）

仅检查/更新：

- `/root/hw-skills/skills/hw-ask/SKILL.md`
- `/root/hw-skills/skills/hw-interview/SKILL.md`

**禁止**再新增其它客户 skill 名（不要恢复 `/hw`、`/hw-match`、`/hw-update`）。

### 4. 检查 git 状态

```bash
cd /root/hw-skills
git status
git diff --stat
```

确认变更以 `knowledge/` 为主；skills/README/SYNC 仅在确有修改时出现。

### 5. 提交（commit）

**一键（推荐）**：同步 + commit

```bash
node /root/codefun2000.addons/react-page/hw-skills-page/scripts/sync-knowledge-to-skills.mjs --commit
```

或手动：

```bash
cd /root/hw-skills
git add knowledge skills README.md SYNC.md
git commit -m "$(cat <<'EOF'
chore(knowledge): sync from hw-skills-page

EOF
)"
```

### 6. 上传（push）

**一键（推荐）**：同步 + commit + push

```bash
node /root/codefun2000.addons/react-page/hw-skills-page/scripts/sync-knowledge-to-skills.mjs --commit --push
```

或手动：

```bash
cd /root/hw-skills
git push origin HEAD
```

### 7. 告知客户

维护者推送成功后，客户侧：

```bash
cd <其 hw-skills 克隆目录>
git pull --ff-only
# 或重新：npx skills add git@github.com:codefun2000/hw-skills.git --all -y
```

然后继续使用 `/hw-ask` / `/hw-interview`。

---

## Agent 速查（复制即用）

当用户说「同步知识库到 skills 并上传」时，在有网络与 git 权限的环境下执行：

```bash
node /root/codefun2000.addons/react-page/hw-skills-page/scripts/sync-knowledge-to-skills.mjs --commit --push
```

若仅同步不上传：

```bash
node /root/codefun2000.addons/react-page/hw-skills-page/scripts/sync-knowledge-to-skills.mjs
```

失败时：根据脚本 `ERROR` 行排查路径 / rsync / 缺文件 / git 凭据，**不要**用手工 `cp` 绕过校验。

---

## 不做

- 不把本仓 `frontend` 可视化产品加回来。
- 不把 embeddings / `experiences.json` 同步进本仓（属插件运行时）。
- 不以本仓 `knowledge/` 反向覆盖插件（方向永远是 **插件 → skills**）。
