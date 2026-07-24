# problem-page 样式模块

题解页样式由 `index.css` 按依赖顺序 `@import` 各文件。入口仍为 `src/styles/problem-page.css`（单行转发）。

## 文件说明

| 文件 | 内容 |
|------|------|
| `layout.css` | 双栏网格、主栏、loading |
| `toc.css` | 左侧目录 |
| `meta.css` | 题目标题、标签、返回 |
| `prose.css` | `.problem-prose` 正文排版 |
| `example.css` | 样例 I/O 块 |
| `code-block.css` | CodeBlock 容器、行号、复制 |
| `syntax-highlight.css` | hljs 高亮 token |
| `code-tabs.css` | 多语言 Tab |
| `complexity.css` | 复杂度卡片 |
| `qa.css` | 面试追问手风琴 |
| `interactive-demo.css` | 交互动画外壳 |
| `two-sum-demo.css` | Two Sum 演示 |
| `prev-next.css` | 上下题导航 |
| `responsive.css` | 断点覆盖（放最后） |
| `io-components.css` | IoSpec、DataRange |
| `katex.css` | 公式排版 |
| `prose-containers.css` | 语义容器末子元素 margin、highlight |
| `callout.css` | Callout、IoRule |
| `data-range-diff.css` | 数据范围对比 |
| `lang-compare.css` | 语言类型对照 |
| `flow-steps.css` | FlowSteps |
| `progress-path.css` | ProgressPath |
| `term-card.css` | TermCard |
| `checklist.css` | Checklist |
| `list-link-edge.css` | 链表边、动画 keyframes |
| `linked-list-diagram.css` | 静态链表节点与图示 |
| `tail-insert.css` | 尾插法步进演示 |
| `binary-tree.css` | 完全二叉树 SVG、对比图、递归建树步进演示 |

## 维护约定

- 新增 MDX 组件样式：在对应模块文件末尾追加，并更新 `prose-containers.css` 的 `:last-child` 登记。
- 字号只用 `typography.css` 中的 `--text-*` token。
- 从完整单文件重新拆分：`node scripts/split-problem-page-css.mjs src/styles/problem-page.source.css`
