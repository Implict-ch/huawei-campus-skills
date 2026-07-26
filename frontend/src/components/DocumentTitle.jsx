import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE = "华为校招求职教练";
const HOME_TITLE = "华为校招求职教练｜CodeFun2000";

const ROLE_NAMES = {
  ai: "AI大类",
  "software-development": "通软",
  embedded: "嵌入式软件",
  "network-communication": "通信/网络",
  "test-qa": "测试",
};

const HAND_TEAR_NAMES = {
  llm: "大模型岗",
  ml: "机器学习",
  dl: "深度学习",
  array: "数组",
  "linked-list": "链表",
  "binary-tree": "二叉树",
  "bfs-dfs": "BFS / DFS",
  "binary-search": "二分查找",
  sorting: "排序",
  string: "字符串",
  "stack-queue": "栈 / 队列",
  heap: "堆",
  dp: "动态规划",
  backtracking: "回溯",
  greedy: "贪心",
  "sliding-window": "滑动窗口",
  "two-pointers": "双指针",
  hash: "哈希",
  "union-find": "并查集",
  graph: "图论",
  math: "数学",
  bit: "位运算",
  design: "设计",
  "divide-conquer": "分治",
  original: "原创 / 变种",
  other: "其他",
};

function pageNameFromPath(pathname) {
  if (pathname === "/" || pathname === "") return null;

  if (pathname === "/agent" || pathname.startsWith("/agent?")) return "求职教练";
  if (pathname === "/experiences") return "面经";
  if (pathname === "/hand-tear") return "手撕题库";

  const expDetail = pathname.match(/^\/experiences\/([^/]+)\/([^/]+)\/?$/);
  if (expDetail) return "面经详情";

  const expRole = pathname.match(/^\/experiences\/([^/]+)\/?$/);
  if (expRole) {
    const role = decodeURIComponent(expRole[1]);
    return ROLE_NAMES[role] ? `${ROLE_NAMES[role]}面经` : "面经";
  }

  const htCat = pathname.match(/^\/hand-tear\/([^/]+)\/?$/);
  if (htCat) {
    const slug = decodeURIComponent(htCat[1]);
    return HAND_TEAR_NAMES[slug] || slug;
  }

  return "页面";
}

export default function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = pageNameFromPath(pathname);
    document.title = page ? `${page} ｜ ${SITE}` : HOME_TITLE;
  }, [pathname]);

  return null;
}
