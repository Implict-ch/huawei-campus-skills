/** 页面静态内容 — 与主题无关的数据 */

export const NAV_LINKS = [
  { label: "路线图", href: "#roadmap" },
  { label: "笔试真题", href: "#exam" },
  { label: "面试手撕", href: "#interview" },
  { label: "课程", href: "#course" },
  { label: "平台能力", href: "#platform" },
];

/** Hero 概览：与下方「公司笔试真题」区块的 COMPANY_STATS 错开，避免重复展示题量 */
export const STATS = [
  { value: "5000+", label: "笔试真题", icon: "layers", colorVar: "--accent" },
  { value: "50+", label: "公司覆盖", icon: "building", colorVar: "--info" },
  { value: "多种", label: "编程语言", icon: "code", colorVar: "--teal" },
  { value: "Hot 100", label: "精品题解", icon: "book", colorVar: "--purple" },
  { value: "路线图", label: "校招路线", icon: "map", colorVar: "--accent" },
];

export const PRODUCTS = [
  {
    id: "interview",
    sectionLabel: "// INTERVIEW",
    sectionTitle: "面试手撕方向",
    sectionIcon: "target",
    sectionColorVar: "--accent",
    sectionDesc: "从力扣到大厂真实手撕，全面覆盖面试编码环节",
    items: [
      {
        title: "LeetCode Hot 100 学习笔记",
        icon: "fire",
        iconColor: "#F85149",
        tags: ["C++", "Python", "Java", "Go", "JS"],
        desc: "详细文字题解 + 配图 + 动画演示，五种语言全覆盖，支持在线测试。配套 ACM 模式题库同步练习。",
        badge: "热门",
        badgeColor: "#F85149",
        link: "/hot100/intro",
      },
      {
        title: "算法岗手撕题库",
        icon: "brain",
        iconColor: "#C084FC",
        tags: ["机器学习", "深度学习", "大模型"],
        desc: "非力扣传统手撕题，覆盖 ML/DL/LLM 相关的代码实现题，面向算法岗求职者。",
        badge: "特色",
        badgeColor: "#58A6FF",
        link: "#",
      },
      {
        title: "ACM 模式题库",
        icon: "terminal",
        iconColor: "#2DD4BF",
        tags: ["标准I/O", "快速上手"],
        desc: "几乎所有笔试都用 ACM 模式，如果你只刷过力扣从没处理过输入输出，这个帮你快速补齐。",
        badge: null,
        link: "/acm/intro",
      },
    ],
  },
  {
    id: "course",
    sectionLabel: "// COURSE",
    sectionTitle: "课程方向",
    sectionIcon: "book",
    sectionColorVar: "--success",
    sectionDesc: "体系化学习，从零到笔试通关",
    items: [
      {
        title: "C++ 算法基础课",
        icon: "course-cpp",
        iconColor: "#60A5FA",
        tags: ["C++", "笔试高频"],
        desc: "面向 C++ 选手的系统化算法课，覆盖 STL、复杂度分析与笔试常考题型，配合 C++ 题库实战。",
        badge: "课程",
        badgeColor: "#60A5FA",
        link: "#",
      },
      {
        title: "Python 算法基础课",
        icon: "course-python",
        iconColor: "#4ADE80",
        tags: ["Python", "快速上手"],
        desc: "用 Python 刷题入门算法，语法简洁、上手快，适合零基础或从其他语言转 Python 的同学。",
        badge: "课程",
        badgeColor: "#4ADE80",
        link: "#",
      },
      {
        title: "Java 算法基础课",
        icon: "course-java",
        iconColor: "#FB923C",
        tags: ["Java", "大厂笔试"],
        desc: "Java 语法 + 集合框架 + 经典算法模板，对齐国内大厂 Java 笔试与手撕常见考点。",
        badge: "课程",
        badgeColor: "#FB923C",
        link: "#",
      },
    ],
  },
];

