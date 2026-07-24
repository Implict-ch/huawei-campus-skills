# 华为算法岗手撕题

- **来源**：[CodeFun2000 题集](https://codefun2000.com/pset/edit/69099e4c3bd8d8fad614f06d)
- **题集 ID**：`69099e4c3bd8d8fad614f06d`
- **题目总数**：34

## 章节分布

| 章节 | 题数 |
|------|-----:|
| 机器学习 | 10 |
| 深度学习 | 10 |
| 大模型岗 | 14 |

## 目录结构

```
华为算法岗手撕题/
├── 机器学习/Pxxxx/
├── 深度学习/Pxxxx/
└── 大模型岗/Pxxxx/
    ├── 题面.md
    ├── 网址.txt    # 如 https://codefun2000.com/p/P4483
    └── 标题.txt    # 如 K-Means 聚类算法
```

## 复现

```powershell
cd d:\机考出题\problem-maker\utils
python fetch_pset_statements_by_folder.py `
  --base-url "https://codefun2000.com/pset/edit/69099e4c3bd8d8fad614f06d" `
  --out-dir "d:\机考出题\problem-maker\华为算法岗手撕题" `
  --url-template "https://codefun2000.com/p/{pid}" `
  --no-proxy
```
