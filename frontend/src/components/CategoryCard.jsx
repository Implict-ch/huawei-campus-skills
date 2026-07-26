import FadeIn, { FADE_STAGGER } from "./FadeIn.jsx";
import { IconBox, Icon } from "../icons/index.jsx";

const CATEGORY_ICONS = {
  数组: "chart",
  普通数组: "chart",
  链表: "layers",
  二叉树: "workflow",
  "BFS / DFS": "search",
  二分查找: "target",
  排序: "sigma",
  字符串: "write",
  子串: "write",
  "栈 / 队列": "layers",
  栈: "layers",
  堆: "chart",
  动态规划: "brain",
  多堆动态规划: "layers",
  回溯: "workflow",
  贪心: "fire",
  贪心算法: "fire",
  滑动窗口: "maximize",
  双指针: "arrow",
  哈希: "judge",
  并查集: "users",
  图论: "globe",
  数学: "sigma",
  矩阵: "split-cells",
  位运算: "code",
  设计: "building",
  技巧: "lightbulb",
  入门教程必刷: "book-open",
  其他: "more",
  分治: "split-cells",
  "原创 / 变种": "lightbulb",
  机器学习: "brain",
  深度学习: "network",
  大模型岗: "robot",
};

const CATEGORY_COLORS = {
  数组: "#58A6FF",
  普通数组: "#58A6FF",
  链表: "#C084FC",
  二叉树: "#3FB950",
  "BFS / DFS": "#F78166",
  二分查找: "#58A6FF",
  排序: "#C084FC",
  字符串: "#3FB950",
  子串: "#3FB950",
  "栈 / 队列": "#F78166",
  栈: "#F78166",
  堆: "#58A6FF",
  动态规划: "#C084FC",
  多堆动态规划: "#C084FC",
  回溯: "#3FB950",
  贪心: "#F78166",
  贪心算法: "#F78166",
  滑动窗口: "#58A6FF",
  双指针: "#C084FC",
  哈希: "#3FB950",
  并查集: "#F78166",
  图论: "#58A6FF",
  数学: "#C084FC",
  矩阵: "#58A6FF",
  位运算: "#3FB950",
  设计: "#F78166",
  技巧: "#EF9F27",
  入门教程必刷: "#3FB950",
  其他: "#8B949E",
  分治: "#EF9F27",
  "原创 / 变种": "#EF9F27",
  机器学习: "#C084FC",
  深度学习: "#58A6FF",
  大模型岗: "#F78166",
};

export default function CategoryCard({ name, count, slug, index }) {
  const icon = CATEGORY_ICONS[name] || "more";
  const color = CATEGORY_COLORS[name] || "var(--accent)";

  return (
    <FadeIn delay={index * FADE_STAGGER}>
      <a href={`/hand-tear/${slug}`} className="role-card role-card--category">
        <div className="role-card__head">
          <IconBox icon={icon} color={color} size={32} />
          <h3 className="role-card__title">{name}</h3>
          <span className="role-card__count">{count} 道题</span>
        </div>
        <div className="role-card__link">
          查看题目 <Icon name="arrow" size={14} color="var(--accent)" />
        </div>
      </a>
    </FadeIn>
  );
}
