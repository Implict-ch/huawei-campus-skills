/** 新 web app 的静态数据（面经 + Agent） */

export const HW_APP_NAV = [
  { label: "首页", href: "/" },
  { label: "面经", href: "/experiences" },
  { label: "智能问答", href: "/agent" },
];

export const ROLE_CARDS = [
  {
    role: "software-development",
    title: "通用软件开发",
    icon: "code",
    iconColor: "#58A6FF",
    desc: "通用软开、Java、C++、前端、后端、数据开发等岗位面经",
  },
  {
    role: "ai",
    title: "AI大类",
    icon: "brain",
    iconColor: "#C084FC",
    desc: "算法岗、AI、机器学习、深度学习、计算机视觉等方向面经",
  },
  {
    role: "embedded",
    title: "嵌入式软件",
    icon: "hard-drive",
    iconColor: "#2DD4BF",
    desc: "嵌入式软件、FPGA、芯片、物联网相关岗位面经",
  },
  {
    role: "network-communication",
    title: "通信 / 网络",
    icon: "globe",
    iconColor: "#3FB950",
    desc: "通信工程、5G、网络、无线、核心网相关岗位面经",
  },
  {
    role: "test-qa",
    title: "测试",
    icon: "check",
    iconColor: "#EF9F27",
    desc: "测试开发、测试工程师、自动化测试相关岗位面经",
  },
];

export const AGENT_PAGE_CONTENT = {
  hero: {
    title: "华为校招智能问答",
    subtitle: "",
  },
  models: [
    { value: "builtin-deepseek", label: "内置模型", baseUrl: "https://api.deepseek.com/v1" },
    { value: "gpt-4o-mini", label: "OpenAI gpt-4o-mini", baseUrl: "" },
    { value: "gpt-4o", label: "OpenAI gpt-4o", baseUrl: "" },
    { value: "deepseek-chat", label: "DeepSeek Chat（自定义 Key）", baseUrl: "https://api.deepseek.com/v1" },
    { value: "custom", label: "自定义（填写 baseUrl + model）", baseUrl: "" },
  ],
};
