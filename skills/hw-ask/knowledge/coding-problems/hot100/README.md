# 面试手撕 Hot100

华为校招技术面常见 Hot100 类练习题，共 **126** 道，按算法章节分类。

## 目录结构

```text
<章节名>/Pxxxx/
  题面.md
  网址.txt    # 题目页链接，供 /hw-match 推荐手撕题使用
```

## Agent 使用

- 索引：`index.json`（含 `id`、`chapter`、`title`、`source_url`、`statement_path`）
- **`/hw-match` 推荐手撕题时，链接必须来自本目录 `index.json` 的 `source_url`**

## 章节分布

| 章节 | 题数（约） |
|------|----------|
| 链表 | 14 |
| 二叉树 | 17 |
| 栈 | 9 |
| 动态规划 | 12 |
| 回溯 | 8 |
| 二分查找 | 7 |
| 其余章节 | 见各子目录 |

维护者更新：`python scripts/import_hot100.py`（从仓库外源目录导入，见脚本说明）
