---
id: hw-exp-cf-P2422
kind: experience
source_grade: B
stage: interview
role: software-development
sources:
  - platform: codefun2000
    title: "25秋招-华为手撕真题两道"
    url: "https://codefun2000.com/ide/P2422"
catalog_pid: "P2422"
category: "通用软件开发"
tags: ["手撕", "校招"]
published_at: 2024-09-15
---

# 25秋招-华为手撕真题两道

- 分类：通用软件开发

- 来源：[25秋招-华为手撕真题两道](https://codefun2000.com/ide/P2422)

## 一、最大个数

输入一个整数，输出该整数二进制中连续0或连续1的最大个数

例如:

$3:\  011$，连续1个数最多，输出：2。 

$9:\ 1001$，连续0个数最多，输出：2



## 二、删除字符串中的所有相邻重复项

给出由小写字母组成的字符串 $S$，重复项删除操作会选择两个相邻且相同的字母，并删除它们。

在 $S$ 上反复执行重复项删除操作，直到无法继续删除。

在完成所有重复项删除操作后返回最终的字符串。答案保证唯一。

**输入:** abbaca

**输出:** ca

**解释：** 在输入中，我们看到bb相邻，删掉bb后，得到aaca，aa相邻删掉后，得到ca。

**提示：** $1\leqslant s.length\leqslant 20000$

$S$ 仅为小写字母组成