export const COMPANIES = [
  { name: "华为", count: 800, accent: "#E33" },
  { name: "字节跳动", count: 650, accent: "#3CF" },
  { name: "阿里巴巴", count: 520, accent: "#F60" },
  { name: "腾讯", count: 480, accent: "#07F" },
  { name: "拼多多", count: 360, accent: "#F33" },
  { name: "小红书", count: 320, accent: "#F44" },
  { name: "美团", count: 300, accent: "#FC0" },
  { name: "携程", count: 280, accent: "#09F" },
  { name: "百度", count: 240, accent: "#33F" },
  { name: "京东", count: 220, accent: "#E22" },
  { name: "网易", count: 200, accent: "#C33" },
  { name: "快手", count: 180, accent: "#F80" },
  { name: "滴滴", count: 160, accent: "#F70" },
  { name: "蚂蚁", count: 150, accent: "#36C" },
  { name: "SHEIN", count: 120, accent: "#444" },
  { name: "米哈游", count: 110, accent: "#66F" },
  { name: "大疆", count: 100, accent: "#0AD" },
  { name: "更多...", count: null, accent: "var(--text-muted)" },
];

export const COMPANY_STATS = [
  { label: "笔试真题", value: "5000+", colorVar: "--accent", icon: "layers" },
  { label: "大厂覆盖", value: "50+", colorVar: "--info", icon: "building" },
  { label: "持续更新", value: "每周", colorVar: "--success", icon: "clock" },
];

export const ROADMAP_STEPS = [
  { step: "投递", icon: "send", desc: "简历优化、投递时间窗口、内推渠道整理", color: "#58A6FF" },
  { step: "笔试", icon: "write", desc: "题型分析、高频考点、限时模拟训练", color: "var(--accent)" },
  { step: "测评", icon: "brain", desc: "性格测评技巧、注意事项、真题参考", color: "#D29922" },
  { step: "面试", icon: "users", desc: "技术面 + 主管面 + HR面全流程准备", color: "#3FB950" },
  { step: "排序", icon: "chart", desc: "Offer 排序机制解析、定级定薪参考", color: "#C084FC" },
  { step: "入职", icon: "building", desc: "入职准备清单、部门选择建议", color: "#F85149" },
];

export const ROADMAP_UPCOMING = [
  { name: "字节跳动路线图", status: "即将上线" },
  { name: "阿里巴巴路线图", status: "规划中" },
  { name: "腾讯路线图", status: "规划中" },
];

export const PLATFORM_FEATURES = [
  { icon: "judge", colorVar: "--accent", title: "在线评测系统", desc: "支持考试模式和练习模式，还原真实笔试体验" },
  { icon: "robot", colorVar: "--info", title: "AI 分析功能", desc: "智能分析代码质量，提供优化建议和复杂度评估" },
  { icon: "globe", colorVar: "--teal", title: "多语言支持", desc: "C++ / Python / Java / Go / JavaScript 五种语言" },
  { icon: "chart", colorVar: "--purple", title: "学习进度追踪", desc: "做题记录、正确率统计、薄弱点定向推荐" },
];

export const TAG_COLORS = {
  "C++": { bg: "#3B82F620", bd: "#3B82F640", c: "#60A5FA" },
  Python: { bg: "#22C55E20", bd: "#22C55E40", c: "#4ADE80" },
  Java: { bg: "#F9731620", bd: "#F9731640", c: "#FB923C" },
  Go: { bg: "#06B6D420", bd: "#06B6D440", c: "#22D3EE" },
  JS: { bg: "#EAB30820", bd: "#EAB30840", c: "#FCD34D" },
  JavaScript: { bg: "#EAB30820", bd: "#EAB30840", c: "#FCD34D" },
  机器学习: { bg: "#A855F720", bd: "#A855F740", c: "#C084FC" },
  深度学习: { bg: "#EC489920", bd: "#EC489940", c: "#F472B6" },
  大模型: { bg: "#F4364320", bd: "#F4364340", c: "#FB7185" },
  "标准I/O": { bg: "#14B8A620", bd: "#14B8A640", c: "#2DD4BF" },
  快速上手: { bg: "#84CC1620", bd: "#84CC1640", c: "#A3E635" },
};
