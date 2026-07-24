/** 关键词分组展示名与排序（与 scripts/role_label_taxonomy.py 对齐） */

export const GROUP_LABELS = {
  period: "时期",
  content: "包含内容",
  language: "语言",
  language_framework: "语言与框架",
  stack: "技术栈",
  direction: "方向",
  platform: "平台与硬件",
  foundation: "协议与基础",
  testing: "测试类型",
  other: "其他",
};

export const GROUP_ORDER = [
  "period",
  "content",
  "language",
  "language_framework",
  "stack",
  "direction",
  "platform",
  "foundation",
  "testing",
  "other",
];

const PERIOD = { 实习: "period", 校招: "period" };

/** 岗位 -> 标签 -> group（卡片展示用；侧栏优先用 API 返回的 group） */
export const ROLE_KEYWORD_GROUPS = {
  "software-development": {
    ...PERIOD,
    八股: "content",
    手撕: "content",
    "C++": "language",
    Python: "language",
    Java: "language",
    Go: "language",
    后端: "stack",
    前端: "stack",
    操作系统: "stack",
    数据库: "stack",
    分布式: "stack",
    云计算: "stack",
    Spring: "stack",
    Linux: "stack",
    微服务: "stack",
  },
  ai: {
    ...PERIOD,
    八股: "content",
    手撕: "content",
    大模型: "direction",
    深度学习: "direction",
    计算机视觉: "direction",
    NLP: "direction",
    机器学习: "direction",
    智能驾驶: "direction",
    Agent: "direction",
    Python: "language_framework",
    PyTorch: "language_framework",
    TensorFlow: "language_framework",
  },
  embedded: {
    ...PERIOD,
    八股: "content",
    手撕: "content",
    C语言: "language",
    "C++": "language",
    Linux: "platform",
    单片机: "platform",
    ARM: "platform",
    FPGA: "platform",
    RTOS: "platform",
    芯片: "platform",
    总线: "platform",
    驱动: "platform",
  },
  "network-communication": {
    ...PERIOD,
    八股: "content",
    手撕: "content",
    "5G": "direction",
    无线: "direction",
    核心网: "direction",
    数通: "direction",
    光产品: "direction",
    基带: "direction",
    射频: "direction",
    ICT: "direction",
    协议: "foundation",
  },
  "test-qa": {
    ...PERIOD,
    八股: "content",
    手撕: "content",
    软件测试: "testing",
    解决方案测试: "testing",
    测开: "testing",
    自动化: "testing",
    接口测试: "testing",
    性能测试: "testing",
    Python: "language",
  },
};

/**
 * 将侧栏关键词条目按 group 分组。
 * @param {{ keyword: string, group?: string }[]} keywords
 * @param {string} [role]
 * @returns {{ group: string, label: string, items: typeof keywords }[]}
 */
export function groupKeywordEntries(keywords, role) {
  const fallback = ROLE_KEYWORD_GROUPS[role] || {};
  const buckets = new Map();
  for (const kw of keywords || []) {
    const group = kw.group || fallback[kw.keyword] || "other";
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push(kw);
  }
  return GROUP_ORDER.filter((g) => buckets.has(g)).map((group) => ({
    group,
    label: GROUP_LABELS[group] || group,
    items: buckets.get(group),
  }));
}

/**
 * 将面经 tags 按岗位分组；未登记标签归入 other（有内容才展示）。
 * @param {string[]} tags
 * @param {string} role
 * @returns {{ group: string, label: string, tags: string[] }[]}
 */
export function groupTagsByRole(tags, role) {
  const map = ROLE_KEYWORD_GROUPS[role] || {};
  const buckets = new Map();
  for (const tag of tags || []) {
    if (!tag) continue;
    const group = map[tag] || "other";
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push(tag);
  }
  return GROUP_ORDER.filter((g) => buckets.has(g)).map((group) => ({
    group,
    label: GROUP_LABELS[group] || group,
    tags: buckets.get(group),
  }));
}
