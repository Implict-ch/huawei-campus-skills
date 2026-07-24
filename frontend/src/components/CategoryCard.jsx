import { useState } from "react";
import FadeIn, { FADE_STAGGER } from "./FadeIn.jsx";
import { IconBox, Icon } from "../icons/index.jsx";

const CATEGORY_ICONS = {
  "数组": "chart",
  "链表": "layers",
  "二叉树": "workflow",
  "BFS / DFS": "search",
  "二分查找": "target",
  "排序": "sigma",
  "字符串": "write",
  "栈 / 队列": "layers",
  "堆": "chart",
  "动态规划": "brain",
  "回溯": "workflow",
  "贪心": "fire",
  "滑动窗口": "maximize",
  "双指针": "arrow",
  "哈希": "judge",
  "并查集": "users",
  "图论": "globe",
  "数学": "sigma",
  "位运算": "code",
  "设计": "building",
  "其他": "info",
  "机器学习": "brain",
  "深度学习": "network",
  "大模型岗": "robot",
};

const CATEGORY_COLORS = {
  "数组": "#58A6FF",
  "链表": "#C084FC",
  "二叉树": "#3FB950",
  "BFS / DFS": "#F78166",
  "二分查找": "#58A6FF",
  "排序": "#C084FC",
  "字符串": "#3FB950",
  "栈 / 队列": "#F78166",
  "堆": "#58A6FF",
  "动态规划": "#C084FC",
  "回溯": "#3FB950",
  "贪心": "#F78166",
  "滑动窗口": "#58A6FF",
  "双指针": "#C084FC",
  "哈希": "#3FB950",
  "并查集": "#F78166",
  "图论": "#58A6FF",
  "数学": "#C084FC",
  "位运算": "#3FB950",
  "设计": "#F78166",
  "其他": "#8B949E",
  "机器学习": "#C084FC",
  "深度学习": "#58A6FF",
  "大模型岗": "#F78166",
};

export default function CategoryCard({ name, count, slug, index }) {
  const [hover, setHover] = useState(false);
  const icon = CATEGORY_ICONS[name] || "more";
  const color = CATEGORY_COLORS[name] || "var(--accent)";

  return (
    <FadeIn delay={index * FADE_STAGGER}>
      <a
        href={`/hand-tear/${slug}`}
        className={`role-card${hover ? " role-card--hover" : ""}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="role-card__shine" />
        <div className="role-card__head">
          <IconBox icon={icon} color={color} size={44} />
          <div className="role-card__meta">
            <h3 className="role-card__title">{name}</h3>
            <span className="role-card__count">{count} 道题</span>
          </div>
        </div>
        <div className="role-card__link">
          查看题目 <Icon name="arrow" size={14} color="var(--accent)" />
        </div>
      </a>
    </FadeIn>
  );
}
